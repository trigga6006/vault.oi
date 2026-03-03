import { providerRegistry } from '../../providers/registry';
import { providerConfigRepo } from '../database/repositories/provider-config.repo';
import { vaultService } from './vault-service';
import type { ProviderCredentials, ProviderAdapterConfig } from '../../shared/types/provider.types';

export class ProviderService {
  /** Encrypt credentials using the vault's derived key */
  encryptCredentials(credentials: ProviderCredentials): string {
    if (!vaultService.isUnlocked) {
      // Fallback: base64 encoding if vault not available yet
      console.warn('[ProviderService] Vault locked, storing as base64 (temporary)');
      return Buffer.from(JSON.stringify(credentials)).toString('base64');
    }
    return vaultService.encrypt(JSON.stringify(credentials));
  }

  /** Decrypt credentials using the vault's derived key */
  decryptCredentials(encrypted: string): ProviderCredentials {
    if (!vaultService.isUnlocked) {
      // Attempt base64 fallback for legacy data
      try {
        return JSON.parse(Buffer.from(encrypted, 'base64').toString('utf-8'));
      } catch {
        throw new Error('Vault is locked — cannot decrypt credentials');
      }
    }
    try {
      return JSON.parse(vaultService.decrypt(encrypted));
    } catch {
      // Fallback: try base64 for pre-vault data
      try {
        return JSON.parse(Buffer.from(encrypted, 'base64').toString('utf-8'));
      } catch {
        throw new Error('Failed to decrypt credentials');
      }
    }
  }

  /** Save provider configuration with encrypted credentials */
  async saveProvider(
    providerId: string,
    displayName: string,
    credentials: ProviderCredentials,
    config?: ProviderAdapterConfig & { usageFetchInterval?: number },
  ): Promise<void> {
    const encrypted = this.encryptCredentials(credentials);
    const now = new Date().toISOString();

    await providerConfigRepo.upsert({
      providerId,
      displayName,
      enabled: true,
      authMethod: 'api_key',
      encryptedCredentials: encrypted,
      baseUrl: config?.baseUrl ?? null,
      organizationId: credentials.organizationId ?? null,
      usageFetchInterval: config?.usageFetchInterval ?? 5,
      timeout: config?.timeout ?? 30000,
      maxRetries: config?.maxRetries ?? 3,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Activate a provider from its stored config */
  async activateFromConfig(providerId: string): Promise<boolean> {
    const config = await providerConfigRepo.getById(providerId);
    if (!config || !config.encryptedCredentials) {
      console.warn(`[ProviderService] No config found for provider: ${providerId}`);
      return false;
    }

    try {
      const credentials = this.decryptCredentials(config.encryptedCredentials);
      await providerRegistry.activate(providerId, credentials, {
        baseUrl: config.baseUrl ?? undefined,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
      });
      return true;
    } catch (error) {
      console.error(`[ProviderService] Failed to activate ${providerId}:`, error);
      return false;
    }
  }

  /** Activate all enabled providers on startup */
  async activateAllEnabled(): Promise<void> {
    const configs = await providerConfigRepo.getEnabled();
    for (const config of configs) {
      await this.activateFromConfig(config.providerId);
    }
    console.log(`[ProviderService] Activated ${providerRegistry.getAllActive().length} providers`);
  }

  /** Deactivate and remove provider config */
  async removeProvider(providerId: string): Promise<void> {
    await providerRegistry.deactivate(providerId);
    await providerConfigRepo.delete(providerId);
  }
}

export const providerService = new ProviderService();

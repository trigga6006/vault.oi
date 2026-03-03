import { registerHandler } from './register-all';
import { vaultService } from '../services/vault-service';
import { keyVaultService } from '../services/key-vault-service';
import { vaultExportService } from '../services/vault-export-service';
import { providerService } from '../services/provider-service';

export function registerVaultHandlers(): void {
  registerHandler('vault:status', async () => {
    await vaultService.checkInitialized();
    return vaultService.getStatus();
  });

  registerHandler('vault:initialize', async ({ password }) => {
    await vaultService.initialize(password);
    // After vault initialization, activate providers
    await providerService.activateAllEnabled();
    return { success: true };
  });

  registerHandler('vault:unlock', async ({ password }) => {
    const success = await vaultService.unlock(password);
    if (success) {
      // After unlock, activate providers that have stored configs
      await providerService.activateAllEnabled();
    }
    return { success };
  });

  registerHandler('vault:lock', async () => {
    vaultService.lock();
  });

  registerHandler('vault:change-password', async ({ currentPassword, newPassword }) => {
    const success = await vaultService.changePassword(
      currentPassword,
      newPassword,
      (decryptFn, encryptFn) => keyVaultService.reEncryptAll(decryptFn, encryptFn),
    );
    return { success };
  });

  registerHandler('vault:set-auto-lock', async ({ minutes }) => {
    await vaultService.setAutoLock(minutes);
  });

  registerHandler('vault:export', async () => {
    const success = await vaultExportService.exportVault();
    return { success };
  });

  registerHandler('vault:import', async () => {
    return vaultExportService.importVault();
  });
}

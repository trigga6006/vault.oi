import { registerHandler } from './register-all';
import { keyVaultService } from '../services/key-vault-service';

export function registerKeyHandlers(): void {
  registerHandler('keys:list', async () => {
    return keyVaultService.listKeys();
  });

  registerHandler('keys:store', async ({ providerId, apiKey, label, notes }) => {
    return keyVaultService.storeKey(providerId, apiKey, label, notes);
  });

  registerHandler('keys:update', async ({ id, label, notes, isActive }) => {
    await keyVaultService.updateKey(id, { label, notes, isActive });
  });

  registerHandler('keys:rotate', async ({ id, newKey }) => {
    await keyVaultService.rotateKey(id, newKey);
  });

  registerHandler('keys:delete', async ({ id }) => {
    await keyVaultService.deleteKey(id);
  });

  registerHandler('keys:test', async ({ providerId, apiKey }) => {
    // Test by making a lightweight API call
    try {
      const { providerRegistry } = await import('../../providers/registry');
      const adapter = providerRegistry.getActive(providerId);

      if (!adapter) {
        // Try to activate temporarily
        const { providerRegistry: reg } = await import('../../providers/registry');
        await reg.activate(providerId, { apiKey });
        const tempAdapter = reg.getActive(providerId);
        if (!tempAdapter) {
          return { success: false, message: 'Could not activate provider' };
        }
        const health = await tempAdapter.healthCheck();
        return {
          success: health.status === 'healthy' || health.status === 'degraded',
          message: health.message ?? health.status,
        };
      }

      const health = await adapter.healthCheck();
      return {
        success: health.status === 'healthy' || health.status === 'degraded',
        message: health.message ?? health.status,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      };
    }
  });
}

import { registerHandler } from './register-all';
import { providerConfigRepo } from '../database/repositories/provider-config.repo';

export function registerConfigHandlers(): void {
  registerHandler('config:list-providers', async () => {
    return providerConfigRepo.getAll();
  });

  registerHandler('config:get-provider', async (payload) => {
    return providerConfigRepo.getById(payload.providerId);
  });

  registerHandler('config:save-provider', async (config) => {
    await providerConfigRepo.upsert(config);
  });
}

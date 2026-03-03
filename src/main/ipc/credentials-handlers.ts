import { registerHandler } from './register-all';
import { credentialsService } from '../services/credentials-service';

export function registerCredentialsHandlers(): void {
  registerHandler('credentials:list', async () => {
    return credentialsService.list();
  });

  registerHandler('credentials:create', async (payload) => {
    return credentialsService.create(payload);
  });

  registerHandler('credentials:update', async (payload) => {
    await credentialsService.update(payload);
  });

  registerHandler('credentials:delete', async ({ id }) => {
    await credentialsService.delete(id);
  });

  registerHandler('credentials:get-password', async ({ id }) => {
    const password = await credentialsService.getPassword(id);
    return { password };
  });

  registerHandler('credentials:generate-password', async ({ length }) => {
    return { password: credentialsService.generatePassword(length) };
  });
}

import { registerHandler } from './register-all';
import { profileService } from '../services/profile-service';

export function registerProfileHandlers(): void {
  registerHandler('profiles:get-state', async () => {
    return profileService.getState();
  });

  registerHandler('profiles:create', async ({ name }) => {
    return profileService.createProfile(name);
  });

  registerHandler('profiles:switch', async ({ profileId }) => {
    await profileService.switchProfile(profileId);
    return { success: true };
  });
}

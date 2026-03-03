import { registerHandler } from './register-all';
import { keyRotationService } from '../services/key-rotation-service';
import { pricingUpdateService } from '../services/pricing-update-service';

export function registerRotationHandlers(): void {
  registerHandler('keys:rotation-policies', async () => {
    return keyRotationService.getPolicies();
  });

  registerHandler('keys:set-rotation-policy', async (data) => {
    keyRotationService.setPolicy(data);
  });

  registerHandler('keys:check-rotations', async () => {
    return keyRotationService.checkRotations();
  });
}

export function registerPricingUpdateHandlers(): void {
  registerHandler('pricing:check-updates', async () => {
    return pricingUpdateService.checkForUpdates();
  });

  registerHandler('pricing:apply-updates', async () => {
    return pricingUpdateService.checkForUpdates();
  });

  registerHandler('pricing:set-auto-update', async ({ enabled }) => {
    pricingUpdateService.setAutoUpdate(enabled);
  });
}

import { registerHandler } from './register-all';
import { alertRepo } from '../database/repositories/alert.repo';

export function registerAlertHandlers(): void {
  registerHandler('alerts:list-rules', async () => {
    return alertRepo.getAllRules();
  });

  registerHandler('alerts:save-rule', async (rule) => {
    await alertRepo.upsertRule(rule);
  });

  registerHandler('alerts:list-events', async (params) => {
    return alertRepo.getEvents({
      ruleId: params.ruleId,
      limit: params.limit,
    });
  });
}

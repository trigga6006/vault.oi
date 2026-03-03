import { registerHandler } from './register-all';
import { requestLogRepo } from '../database/repositories/request-log.repo';
import { errorRecordRepo } from '../database/repositories/error-record.repo';

export function registerLogsHandlers(): void {
  registerHandler('logs:query', async (query) => {
    return requestLogRepo.query({
      providerId: query.providerId,
      model: query.model,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit,
      offset: query.offset,
    });
  });

  registerHandler('logs:errors', async (query) => {
    return errorRecordRepo.query({
      providerId: query.providerId,
      errorCode: query.errorCode,
      limit: query.limit,
      offset: query.offset,
    });
  });
}

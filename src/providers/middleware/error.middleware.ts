import type { CompletionMiddleware, MiddlewareContext, CompletionResponse, NextFunction } from '../../shared/types/provider.types';
import { providerRegistry } from '../registry';
import { errorRecordRepo } from '../../main/database/repositories/error-record.repo';

export const errorMiddleware: CompletionMiddleware = {
  name: 'error-normalization',
  priority: 5, // Outermost — catches everything
  async execute(ctx: MiddlewareContext, next: NextFunction): Promise<CompletionResponse> {
    try {
      return await next(ctx);
    } catch (rawError) {
      const adapter = providerRegistry.getActive(ctx.request.providerId);
      const normalized = adapter
        ? adapter.normalizeError(rawError)
        : {
            code: 'unknown',
            message: String(rawError),
            retryable: false,
            raw: rawError,
          };

      // Record the error
      try {
        await errorRecordRepo.insert({
          providerId: ctx.request.providerId,
          model: ctx.request.model,
          errorCode: String(normalized.code),
          statusCode: normalized.statusCode ?? null,
          message: normalized.message,
          rawResponse: JSON.stringify(normalized.raw),
          retryable: normalized.retryable,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[ErrorMiddleware] Failed to record error:', err);
      }

      throw normalized;
    }
  },
};

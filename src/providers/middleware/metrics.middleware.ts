import type { CompletionMiddleware, MiddlewareContext, CompletionResponse, NextFunction } from '../../shared/types/provider.types';
import { requestLogRepo } from '../../main/database/repositories/request-log.repo';

export const metricsMiddleware: CompletionMiddleware = {
  name: 'metrics',
  priority: 20,
  async execute(ctx: MiddlewareContext, next: NextFunction): Promise<CompletionResponse> {
    const { request } = ctx;
    const now = new Date().toISOString();

    // Create a pending log entry
    let logId: number | null = null;
    try {
      const [entry] = await requestLogRepo.insert({
        providerId: request.providerId,
        model: request.model,
        requestBody: JSON.stringify(request),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        status: 'pending',
        streamed: request.stream ?? false,
        createdAt: now,
      });
      logId = entry.id;
    } catch (err) {
      console.warn('[MetricsMiddleware] Failed to create request log:', err);
    }

    try {
      const response = await next(ctx);

      // Update with success
      if (logId) {
        try {
          await requestLogRepo.updateResponse(logId, {
            promptTokens: response.inputTokens,
            completionTokens: response.outputTokens,
            totalTokens: response.totalTokens,
            latencyMs: response.latencyMs,
            costUsd: response.costUsd ?? null,
            status: 'success',
            completedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('[MetricsMiddleware] Failed to update request log:', err);
        }
      }

      return response;
    } catch (error) {
      // Update with error
      if (logId) {
        try {
          await requestLogRepo.updateResponse(logId, {
            status: 'error',
            errorCode: (error as any)?.code ?? 'unknown',
            completedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('[MetricsMiddleware] Failed to update error log:', err);
        }
      }
      throw error;
    }
  },
};

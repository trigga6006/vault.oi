import type { CompletionMiddleware, MiddlewareContext, CompletionResponse, NextFunction } from '../../shared/types/provider.types';

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const retryMiddleware: CompletionMiddleware = {
  name: 'retry',
  priority: 30,
  async execute(ctx: MiddlewareContext, next: NextFunction): Promise<CompletionResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await next(ctx);
      } catch (error: any) {
        lastError = error;
        const statusCode = error?.status ?? error?.statusCode;
        const isRetryable = RETRYABLE_STATUS_CODES.has(statusCode) ||
          error?.code === 'ECONNRESET' ||
          error?.code === 'ETIMEDOUT';

        if (!isRetryable || attempt === MAX_RETRIES) {
          throw error;
        }

        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
        console.log(
          `[RetryMiddleware] Attempt ${attempt + 1}/${MAX_RETRIES} failed (${statusCode ?? error?.code}), retrying in ${delay.toFixed(0)}ms`,
        );
        await sleep(delay);
      }
    }

    throw lastError;
  },
};

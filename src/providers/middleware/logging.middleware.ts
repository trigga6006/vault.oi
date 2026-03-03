import type { CompletionMiddleware, MiddlewareContext, CompletionResponse, NextFunction } from '../../shared/types/provider.types';

export const loggingMiddleware: CompletionMiddleware = {
  name: 'logging',
  priority: 10,
  async execute(ctx: MiddlewareContext, next: NextFunction): Promise<CompletionResponse> {
    const { request } = ctx;
    console.log(`[Completion] ${request.providerId}/${request.model} — starting`);

    try {
      const response = await next(ctx);
      console.log(
        `[Completion] ${request.providerId}/${request.model} — ${response.totalTokens} tokens, ${response.latencyMs}ms`,
      );
      return response;
    } catch (error) {
      console.error(`[Completion] ${request.providerId}/${request.model} — error:`, error);
      throw error;
    }
  },
};

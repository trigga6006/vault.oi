import type {
  CompletionMiddleware,
  MiddlewareContext,
  CompletionRequest,
  CompletionResponse,
  NextFunction,
  IProviderAdapter,
} from '../../shared/types/provider.types';

export class MiddlewarePipeline {
  private middlewares: CompletionMiddleware[] = [];

  use(middleware: CompletionMiddleware): this {
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => a.priority - b.priority);
    return this;
  }

  remove(name: string): this {
    this.middlewares = this.middlewares.filter((m) => m.name !== name);
    return this;
  }

  async execute(
    request: CompletionRequest,
    adapter: IProviderAdapter,
  ): Promise<CompletionResponse> {
    const ctx: MiddlewareContext = {
      request,
      metadata: { providerId: adapter.providerId },
      startTime: Date.now(),
    };

    const finalHandler: NextFunction = async (c) => {
      return adapter.complete(c.request);
    };

    const chain = this.middlewares.reduceRight<NextFunction>(
      (next, middleware) => {
        return async (c) => middleware.execute(c, next);
      },
      finalHandler,
    );

    return chain(ctx);
  }
}

export const completionPipeline = new MiddlewarePipeline();

import { registerHandler } from './register-all';
import { providerRegistry } from '../../providers/registry';
import { providerService } from '../services/provider-service';
import { completionPipeline } from '../../providers/middleware/pipeline';

export function registerProviderHandlers(): void {
  registerHandler('provider:list-registered', async () => {
    return providerRegistry.getRegisteredSummaries();
  });

  registerHandler('provider:activate', async (payload) => {
    try {
      await providerService.saveProvider(
        payload.providerId,
        payload.providerId, // displayName will be set from registry
        payload.credentials,
        payload.config,
      );
      await providerRegistry.activate(
        payload.providerId,
        payload.credentials,
        payload.config,
      );
      return { success: true };
    } catch (error) {
      console.error('[IPC] provider:activate error:', error);
      return { success: false };
    }
  });

  registerHandler('provider:deactivate', async (payload) => {
    try {
      await providerRegistry.deactivate(payload.providerId);
      return { success: true };
    } catch (error) {
      console.error('[IPC] provider:deactivate error:', error);
      return { success: false };
    }
  });

  registerHandler('provider:health-check', async (payload) => {
    const adapter = providerRegistry.getActive(payload.providerId);
    if (!adapter) {
      return {
        status: 'unknown' as const,
        latencyMs: 0,
        message: 'Provider not active',
        checkedAt: new Date().toISOString(),
      };
    }
    return adapter.healthCheck();
  });

  registerHandler('provider:list-models', async (payload) => {
    const adapter = providerRegistry.getActive(payload.providerId);
    if (!adapter) return [];
    return adapter.listModels();
  });

  registerHandler('completion:send', async (request) => {
    const adapter = providerRegistry.getActive(request.providerId);
    if (!adapter) {
      throw new Error(`Provider ${request.providerId} is not active`);
    }
    return completionPipeline.execute(request, adapter);
  });

  registerHandler('completion:stream-start', async (request) => {
    const adapter = providerRegistry.getActive(request.providerId);
    if (!adapter) {
      throw new Error(`Provider ${request.providerId} is not active`);
    }
    const handle = await adapter.completeStream(request);
    return { streamId: handle.streamId };
  });
}

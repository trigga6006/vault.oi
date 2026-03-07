import { registerHandler } from './register-all';
import { proxyService } from '../services/proxy-service';

export function registerProxyHandlers(): void {
  registerHandler('proxy:start', async (payload) => {
    return proxyService.start(payload.port);
  });

  registerHandler('proxy:stop', async () => {
    await proxyService.stop();
  });

  registerHandler('proxy:status', async () => {
    return proxyService.getStatus();
  });

  registerHandler('proxy:set-log-bodies', async ({ enabled }) => {
    proxyService.setLogBodies(enabled);
  });
}

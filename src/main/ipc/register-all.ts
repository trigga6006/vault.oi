import { ipcMain } from 'electron';
import type { IpcChannelMap, IpcChannel } from '../../shared/types/ipc.types';

type Handler<C extends IpcChannel> = (
  payload: IpcChannelMap[C]['req']
) => Promise<IpcChannelMap[C]['res']> | IpcChannelMap[C]['res'];

const handlers = new Map<string, Handler<any>>();

export function registerHandler<C extends IpcChannel>(
  channel: C,
  handler: Handler<C>,
): void {
  handlers.set(channel, handler);
  ipcMain.handle(channel, async (_event, payload) => {
    const fn = handlers.get(channel);
    if (!fn) throw new Error(`No handler for channel: ${channel}`);
    return fn(payload);
  });
}

import { registerProviderHandlers } from './provider-handlers';
import { registerUsageHandlers } from './usage-handlers';
import { registerConfigHandlers } from './config-handlers';
import { registerMetricsHandlers } from './metrics-handlers';
import { registerLogsHandlers } from './logs-handlers';
import { registerAlertHandlers } from './alert-handlers';
import { registerProxyHandlers } from './proxy-handlers';
import { registerVaultHandlers } from './vault-handlers';
import { registerKeyHandlers } from './key-handlers';
import { registerProjectHandlers } from './project-handlers';
import { registerRotationHandlers, registerPricingUpdateHandlers } from './rotation-handlers';

export function registerAllHandlers(): void {
  registerVaultHandlers();
  registerKeyHandlers();
  registerProviderHandlers();
  registerUsageHandlers();
  registerConfigHandlers();
  registerMetricsHandlers();
  registerLogsHandlers();
  registerAlertHandlers();
  registerProxyHandlers();
  registerProjectHandlers();
  registerRotationHandlers();
  registerPricingUpdateHandlers();

  console.log('[IPC] All handlers registered');
}

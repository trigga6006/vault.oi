import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannelMap, IpcChannel, IpcEventChannel } from '../shared/types/ipc.types';

const INVOKE_CHANNELS = new Set<IpcChannel>([
  'provider:list-registered',
  'provider:activate',
  'provider:deactivate',
  'provider:health-check',
  'provider:list-models',
  'usage:fetch',
  'usage:fetch-all',
  'completion:send',
  'completion:stream-start',
  'metrics:query',
  'metrics:summary',
  'logs:query',
  'logs:errors',
  'alerts:list-rules',
  'alerts:save-rule',
  'alerts:list-events',
  'proxy:start',
  'proxy:stop',
  'proxy:status',
  'config:get-provider',
  'config:save-provider',
  'config:list-providers',
  'pricing:calculate',
  'vault:status',
  'vault:initialize',
  'vault:unlock',
  'vault:lock',
  'vault:change-password',
  'vault:set-auto-lock',
  'vault:export',
  'vault:import',
  'vault:import-secrets',
  'keys:list',
  'keys:store',
  'keys:update',
  'keys:rotate',
  'keys:delete',
  'keys:test',
  'keys:get-plaintext',
  'projects:list',
  'projects:get',
  'projects:create',
  'projects:update',
  'projects:delete',
  'projects:assign-key',
  'projects:unassign-key',
  'projects:get-keys',
  'projects:set-active',
  'keys:rotation-policies',
  'keys:set-rotation-policy',
  'keys:check-rotations',
  'pricing:check-updates',
  'pricing:apply-updates',
  'pricing:set-auto-update',
  'credentials:list',
  'credentials:create',
  'credentials:update',
  'credentials:delete',
  'credentials:get-password',
  'credentials:generate-password',
]);

const EVENT_CHANNELS = new Set<IpcEventChannel>(['vault:locked', 'key:rotation-reminder']);

type OmniViewApi = {
  invoke: <C extends IpcChannel>(
    channel: C,
    payload: IpcChannelMap[C]['req'],
  ) => Promise<IpcChannelMap[C]['res']>;
  on: (channel: IpcEventChannel, callback: (...args: unknown[]) => void) => () => void;
  platform: NodeJS.Platform;
};

const api: OmniViewApi = {
  invoke: (channel, payload) => {
    if (!INVOKE_CHANNELS.has(channel)) {
      throw new Error(`Blocked invoke for unknown channel: ${channel}`);
    }

    return ipcRenderer.invoke(channel, payload);
  },
  on: (channel, callback) => {
    if (!EVENT_CHANNELS.has(channel)) {
      throw new Error(`Blocked event subscription for unknown channel: ${channel}`);
    }

    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('omniview', api);

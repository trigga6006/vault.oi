import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannelMap, IpcChannel } from '../shared/types/ipc.types';

type OmniViewApi = {
  invoke: <C extends IpcChannel>(
    channel: C,
    payload: IpcChannelMap[C]['req'],
  ) => Promise<IpcChannelMap[C]['res']>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  platform: NodeJS.Platform;
};

const api: OmniViewApi = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, callback) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('omniview', api);

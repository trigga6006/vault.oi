import type { IpcChannel, IpcChannelMap, IpcEventChannel } from '../shared/types/ipc.types';

declare global {
  interface Window {
    omniview: {
      invoke: <C extends IpcChannel>(
        channel: C,
        payload: IpcChannelMap[C]['req'],
      ) => Promise<IpcChannelMap[C]['res']>;
      on: (channel: IpcEventChannel, callback: (...args: unknown[]) => void) => () => void;
      platform: NodeJS.Platform;
    };
  }
}

export {};

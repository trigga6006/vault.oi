import { registerHandler } from './register-all';
import { graphService } from '../services/graph-service';

export function registerGraphHandlers(): void {
  registerHandler('graph:get-map', async (focus) => {
    return graphService.getMap(focus);
  });
}

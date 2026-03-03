import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class CohereAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'cohere',
      displayName: 'Cohere',
      defaultBaseUrl: 'https://api.cohere.com/compatibility/v1',
      fallbackModels: [
        { id: 'command-r-plus', name: 'Command R+' },
        { id: 'command-r', name: 'Command R' },
        { id: 'command', name: 'Command' },
        { id: 'command-light', name: 'Command Light' },
      ],
    });
  }
}

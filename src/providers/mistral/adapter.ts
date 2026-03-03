import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class MistralAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'mistral',
      displayName: 'Mistral AI',
      defaultBaseUrl: 'https://api.mistral.ai/v1',
      fallbackModels: [
        { id: 'mistral-large-latest', name: 'Mistral Large' },
        { id: 'mistral-medium-latest', name: 'Mistral Medium' },
        { id: 'mistral-small-latest', name: 'Mistral Small' },
        { id: 'codestral-latest', name: 'Codestral' },
      ],
    });
  }
}

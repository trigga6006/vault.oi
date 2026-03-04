import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class AzureAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'azure',
      displayName: 'Azure',
      defaultBaseUrl: 'https://api.openai.azure.com/v1',
      fallbackModels: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      ],
    });
  }
}

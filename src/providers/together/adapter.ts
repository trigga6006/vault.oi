import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class TogetherAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'together',
      displayName: 'Together AI',
      defaultBaseUrl: 'https://api.together.xyz/v1',
      fallbackModels: [
        { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B Instruct Turbo' },
        { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B Instruct Turbo' },
        { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', name: 'Mixtral 8x22B Instruct' },
      ],
    });
  }
}

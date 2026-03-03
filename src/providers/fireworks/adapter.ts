import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class FireworksAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'fireworks',
      displayName: 'Fireworks AI',
      defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
      fallbackModels: [
        { id: 'accounts/fireworks/models/llama-v3p1-405b-instruct', name: 'Llama 3.1 405B Instruct' },
        { id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', name: 'Llama 3.1 70B Instruct' },
        { id: 'accounts/fireworks/models/mixtral-8x22b-instruct', name: 'Mixtral 8x22B Instruct' },
        { id: 'accounts/fireworks/models/heretic-l3.1-70b', name: 'Heretic Llama 3.1 70B' },
      ],
    });
  }
}

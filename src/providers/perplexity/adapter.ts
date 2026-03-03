import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class PerplexityAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'perplexity',
      displayName: 'Perplexity',
      defaultBaseUrl: 'https://api.perplexity.ai',
      fallbackModels: [
        { id: 'sonar-pro', name: 'Sonar Pro' },
        { id: 'sonar', name: 'Sonar' },
        { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro' },
        { id: 'sonar-reasoning', name: 'Sonar Reasoning' },
      ],
    });
  }
}

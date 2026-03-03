import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class XAIAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'xai',
      displayName: 'xAI (Grok)',
      defaultBaseUrl: 'https://api.x.ai/v1',
      fallbackModels: [
        { id: 'grok-3', name: 'Grok 3' },
        { id: 'grok-3-mini', name: 'Grok 3 Mini' },
        { id: 'grok-2', name: 'Grok 2' },
      ],
    });
  }
}

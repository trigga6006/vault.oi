import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class OpenRouterAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'openrouter',
      displayName: 'OpenRouter',
      defaultBaseUrl: 'https://openrouter.ai/api/v1',
      fallbackModels: [
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp' },
        { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct' },
      ],
    });
  }
}

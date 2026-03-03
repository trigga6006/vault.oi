import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class OllamaAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'ollama',
      displayName: 'Ollama (Local)',
      defaultBaseUrl: 'http://localhost:11434/v1',
      fallbackModels: [
        { id: 'llama3.1', name: 'Llama 3.1' },
        { id: 'mistral', name: 'Mistral' },
        { id: 'codellama', name: 'Code Llama' },
        { id: 'phi3', name: 'Phi-3' },
      ],
      supportedAuthMethods: [],
    });
  }

  /**
   * Ollama runs locally and does not require an API key.
   * We pass a dummy key to satisfy the OpenAI client constructor.
   */
  protected getApiKey(): string {
    return 'ollama';
  }
}

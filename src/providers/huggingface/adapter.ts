import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class HuggingFaceAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'huggingface',
      displayName: 'HuggingFace',
      defaultBaseUrl: 'https://api-inference.huggingface.co/v1',
      fallbackModels: [
        { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B' },
        { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B' },
        { id: 'microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3 Mini' },
      ],
    });
  }
}

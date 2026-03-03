import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class DeepSeekAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'deepseek',
      displayName: 'DeepSeek',
      defaultBaseUrl: 'https://api.deepseek.com/v1',
      fallbackModels: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
        { id: 'deepseek-coder', name: 'DeepSeek Coder' },
      ],
    });
  }
}

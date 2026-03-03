import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class QwenAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'qwen',
      displayName: 'Qwen',
      defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      fallbackModels: [
        { id: 'qwen-max', name: 'Qwen Max' },
        { id: 'qwen-plus', name: 'Qwen Plus' },
        { id: 'qwen-turbo', name: 'Qwen Turbo' },
        { id: 'qwen-long', name: 'Qwen Long' },
      ],
    });
  }
}

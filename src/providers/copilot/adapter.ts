import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class CopilotAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'copilot',
      displayName: 'GitHub Copilot',
      defaultBaseUrl: 'https://api.githubcopilot.com',
      fallbackModels: [
        { id: 'gpt-4o', name: 'GPT-4o (Copilot)' },
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Copilot)' },
      ],
    });
  }
}

import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class CursorAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'cursor',
      displayName: 'Cursor',
      defaultBaseUrl: 'https://api.cursor.com/v1',
      fallbackModels: [
        { id: 'cursor-small', name: 'Cursor Small' },
        { id: 'gpt-4', name: 'GPT-4 (Cursor)' },
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Cursor)' },
      ],
    });
  }
}

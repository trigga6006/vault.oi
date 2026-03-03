import { OpenAICompatibleAdapter } from '../openai-compatible/adapter';

export class GoogleAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      providerId: 'google',
      displayName: 'Google Gemini',
      defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      fallbackModels: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      ],
    });
  }
}

import type { CompletionMessage } from '../../shared/types/provider.types';

export function toOpenAIMessages(messages: CompletionMessage[]) {
  return messages.map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
  }));
}

import type { CompletionMessage } from '../../shared/types/provider.types';

export function toAnthropicMessages(messages: CompletionMessage[]) {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  const system = systemMessages.map((m) => m.content).join('\n') || undefined;

  const mapped = nonSystemMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return { system, messages: mapped };
}

import { providerRegistry } from './registry';
import { PROVIDER_IDS } from '../shared/constants/provider-ids';
import { AnthropicAdapter } from './anthropic/adapter';
import { OpenAIAdapter } from './openai/adapter';
import { FireworksAdapter } from './fireworks/adapter';
import { GoogleAdapter } from './google/adapter';
import { PerplexityAdapter } from './perplexity/adapter';
import { XAIAdapter } from './xai/adapter';
import { OllamaAdapter } from './ollama/adapter';
import { OpenRouterAdapter } from './openrouter/adapter';
import { MistralAdapter } from './mistral/adapter';
import { TogetherAdapter } from './together/adapter';
import { DeepSeekAdapter } from './deepseek/adapter';
import { QwenAdapter } from './qwen/adapter';
import { HuggingFaceAdapter } from './huggingface/adapter';
import { CopilotAdapter } from './copilot/adapter';
import { CohereAdapter } from './cohere/adapter';
import { CursorAdapter } from './cursor/adapter';

export function bootstrapProviders(): void {
  providerRegistry.register(PROVIDER_IDS.ANTHROPIC, 'Anthropic', () => new AnthropicAdapter());
  providerRegistry.register(PROVIDER_IDS.OPENAI, 'OpenAI', () => new OpenAIAdapter());
  providerRegistry.register(PROVIDER_IDS.FIREWORKS, 'Fireworks AI', () => new FireworksAdapter());
  providerRegistry.register(PROVIDER_IDS.GOOGLE, 'Google Gemini', () => new GoogleAdapter());
  providerRegistry.register(PROVIDER_IDS.PERPLEXITY, 'Perplexity', () => new PerplexityAdapter());
  providerRegistry.register(PROVIDER_IDS.XAI, 'xAI (Grok)', () => new XAIAdapter());
  providerRegistry.register(PROVIDER_IDS.OLLAMA, 'Ollama (Local)', () => new OllamaAdapter());
  providerRegistry.register(PROVIDER_IDS.OPENROUTER, 'OpenRouter', () => new OpenRouterAdapter());
  providerRegistry.register(PROVIDER_IDS.MISTRAL, 'Mistral AI', () => new MistralAdapter());
  providerRegistry.register(PROVIDER_IDS.TOGETHER, 'Together AI', () => new TogetherAdapter());
  providerRegistry.register(PROVIDER_IDS.DEEPSEEK, 'DeepSeek', () => new DeepSeekAdapter());
  providerRegistry.register(PROVIDER_IDS.QWEN, 'Qwen', () => new QwenAdapter());
  providerRegistry.register(PROVIDER_IDS.HUGGINGFACE, 'HuggingFace', () => new HuggingFaceAdapter());
  providerRegistry.register(PROVIDER_IDS.COPILOT, 'GitHub Copilot', () => new CopilotAdapter());
  providerRegistry.register(PROVIDER_IDS.COHERE, 'Cohere', () => new CohereAdapter());
  providerRegistry.register(PROVIDER_IDS.CURSOR, 'Cursor', () => new CursorAdapter());

  console.log(
    `[Bootstrap] Registered ${providerRegistry.getRegisteredIds().length} providers:`,
    providerRegistry.getRegisteredIds().join(', '),
  );
}

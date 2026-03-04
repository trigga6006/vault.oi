import { PROVIDER_IDS } from './provider-ids';

export const PROVIDER_INFERENCE_HINTS: Array<{ pattern: RegExp; providerId: string }> = [
  { pattern: /OPENAI/i, providerId: PROVIDER_IDS.OPENAI },
  { pattern: /AZURE/i, providerId: PROVIDER_IDS.AZURE },
  { pattern: /ANTHROPIC|CLAUDE/i, providerId: PROVIDER_IDS.ANTHROPIC },
  { pattern: /GEMINI|GOOGLE/i, providerId: PROVIDER_IDS.GOOGLE },
  { pattern: /XAI|GROK/i, providerId: PROVIDER_IDS.XAI },
  { pattern: /MISTRAL/i, providerId: PROVIDER_IDS.MISTRAL },
  { pattern: /COHERE/i, providerId: PROVIDER_IDS.COHERE },
  { pattern: /TOGETHER/i, providerId: PROVIDER_IDS.TOGETHER },
  { pattern: /FIREWORKS/i, providerId: PROVIDER_IDS.FIREWORKS },
  { pattern: /HUGGING ?FACE|HF_/i, providerId: PROVIDER_IDS.HUGGINGFACE },
  { pattern: /PERPLEXITY/i, providerId: PROVIDER_IDS.PERPLEXITY },
  { pattern: /OLLAMA/i, providerId: PROVIDER_IDS.OLLAMA },
  { pattern: /OPENROUTER/i, providerId: PROVIDER_IDS.OPENROUTER },
  { pattern: /DEEPSEEK/i, providerId: PROVIDER_IDS.DEEPSEEK },
  { pattern: /QWEN|DASHSCOPE/i, providerId: PROVIDER_IDS.QWEN },
  { pattern: /COPILOT/i, providerId: PROVIDER_IDS.COPILOT },
  { pattern: /CURSOR/i, providerId: PROVIDER_IDS.CURSOR },
  { pattern: /GITHUB/i, providerId: PROVIDER_IDS.GITHUB },
  { pattern: /MOONSHOT|KIMI/i, providerId: PROVIDER_IDS.MOONSHOT },
  { pattern: /EXA/i, providerId: PROVIDER_IDS.EXA },
  { pattern: /CLOUDFLARE|CF_/i, providerId: PROVIDER_IDS.CLOUDFLARE },
  { pattern: /NANO[_-]?BANANA/i, providerId: PROVIDER_IDS.NANOBANANA },
  { pattern: /TAVILY/i, providerId: PROVIDER_IDS.TAVILY },
  { pattern: /OPENCLAW/i, providerId: PROVIDER_IDS.OPENCLAW },
  { pattern: /META(?:_|$)|LLAMA/i, providerId: PROVIDER_IDS.META },
  { pattern: /AWS|AMAZON|S3_/i, providerId: PROVIDER_IDS.AWS },
  { pattern: /N8N/i, providerId: PROVIDER_IDS.N8N },
];

export function inferKnownProviderId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  for (const hint of PROVIDER_INFERENCE_HINTS) {
    if (hint.pattern.test(text)) {
      return hint.providerId;
    }
  }

  return null;
}

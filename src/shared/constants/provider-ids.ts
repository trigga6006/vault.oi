export const PROVIDER_IDS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GOOGLE: 'google',
  XAI: 'xai',
  MISTRAL: 'mistral',
  COHERE: 'cohere',
  TOGETHER: 'together',
  FIREWORKS: 'fireworks',
  HUGGINGFACE: 'huggingface',
  MANUS: 'manus',
  PERPLEXITY: 'perplexity',
  OLLAMA: 'ollama',
  OPENROUTER: 'openrouter',
  DEEPSEEK: 'deepseek',
  QWEN: 'qwen',
  COPILOT: 'copilot',
  CURSOR: 'cursor',
} as const;

export type ProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

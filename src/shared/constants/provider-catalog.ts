export interface ProviderCatalogEntry {
  id: string;
  name: string;
  keyPlaceholder: string;
  logoFile?: string;
  lightModeLogoFile?: string;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  { id: 'anthropic', name: 'Anthropic', keyPlaceholder: 'sk-ant-...', logoFile: 'claude-color.png' },
  { id: 'azure', name: 'Azure OpenAI', keyPlaceholder: 'api key / connection string', logoFile: 'azure-color.png' },
  { id: 'openai', name: 'OpenAI', keyPlaceholder: 'sk-...', logoFile: 'openai.png', lightModeLogoFile: 'openaidark.png' },
  { id: 'fireworks', name: 'Fireworks AI', keyPlaceholder: 'fw_...', logoFile: 'fireworks-color.png' },
  { id: 'google', name: 'Google Gemini', keyPlaceholder: 'AIza...', logoFile: 'gemini-color.png' },
  { id: 'perplexity', name: 'Perplexity', keyPlaceholder: 'pplx-...', logoFile: 'perplexity-color.png' },
  { id: 'xai', name: 'xAI (Grok)', keyPlaceholder: 'xai-...', logoFile: 'grok.png', lightModeLogoFile: 'grokdark.png' },
  { id: 'ollama', name: 'Ollama (Local)', keyPlaceholder: 'No key needed', logoFile: 'ollamaladark.png', lightModeLogoFile: 'ollama.png' },
  { id: 'openrouter', name: 'OpenRouter', keyPlaceholder: 'sk-or-...', logoFile: 'openrouterdark.png', lightModeLogoFile: 'openrouterlight.png' },
  { id: 'mistral', name: 'Mistral AI', keyPlaceholder: 'sk-...', logoFile: 'mistral-color.png' },
  { id: 'together', name: 'Together AI', keyPlaceholder: 'sk-...' },
  { id: 'deepseek', name: 'DeepSeek', keyPlaceholder: 'sk-...', logoFile: 'deepseek-color.png' },
  { id: 'qwen', name: 'Qwen', keyPlaceholder: 'sk-...', logoFile: 'qwen-color.png' },
  { id: 'huggingface', name: 'HuggingFace', keyPlaceholder: 'hf_...', logoFile: 'huggingface-color.png' },
  { id: 'copilot', name: 'GitHub Copilot', keyPlaceholder: 'ghu_...', logoFile: 'copilot-color.png' },
  { id: 'cohere', name: 'Cohere', keyPlaceholder: 'sk-...', logoFile: 'cohere-color.png' },
  { id: 'cursor', name: 'Cursor', keyPlaceholder: 'sk-...', logoFile: 'cursor.png' },
  { id: 'moonshot', name: 'Moonshot AI', keyPlaceholder: 'sk-...', logoFile: 'moonshotdark.png', lightModeLogoFile: 'moonshotlight.png' },
  { id: 'exa', name: 'Exa', keyPlaceholder: 'exa_...', logoFile: 'exa-color.png' },
  { id: 'claude', name: 'Claude', keyPlaceholder: 'sk-ant-...', logoFile: 'claude-color.png' },
  { id: 'cloudflare', name: 'Cloudflare', keyPlaceholder: 'api token / account token', logoFile: 'cloudflare-color.png' },
  { id: 'nanobanana', name: 'Nano Banana', keyPlaceholder: 'sk-...', logoFile: 'nanobanana-color.png' },
  { id: 'tavily', name: 'Tavily', keyPlaceholder: 'tvly-...', logoFile: 'tavily-color.png' },
  { id: 'github', name: 'GitHub', keyPlaceholder: 'github_pat_...', logoFile: 'githubdark.png', lightModeLogoFile: 'githublight.png' },
  { id: 'openclaw', name: 'OpenClaw', keyPlaceholder: 'sk-...', logoFile: 'openclaw-color.png' },
  { id: 'meta', name: 'Meta', keyPlaceholder: 'access token / api key', logoFile: 'meta-color.png' },
  { id: 'aws', name: 'AWS', keyPlaceholder: 'access key / secret', logoFile: 'aws-color.png' },
  { id: 'n8n', name: 'n8n', keyPlaceholder: 'api key / personal token', logoFile: 'n8n-color.png' },
];

export const PROVIDER_CATALOG_BY_ID = Object.fromEntries(
  PROVIDER_CATALOG.map((provider) => [provider.id, provider]),
) as Record<string, ProviderCatalogEntry>;

export const PROVIDER_NAME_BY_ID = Object.fromEntries(
  PROVIDER_CATALOG.map((provider) => [provider.id, provider.name]),
) as Record<string, string>;

export function normalizeProviderCatalogId(providerId: string): string {
  const normalized = providerId.toLowerCase();
  return normalized.startsWith('azure') ? 'azure' : normalized;
}

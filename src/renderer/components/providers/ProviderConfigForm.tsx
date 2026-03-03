import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/cn';
import { ProviderLogo } from './ProviderLogo';
import { useUiStore } from '../../store/ui-store';

const AVAILABLE_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'fireworks', name: 'Fireworks AI' },
  { id: 'google', name: 'Google Gemini' },
  { id: 'perplexity', name: 'Perplexity' },
  { id: 'xai', name: 'xAI (Grok)' },
  { id: 'ollama', name: 'Ollama (Local)' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'mistral', name: 'Mistral AI' },
  { id: 'together', name: 'Together AI' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'qwen', name: 'Qwen' },
  { id: 'huggingface', name: 'HuggingFace' },
  { id: 'copilot', name: 'GitHub Copilot' },
  { id: 'cohere', name: 'Cohere' },
  { id: 'cursor', name: 'Cursor' },
];

interface ProviderConfigFormProps {
  onSaved: () => void;
  onCancel: () => void;
  editProviderId?: string;
}

export function ProviderConfigForm({ onSaved, onCancel, editProviderId }: ProviderConfigFormProps) {
  const [providerId, setProviderId] = useState(editProviderId ?? '');
  const [baseUrl, setBaseUrl] = useState('');
  const [fetchInterval, setFetchInterval] = useState(5);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);
  const { setActiveView } = useUiStore();

  const selectedProvider = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);

  async function handleTestConnection() {
    if (!providerId) return;
    setTesting(true);
    setTestResult(null);

    try {
      const health = await window.omniview.invoke('provider:health-check', { providerId }) as { status: string; latencyMs?: number; message?: string };
      setTestResult(health.status === 'healthy' || health.status === 'degraded' ? 'success' : 'error');
      if (health.status === 'healthy') {
        toast.success(`Connected to ${selectedProvider?.name ?? providerId}`, {
          description: `Latency: ${health.latencyMs}ms`,
        });
      } else {
        toast.error(`Connection issue: ${health.message ?? health.status}`);
      }
    } catch (error) {
      setTestResult('error');
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!providerId) return;
    setSaving(true);

    try {
      await window.omniview.invoke('config:save-provider', {
        providerId,
        displayName: selectedProvider?.name ?? providerId,
        enabled: true,
        authMethod: 'api_key',
        encryptedCredentials: null,
        baseUrl: baseUrl || null,
        organizationId: null,
        usageFetchInterval: fetchInterval,
        lastUsageFetch: null,
        timeout: 30000,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success(`${selectedProvider?.name ?? providerId} configured`);
      onSaved();
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass rounded-xl p-6 space-y-5 max-w-lg"
    >
      <h2 className="text-lg font-semibold text-foreground">
        {editProviderId ? 'Edit Integration' : 'Add Integration'}
      </h2>

      {/* Provider selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Provider</label>
        {editProviderId ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
            <ProviderLogo providerId={editProviderId} size={20} />
            <span className="text-sm text-foreground">{selectedProvider?.name ?? editProviderId}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProviderId(p.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors text-left',
                  providerId === p.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                <ProviderLogo providerId={p.id} size={20} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* API Key is managed in the vault */}
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-3">
        <KeyRound className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-foreground">Secrets are managed separately</p>
          <p className="text-[11px] text-muted-foreground">
            Credentials stay encrypted locally and are injected by the gateway automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveView('vault')}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
        >
          Open Secrets
        </button>
      </div>

      {/* Base URL (optional) */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Base URL <span className="text-muted-foreground/60">(optional)</span>
        </label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.anthropic.com"
          className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Sync interval */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Background sync interval (minutes)
        </label>
        <input
          type="number"
          value={fetchInterval}
          onChange={(e) => setFetchInterval(Number(e.target.value))}
          min={1}
          max={1440}
          className="w-32 rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Test result indicator */}
      {testResult && (
        <div className="flex items-center gap-2 text-sm">
          {testResult === 'success' ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-green-400">Connection successful</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-red-400">Connection failed</span>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleTestConnection}
          disabled={!providerId || testing}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          {testing && <Loader2 className="h-4 w-4 animate-spin" />}
          Test Integration
        </button>
        <button
          onClick={handleSave}
          disabled={!providerId || saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

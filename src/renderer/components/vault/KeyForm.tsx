import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/cn';
import { ProviderLogo } from '../providers/ProviderLogo';

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'fireworks', name: 'Fireworks AI', placeholder: 'fw_...' },
  { id: 'google', name: 'Google Gemini', placeholder: 'AIza...' },
  { id: 'perplexity', name: 'Perplexity', placeholder: 'pplx-...' },
  { id: 'xai', name: 'xAI (Grok)', placeholder: 'xai-...' },
  { id: 'ollama', name: 'Ollama (Local)', placeholder: 'No key needed' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'mistral', name: 'Mistral AI', placeholder: 'sk-...' },
  { id: 'together', name: 'Together AI', placeholder: 'sk-...' },
  { id: 'deepseek', name: 'DeepSeek', placeholder: 'sk-...' },
  { id: 'qwen', name: 'Qwen', placeholder: 'sk-...' },
  { id: 'huggingface', name: 'HuggingFace', placeholder: 'hf_...' },
  { id: 'copilot', name: 'GitHub Copilot', placeholder: 'ghu_...' },
  { id: 'cohere', name: 'Cohere', placeholder: 'sk-...' },
  { id: 'cursor', name: 'Cursor', placeholder: 'sk-...' },
];

interface KeyFormProps {
  onSave: (data: { providerId: string; apiKey: string; label: string; notes: string }) => Promise<void>;
  onCancel: () => void;
  /** If set, this is a rotation form */
  rotateKeyId?: number;
  rotateProviderId?: string;
}

export function KeyForm({ onSave, onCancel, rotateKeyId, rotateProviderId }: KeyFormProps) {
  const [providerId, setProviderId] = useState(rotateProviderId ?? '');
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const selected = PROVIDERS.find((p) => p.id === providerId);
  const isRotation = rotateKeyId !== undefined;

  async function handleTest() {
    if (!providerId || !apiKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = (await window.omniview.invoke('keys:test', {
        providerId,
        apiKey,
      })) as { success: boolean; message?: string };
      setTestResult(result.success ? 'success' : 'error');
      if (result.success) {
        toast.success('Key is valid');
      } else {
        toast.error(result.message ?? 'Key validation failed');
      }
    } catch {
      setTestResult('error');
      toast.error('Key test failed');
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!providerId || !apiKey) return;
    setSaving(true);
    try {
      await onSave({ providerId, apiKey, label: label || 'Default', notes });
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
        {isRotation ? 'Rotate Key' : 'Add API Key'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Provider selector */}
        {!isRotation && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProviderId(p.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors text-left',
                    providerId === p.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                  )}
                >
                  <ProviderLogo providerId={p.id} size={20} />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {isRotation ? 'New API Key' : 'API Key'}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder={selected?.placeholder ?? 'Enter API key...'}
              className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 pr-10 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Label */}
        {!isRotation && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Label <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production, Personal"
              className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        {/* Notes */}
        {!isRotation && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Notes <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this key..."
              className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div className="flex items-center gap-2 text-sm">
            {testResult === 'success' ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-green-400">Key is valid</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-red-400">Key validation failed</span>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={!providerId || !apiKey || testing}
            className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Test Key
          </button>
          <button
            type="submit"
            disabled={!providerId || !apiKey || saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRotation ? 'Rotate' : 'Save Key'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

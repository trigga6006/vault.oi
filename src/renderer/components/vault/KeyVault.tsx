import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Eye, EyeOff, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { KeyCard } from './KeyCard';
import { KeyForm } from './KeyForm';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  fireworks: 'Fireworks AI',
  google: 'Google Gemini',
  perplexity: 'Perplexity',
  xai: 'xAI (Grok)',
  ollama: 'Ollama (Local)',
  openrouter: 'OpenRouter',
  mistral: 'Mistral AI',
  together: 'Together AI',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  huggingface: 'HuggingFace',
  copilot: 'GitHub Copilot',
  cohere: 'Cohere',
  cursor: 'Cursor',
};

const CLIPBOARD_CLEAR_SECONDS = 20;

export function KeyVault() {
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<{
    id: number;
    providerId: string;
  } | null>(null);
  const [revealTarget, setRevealTarget] = useState<ApiKeyMetadata | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [loadingSecret, setLoadingSecret] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const result = (await window.omniview.invoke(
        'keys:list',
        undefined,
      )) as ApiKeyMetadata[];
      setKeys(result);
    } catch {
      toast.error('Failed to load secrets');
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleSave(data: {
    providerId: string;
    apiKey: string;
    label: string;
    notes: string;
    serviceType: string;
    generatedWhere: string;
    expiresAt: string;
  }) {
    try {
      await window.omniview.invoke('keys:store', {
        providerId: data.providerId,
        apiKey: data.apiKey,
        label: data.label,
        notes: data.notes,
        serviceType: data.serviceType,
        generatedWhere: data.generatedWhere,
        expiresAt: data.expiresAt || undefined,
      });
      toast.success('Secret stored securely');
      setShowForm(false);
      await fetchKeys();
    } catch {
      toast.error('Failed to save secret');
    }
  }

  function handleRotate(id: number) {
    const key = keys.find((item) => item.id === id);
    if (key) {
      setRotateTarget({ id, providerId: key.providerId });
    }
  }

  async function handleRotateSave(data: { apiKey: string }) {
    if (!rotateTarget) return;
    try {
      await window.omniview.invoke('keys:rotate', {
        id: rotateTarget.id,
        newKey: data.apiKey,
      });
      toast.success('Secret rotated');
      setRotateTarget(null);
      await fetchKeys();
    } catch {
      toast.error('Failed to rotate secret');
    }
  }

  async function handleDelete(id: number) {
    try {
      await window.omniview.invoke('keys:delete', { id });
      toast.success('Secret deleted');
      await fetchKeys();
    } catch {
      toast.error('Failed to delete secret');
    }
  }

  async function handleToggleActive(id: number, isActive: boolean) {
    try {
      await window.omniview.invoke('keys:update', { id, isActive });
      await fetchKeys();
    } catch {
      toast.error('Failed to update secret');
    }
  }

  async function handleVerify(id: number) {
    try {
      await window.omniview.invoke('keys:mark-verified', { id });
      toast.success('Secret marked as verified');
      await fetchKeys();
    } catch {
      toast.error('Failed to mark secret as verified');
    }
  }

  async function handleReveal(id: number) {
    const target = keys.find((item) => item.id === id);
    if (!target) return;

    setRevealTarget(target);
    setRevealedSecret(null);
    setSecretVisible(false);
    setLoadingSecret(true);

    try {
      const result = await window.omniview.invoke('keys:get-plaintext', { id }) as { secret: string };
      setRevealedSecret(result.secret);
    } catch {
      toast.error('Failed to reveal secret');
    } finally {
      setLoadingSecret(false);
    }
  }

  function closeReveal() {
    setRevealTarget(null);
    setRevealedSecret(null);
    setSecretVisible(false);
  }

  async function copySecret() {
    if (!revealedSecret) return;

    try {
      await navigator.clipboard.writeText(revealedSecret);
      toast.success(`Copied to clipboard (auto-clears in ${CLIPBOARD_CLEAR_SECONDS}s)`);
      setTimeout(async () => {
        try {
          await navigator.clipboard.writeText('');
        } catch {
          // Best-effort clear.
        }
      }, CLIPBOARD_CLEAR_SECONDS * 1000);
    } catch {
      toast.error('Failed to copy secret');
    }
  }

  const grouped = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? keys.filter((key) => {
        const providerName = PROVIDER_NAMES[key.providerId] ?? key.providerId;
        return [key.keyLabel, key.providerId, providerName, key.notes ?? '', key.keyPrefix ?? '', key.serviceType ?? '', key.generatedWhere ?? '']
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      })
      : keys;

    return filtered.reduce<Record<string, ApiKeyMetadata[]>>((acc, key) => {
      if (!acc[key.providerId]) acc[key.providerId] = [];
      acc[key.providerId].push(key);
      return acc;
    }, {});
  }, [keys, query]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Secrets
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Provider keys stay encrypted locally and are ready to be attached to
            your integrations and workspaces.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add secret
          </span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search secrets by name, provider, or notes"
          className="w-full rounded-2xl border border-border bg-secondary/50 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <AnimatePresence>
        {showForm && (
          <KeyForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {Object.entries(grouped).map(([providerId, providerKeys]) => (
          <div key={providerId} className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {PROVIDER_NAMES[providerId] ?? providerId}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence>
                {providerKeys.map((keyData) => (
                  <KeyCard
                    key={keyData.id}
                    keyData={keyData}
                    providerName={PROVIDER_NAMES[keyData.providerId] ?? keyData.providerId}
                    onReveal={handleReveal}
                    onRotate={handleRotate}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    onVerify={handleVerify}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="glass rounded-[24px] border border-white/8 p-8 text-center text-sm text-muted-foreground">
          No secrets match your search.
        </div>
      )}

      <AnimatePresence>
        {rotateTarget && (
          <KeyForm
            rotateKeyId={rotateTarget.id}
            rotateProviderId={rotateTarget.providerId}
            onSave={handleRotateSave}
            onCancel={() => setRotateTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {revealTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="glass w-full max-w-lg rounded-[24px] border border-white/10 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Secret inspector</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {revealTarget.keyLabel} · {PROVIDER_NAMES[revealTarget.providerId] ?? revealTarget.providerId}
                  </p>
                </div>
                <button
                  onClick={closeReveal}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-3">
                {loadingSecret && <p className="text-xs text-muted-foreground">Loading secret…</p>}
                {!loadingSecret && revealedSecret && (
                  <code className="block break-all text-xs text-foreground">
                    {secretVisible ? revealedSecret : '•'.repeat(Math.max(revealedSecret.length, 10))}
                  </code>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setSecretVisible((value) => !value)}
                  disabled={!revealedSecret || loadingSecret}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs text-foreground hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {secretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {secretVisible ? 'Hide value' : 'Reveal value'}
                </button>
                <button
                  onClick={copySecret}
                  disabled={!revealedSecret || loadingSecret}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs text-foreground hover:bg-white/[0.08] disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy (auto-clear)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass rounded-[24px] border border-white/8 p-4 text-xs leading-5 text-muted-foreground">
        Secrets are masked by default. When copied from the inspector, clipboard content is automatically cleared after {CLIPBOARD_CLEAR_SECONDS} seconds.
      </div>
    </motion.div>
  );
}

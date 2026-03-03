import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, Plus } from 'lucide-react';
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

export function KeyVault() {
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<{
    id: number;
    providerId: string;
  } | null>(null);

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
  }) {
    try {
      await window.omniview.invoke('keys:store', {
        providerId: data.providerId,
        apiKey: data.apiKey,
        label: data.label,
        notes: data.notes,
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

  const grouped = keys.reduce<Record<string, ApiKeyMetadata[]>>((acc, key) => {
    if (!acc[key.providerId]) acc[key.providerId] = [];
    acc[key.providerId].push(key);
    return acc;
  }, {});

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
          className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/92"
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add secret
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <KeyForm onSave={handleSave} onCancel={() => setShowForm(false)} />
        )}
        {rotateTarget && (
          <KeyForm
            rotateKeyId={rotateTarget.id}
            rotateProviderId={rotateTarget.providerId}
            onSave={(data) => handleRotateSave(data)}
            onCancel={() => setRotateTarget(null)}
          />
        )}
      </AnimatePresence>

      {keys.length === 0 && !showForm ? (
        <div className="glass rounded-[28px] border border-white/8 p-14">
          <div className="mx-auto flex max-w-md flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/8 bg-white/[0.04]">
              <KeyRound className="h-7 w-7 text-foreground" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                No secrets stored yet
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Add your first provider credential to start routing requests
                through the local gateway without scattering keys across tools.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-white/[0.08]"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add your first secret
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([providerId, providerKeys]) => (
            <section key={providerId} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {PROVIDER_NAMES[providerId] ?? providerId}
                </h2>
                <span className="text-[11px] text-muted-foreground">
                  {providerKeys.length} stored
                </span>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {providerKeys.map((key) => (
                    <KeyCard
                      key={key.id}
                      keyData={key}
                      providerName={PROVIDER_NAMES[key.providerId] ?? key.providerId}
                      onRotate={handleRotate}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}
    </motion.div>
  );
}

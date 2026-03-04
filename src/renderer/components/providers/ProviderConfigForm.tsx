import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, KeyRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/cn';
import { ProviderLogo } from './ProviderLogo';
import { useUiStore } from '../../store/ui-store';
import { PROVIDER_CATALOG } from '../../../shared/constants/provider-catalog';

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

  const selectedProvider = PROVIDER_CATALOG.find((p) => p.id === providerId);

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
    } catch {
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
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  const configPanel = (
    <div className="flex flex-col gap-5 h-full">
      {/* Selected provider header — shown in picker mode */}
      {!editProviderId && (
        <div className={cn(
          'flex items-center gap-3 pb-5 border-b border-white/8 transition-opacity',
          providerId ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
          {providerId && <ProviderLogo providerId={providerId} size={32} />}
          <div>
            <p className="text-sm font-semibold text-foreground">{selectedProvider?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Selected</p>
          </div>
        </div>
      )}

      {/* Secrets info banner */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
        <KeyRound className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Secrets managed in vault</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            Credentials are encrypted locally and injected automatically by the gateway.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveView('vault')}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
        >
          Open
        </button>
      </div>

      {/* Base URL */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Base URL <span className="text-muted-foreground/50">— optional</span>
        </label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.anthropic.com"
          className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/35 transition-shadow"
        />
      </div>

      {/* Sync interval */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Background sync interval</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={fetchInterval}
            onChange={(e) => setFetchInterval(Number(e.target.value))}
            min={1}
            max={1440}
            className="w-24 rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">minutes</span>
        </div>
      </div>

      {/* Test result */}
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

      {/* Push actions to bottom */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2.5 pt-4 border-t border-white/8">
        <button
          onClick={handleTestConnection}
          disabled={!providerId || testing}
          className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-40"
        >
          {testing && <Loader2 className="h-4 w-4 animate-spin" />}
          Test
        </button>
        <button
          onClick={handleSave}
          disabled={!providerId || saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Integration
        </button>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="glass rounded-2xl border border-white/8 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/8">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {editProviderId ? 'Edit Integration' : 'Add Integration'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {editProviderId
              ? 'Update connection settings for this provider.'
              : 'Choose a provider and configure its connection.'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {editProviderId ? (
        /* Edit mode — single column, centered */
        <div className="p-8 max-w-2xl">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/8">
            <ProviderLogo providerId={editProviderId} size={40} />
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedProvider?.name ?? editProviderId}</p>
              <p className="text-xs text-muted-foreground">{editProviderId}</p>
            </div>
          </div>
          {configPanel}
        </div>
      ) : (
        /* Add mode — two-panel layout */
        <div className="grid grid-cols-[1fr_380px] divide-x divide-white/8">
          {/* Left: Provider picker */}
          <div className="p-8">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-5">
              Select Provider
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDER_CATALOG.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProviderId(p.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all text-left',
                    providerId === p.id
                      ? 'border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:border-border/80'
                  )}
                >
                  <ProviderLogo providerId={p.id} size={18} />
                  <span className="truncate text-[13px]">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Config panel */}
          <div className="p-8">
            {configPanel}
          </div>
        </div>
      )}
    </motion.div>
  );
}

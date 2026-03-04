import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/cn';
import { ProviderLogo } from '../providers/ProviderLogo';
import { DropdownSelect } from '../ui/DropdownSelect';
import { PROVIDER_CATALOG } from '../../../shared/constants/provider-catalog';

interface KeyFormProps {
  onSave: (data: {
    providerId: string;
    apiKey: string;
    label: string;
    notes: string;
    serviceType: string;
    generatedWhere: string;
    expiresAt: string;
  }) => Promise<void>;
  onCancel: () => void;
  rotateKeyId?: number;
  rotateProviderId?: string;
}

export function KeyForm({ onSave, onCancel, rotateKeyId, rotateProviderId }: KeyFormProps) {
  const [providerId, setProviderId] = useState(rotateProviderId ?? '');
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceType, setServiceType] = useState('api');
  const [generatedWhere, setGeneratedWhere] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const selected = PROVIDER_CATALOG.find((p) => p.id === providerId);
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
      await onSave({
        providerId,
        apiKey,
        label: label || 'Default',
        notes,
        serviceType,
        generatedWhere,
        expiresAt,
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Shared action footer ──────────────────────────────────────────────────

  const actionRow = (
    <div className="flex items-center gap-2.5 pt-4 border-t border-white/8">
      <button
        type="button"
        onClick={handleTest}
        disabled={!providerId || !apiKey || testing}
        className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-40"
      >
        {testing && <Loader2 className="h-4 w-4 animate-spin" />}
        Test Key
      </button>
      <button
        type="submit"
        disabled={!providerId || !apiKey || saving}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {isRotation ? 'Rotate Key' : 'Save Secret'}
      </button>
    </div>
  );

  // ── Shared API key input ──────────────────────────────────────────────────

  const keyInput = (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        {isRotation ? 'New API key' : 'API key'}
      </label>
      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
          placeholder={selected?.keyPlaceholder ?? 'sk-…'}
          autoFocus={isRotation}
          className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 pr-10 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/35 transition-shadow"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  // ── Test result indicator ─────────────────────────────────────────────────

  const testResultBadge = testResult && (
    <div className="flex items-center gap-2 text-sm">
      {testResult === 'success' ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="text-green-400">Key is valid</span>
        </>
      ) : (
        <>
          <XCircle className="h-4 w-4 text-red-400" />
          <span className="text-red-400">Validation failed</span>
        </>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ROTATION mode — compact single-column modal
  // ══════════════════════════════════════════════════════════════════════════

  if (isRotation) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="glass w-full max-w-md rounded-2xl border border-white/8 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
            <div className="flex items-center gap-3">
              {rotateProviderId && (
                <ProviderLogo providerId={rotateProviderId} size={28} />
              )}
              <div>
                <h2 className="text-base font-semibold text-foreground">Rotate key</h2>
                {selected && (
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.name}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
            {keyInput}
            {testResultBadge}
            <div className="flex-1" />
            {actionRow}
          </form>
        </motion.div>
      </motion.div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADD mode — two-panel modal (provider picker | config)
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="glass w-full max-w-3xl rounded-2xl border border-white/8 overflow-hidden"
      >
        {/* ── Header bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="text-base font-semibold text-foreground">Add secret</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a provider and enter your API key to store it securely.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Two-panel body ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-[1fr_360px] divide-x divide-white/8 max-h-[70vh]">

          {/* Left: Provider picker */}
          <div className="p-6 overflow-y-auto min-h-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Select Provider
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDER_CATALOG.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProviderId(p.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all text-left',
                    providerId === p.id
                      ? 'border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px_oklch(0.94_0.007_255_/_0.3)]'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:border-border/80',
                  )}
                >
                  <ProviderLogo providerId={p.id} size={18} />
                  <span className="truncate text-[13px]">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Config fields */}
          <div className="p-6 overflow-y-auto min-h-0">
            <form
              id="key-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-5 h-full"
            >
              {/* Selected provider preview — only rendered when a provider is chosen */}
              {selected && (
                <div className="flex items-center gap-3 pb-5 border-b border-white/8">
                  <ProviderLogo providerId={providerId} size={30} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">Selected</p>
                  </div>
                </div>
              )}

              {/* API Key */}
              {keyInput}

              {/* Label */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Label <span className="text-muted-foreground/50">— optional</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Production, Personal…"
                  className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/35"
                />
              </div>

              {/* Service type + Expiry (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Service type</label>
                  <DropdownSelect
                    value={serviceType}
                    onChange={setServiceType}
                    options={[
                      { value: 'api', label: 'API' },
                      { value: 'database', label: 'Database' },
                      { value: 'webhook', label: 'Webhook' },
                      { value: 'oauth', label: 'OAuth' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Expires</label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Generated where */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Generated where <span className="text-muted-foreground/50">— optional</span>
                </label>
                <input
                  type="text"
                  value={generatedWhere}
                  onChange={(e) => setGeneratedWhere(e.target.value)}
                  placeholder="e.g. Stripe dashboard / personal account"
                  className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/35"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Notes <span className="text-muted-foreground/50">— optional</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this key…"
                  className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/35"
                />
              </div>

              {testResultBadge}

              {/* Push actions to bottom */}
              <div className="flex-1" />
              {actionRow}
            </form>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

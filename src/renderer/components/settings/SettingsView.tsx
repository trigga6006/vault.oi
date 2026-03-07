import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  FileUp,
  KeyRound,
  Loader2,
  ShieldCheck,
  TimerReset,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useVault } from '../../hooks/useVault';
import { ProxySettings } from './ProxySettings';
import { useUiStore, type PetKind } from '../../store/ui-store';

const PET_OPTIONS: { kind: PetKind; label: string; desc: string; color: string }[] = [
  { kind: 'uv',      label: 'UV',      desc: 'Bioluminescent blob',  color: 'oklch(0.72 0.28 320)' },
  { kind: 'void',    label: 'Void',    desc: 'Shadow entity',        color: 'oklch(0.32 0.18 355)' },
  { kind: 'crystal', label: 'Crystal', desc: 'Ice shard',            color: 'oklch(0.82 0.14 210)' },
];

export function SettingsView() {
  const { autoLockMinutes, changePassword, setAutoLock } = useVault();
  const { petKind, setPetKind } = useUiStore();
  const [nextAutoLock, setNextAutoLock] = useState(autoLockMinutes);
  const [savingAutoLock, setSavingAutoLock] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [importingSecrets, setImportingSecrets] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Export password dialog
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');

  // Import password dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPassword, setImportPassword] = useState('');

  useEffect(() => {
    setNextAutoLock(autoLockMinutes);
  }, [autoLockMinutes]);

  async function handleSaveAutoLock() {
    if (!Number.isFinite(nextAutoLock) || nextAutoLock < 1) return;
    setSavingAutoLock(true);
    try {
      await setAutoLock(nextAutoLock);
      toast.success('Auto-lock updated');
    } catch {
      toast.error('Failed to update auto-lock');
    } finally {
      setSavingAutoLock(false);
    }
  }

  async function handleExport() {
    if (exportPassword.length < 8) return;
    if (exportPassword !== exportPasswordConfirm) return;
    setExporting(true);
    setShowExportDialog(false);
    try {
      const result = await window.omniview.invoke('vault:export', { password: exportPassword });
      if (result.success) {
        toast.success('Vault exported successfully');
      } else {
        toast.error('Export cancelled');
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
      setExportPassword('');
      setExportPasswordConfirm('');
    }
  }

  async function handleImport() {
    if (!importPassword) return;
    setImportingSecrets(true);
    setShowImportDialog(false);
    try {
      const result = await window.omniview.invoke('vault:import', { password: importPassword });
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} secret${result.imported === 1 ? '' : 's'}`);
      } else {
        toast.info('No secrets were imported');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      // Wrong password produces a decryption error
      if (msg.toLowerCase().includes('decrypt') || msg.toLowerCase().includes('auth')) {
        toast.error('Wrong export password — could not decrypt the backup file');
      } else {
        toast.error('Import failed');
      }
    } finally {
      setImportingSecrets(false);
      setImportPassword('');
    }
  }


  async function handleImportSecrets() {
    setImportingSecrets(true);
    try {
      const result = await window.omniview.invoke('vault:import-secrets', undefined) as {
        imported: number;
        skipped: number;
        source: '.env' | 'csv' | 'json';
      };

      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} secret${result.imported === 1 ? '' : 's'} from ${result.source}`);
      } else if (result.skipped > 0) {
        toast.warning('No supported secrets were imported from the selected file');
      }
    } catch {
      toast.error('Secrets import failed');
    } finally {
      setImportingSecrets(false);
    }
  }

  function openExportDialog() {
    setExportPassword('');
    setExportPasswordConfirm('');
    setShowExportDialog(true);
  }

  function openImportDialog() {
    setImportPassword('');
    setShowImportDialog(true);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || newPassword.length < 8) return;

    setChangingPassword(true);
    try {
      const success = await changePassword(currentPassword, newPassword);
      if (success) {
        setCurrentPassword('');
        setNewPassword('');
        toast.success('Master password updated');
      } else {
        toast.error('Password change failed');
      }
    } catch {
      toast.error('Password change failed');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Security and session controls for your local workspace.
        </p>
      </div>

      <ProxySettings />

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="glass rounded-[28px] border border-white/8 p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-medium text-foreground">Vault security</h2>
          </div>

          <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground">
                Use at least 8 characters.
              </p>
            </div>
            <button
              type="submit"
              disabled={
                !currentPassword || !newPassword || newPassword.length < 8 || changingPassword
              }
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/92 disabled:opacity-50"
            >
              {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              Update master password
            </button>
          </form>
        </div>

        <div className="glass rounded-[28px] border border-white/8 p-6">
          <div className="flex items-center gap-2">
            <TimerReset className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-medium text-foreground">Session behavior</h2>
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Auto-lock after
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={nextAutoLock}
                  onChange={(e) => setNextAutoLock(Number(e.target.value))}
                  className="w-28 rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>
            <button
              onClick={handleSaveAutoLock}
              disabled={savingAutoLock}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50"
            >
              {savingAutoLock && <Loader2 className="h-4 w-4 animate-spin" />}
              Save auto-lock
            </button>
          </div>

          <div className="mt-8 border-t border-white/8 pt-5">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-foreground" />
              <h3 className="text-sm font-medium text-foreground">Export vault</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Export your vault as an encrypted backup. You'll set a separate export password — this backup stays readable even if you change your master password later.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={openExportDialog}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50"
              >
                {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
                Export encrypted vault
              </button>
              <button
                onClick={openImportDialog}
                disabled={importingSecrets}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50"
              >
                {importingSecrets && <Loader2 className="h-4 w-4 animate-spin" />}
                Import vault backup
              </button>
            </div>
          </div>

          <div className="mt-8 border-t border-white/8 pt-5">
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-foreground" />
              <h3 className="text-sm font-medium text-foreground">Import secrets</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Import provider keys from <code>.env</code> or CSV exports and store them encrypted in your local vault.
            </p>
            <button
              onClick={handleImportSecrets}
              disabled={importingSecrets}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50"
            >
              {importingSecrets && <Loader2 className="h-4 w-4 animate-spin" />}
              Import .env / CSV
            </button>
          </div>

        </div>
      </div>

      <div className="glass rounded-[28px] border border-white/8 p-6">
        <h2 className="text-sm font-medium text-foreground">Security pet</h2>
        <p className="mt-1.5 text-xs text-muted-foreground">Choose your dashboard companion.</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {PET_OPTIONS.map(({ kind, label, desc, color }) => (
            <button
              key={kind}
              onClick={() => setPetKind(kind)}
              className={`flex flex-col items-center gap-2.5 rounded-2xl border p-4 transition-all ${
                petKind === kind
                  ? 'border-ring bg-accent shadow-sm'
                  : 'border-border bg-secondary/30 hover:bg-accent/50'
              }`}
            >
              <div
                className="h-5 w-5 rounded-full"
                style={{ background: color, boxShadow: petKind === kind ? `0 0 12px ${color}` : 'none' }}
              />
              <div className="text-center">
                <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-foreground">{label}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-[28px] border border-white/8 p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-foreground" />
          <h2 className="text-sm font-medium text-foreground">Product framing</h2>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
          OmniView now reads best as a local-first secret manager and developer
          workspace. Integrations, gateway routing, and workspace assignment are
          the primary story; cost monitoring is no longer presented as the core
          identity of the product.
        </p>
      </div>

      {/* ── Export password dialog ── */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="glass w-full max-w-sm rounded-[24px] border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Set export password</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  This password encrypts the backup file independently of your master password. You'll need it to import the backup later.
                </p>
              </div>
              <button onClick={() => setShowExportDialog(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Export password</label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Confirm password</label>
                <input
                  type="password"
                  value={exportPasswordConfirm}
                  onChange={(e) => setExportPasswordConfirm(e.target.value)}
                  placeholder="Repeat export password"
                  className="w-full rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {exportPassword.length > 0 && exportPasswordConfirm.length > 0 && exportPassword !== exportPasswordConfirm && (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowExportDialog(false)}
                className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2 text-sm text-foreground hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exportPassword.length < 8 || exportPassword !== exportPasswordConfirm}
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/92 disabled:opacity-50"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import password dialog ── */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="glass w-full max-w-sm rounded-[24px] border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Enter export password</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the password that was set when this backup was exported.
                </p>
              </div>
              <button onClick={() => setShowImportDialog(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Export password</label>
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Password used when exporting"
                  className="w-full rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowImportDialog(false)}
                className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2 text-sm text-foreground hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importPassword}
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/92 disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

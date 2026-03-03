import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  KeyRound,
  Loader2,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { toast } from 'sonner';
import { useVault } from '../../hooks/useVault';
import { ProxySettings } from './ProxySettings';

export function SettingsView() {
  const { autoLockMinutes, changePassword, setAutoLock } = useVault();
  const [nextAutoLock, setNextAutoLock] = useState(autoLockMinutes);
  const [savingAutoLock, setSavingAutoLock] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

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
    setExporting(true);
    try {
      const result = (await window.omniview.invoke(
        'vault:export',
        undefined,
      )) as { success: boolean };

      if (result.success) {
        toast.success('Vault exported');
      } else {
        toast.error('Export failed');
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
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
              Export your encrypted vault data for backup or migration.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50"
            >
              {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
              Export encrypted vault
            </button>
          </div>
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
    </motion.div>
  );
}

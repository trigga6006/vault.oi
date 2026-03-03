import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VaultSetupProps {
  onInitialize: (password: string) => Promise<boolean>;
}

export function VaultSetup({ onInitialize }: VaultSetupProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirm;
  const passwordStrong = password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch || !passwordStrong) return;

    setLoading(true);
    try {
      const success = await onInitialize(password);
      if (!success) {
        toast.error('Failed to create vault');
      }
    } catch {
      toast.error('Failed to create vault');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass-strong w-full max-w-md space-y-6 rounded-[28px] border border-white/8 p-8"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.04]">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            Create your secure workspace
          </h1>
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            Set a master password to encrypt your secrets. It stays on this
            machine and unlocks the local vault.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Master Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters..."
                autoFocus
                className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2.5 pr-10 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {password.length > 0 && !passwordStrong && (
              <p className="text-[11px] text-destructive">
                Password must be at least 8 characters
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password..."
              className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            {confirm.length > 0 && !passwordsMatch && (
              <p className="text-[11px] text-destructive">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!passwordsMatch || !passwordStrong || loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/92 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Workspace
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground/60 text-center">
          Your keys are encrypted with AES-256-GCM and never leave this device.
          If you forget your password, your keys cannot be recovered.
        </p>
      </motion.div>
    </div>
  );
}

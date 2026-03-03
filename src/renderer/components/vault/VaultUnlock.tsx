import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

interface VaultUnlockProps {
  onUnlock: (password: string) => Promise<boolean>;
}

export function VaultUnlock({ onUnlock }: VaultUnlockProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(false);

    try {
      const success = await onUnlock(password);
      if (!success) {
        setError(true);
        setPassword('');
      }
    } catch {
      setError(true);
      setPassword('');
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
        className="glass-strong w-full max-w-sm space-y-6 rounded-[28px] border border-white/8 p-8"
      >
        <div className="flex flex-col items-center gap-3">
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.04]"
            animate={error ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <Lock className="h-7 w-7 text-primary" />
          </motion.div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Unlock workspace</h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter your master password to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="Master password..."
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
            {error && (
              <p className="text-[11px] text-destructive">
                Incorrect password. Please try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!password || loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/92 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Unlock
          </button>
        </form>
      </motion.div>
    </div>
  );
}

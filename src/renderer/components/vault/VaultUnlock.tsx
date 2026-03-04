import { useState, useEffect, useRef } from 'react';
import { motion, useAnimate, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '../ui/cn';
import { useProfiles } from '../../hooks/useProfiles';
import { useVaultStore } from '../../store/vault-store';
import type { VaultProfile } from '../../../shared/types/profile.types';
import type { VaultStatus } from '../../../shared/types/vault.types';

interface VaultUnlockProps {
  onUnlock: (password: string) => Promise<boolean>;
}

// Deterministic hue from profile name so each profile always gets the same colour
function profileHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Profile avatar chip ──────────────────────────────────────────────────────

function ProfileAvatar({
  profile,
  active,
  switching,
  onClick,
}: {
  profile: VaultProfile;
  active: boolean;
  switching: boolean;
  onClick: () => void;
}) {
  const hue = profileHue(profile.name);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={switching}
      title={`Unlock as ${profile.name}`}
      className="group flex flex-col items-center gap-2 transition-all disabled:pointer-events-none"
    >
      {/* Avatar circle */}
      <motion.div
        animate={{ scale: active ? 1 : 0.88, opacity: active ? 1 : 0.45 }}
        whileHover={active ? {} : { scale: 0.94, opacity: 0.72 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold"
        style={{
          background: `oklch(${active ? '0.42' : '0.28'} 0.12 ${hue})`,
          color: `oklch(0.88 0.07 ${hue})`,
          boxShadow: active
            ? `0 0 0 2px oklch(0.55 0.16 ${hue} / 0.55), 0 0 20px oklch(0.4 0.12 ${hue} / 0.2)`
            : 'none',
        }}
      >
        {switching && active ? (
          <Loader2 className="h-4 w-4 animate-spin opacity-70" />
        ) : (
          getInitials(profile.name)
        )}
      </motion.div>

      {/* Name label */}
      <span
        className={cn(
          'max-w-[64px] truncate text-center text-[10px] font-medium transition-colors duration-200',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {profile.name}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VaultUnlock({ onUnlock }: VaultUnlockProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [cardScope, animateCard] = useAnimate();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const { state: profileState } = useProfiles();
  const { setVaultStatus } = useVaultStore();
  const [activeProfileId, setActiveProfileId] = useState('');
  const [switching, setSwitching] = useState(false);

  // Sync activeProfileId once profiles load
  useEffect(() => {
    if (profileState?.activeProfileId && !activeProfileId) {
      setActiveProfileId(profileState.activeProfileId);
    }
  }, [profileState?.activeProfileId, activeProfileId]);

  const profiles = profileState?.profiles ?? [];
  const showProfileSwitcher = profiles.length > 1;

  // ── Error animations ────────────────────────────────────────────────────────

  useEffect(() => {
    if (errorCount === 0) return;

    animateCard(
      cardScope.current,
      { x: [-11, 11, -8, 8, -4, 4, 0] },
      { duration: 0.48, ease: [0.36, 0.07, 0.19, 0.97] },
    );

    animateCard(
      cardScope.current,
      {
        boxShadow: [
          '0 0 0 0px oklch(0.55 0.22 15 / 0), 0 0 0px oklch(0.3 0.15 12 / 0)',
          '0 0 0 1.5px oklch(0.52 0.2 18 / 0.45), 0 0 55px oklch(0.28 0.14 12 / 0.28)',
          '0 0 0 0px oklch(0.55 0.22 15 / 0), 0 0 0px oklch(0.3 0.15 12 / 0)',
        ],
      },
      { duration: 1.9, times: [0, 0.09, 1] },
    );
  }, [errorCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile switch ──────────────────────────────────────────────────────────

  async function handleSwitchProfile(profileId: string) {
    if (profileId === activeProfileId || switching) return;

    setSwitching(true);
    // Optimistic update — feels instant
    setActiveProfileId(profileId);
    setPassword('');
    setError(false);
    setErrorCount(0);

    try {
      await window.omniview.invoke('profiles:switch', { profileId });
      // Re-fetch vault status so App re-gates correctly if the new profile
      // has a different vault state (e.g. not yet initialised)
      const status = (await window.omniview.invoke(
        'vault:status',
        undefined,
      )) as VaultStatus;
      setVaultStatus(status);
    } finally {
      setSwitching(false);
      // Focus password field after switching so user can type immediately
      setTimeout(() => passwordInputRef.current?.focus(), 50);
    }
  }

  // ── Unlock submit ───────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(false);

    try {
      const success = await onUnlock(password);
      if (!success) {
        setError(true);
        setErrorCount((c) => c + 1);
        setPassword('');
      }
    } catch {
      setError(true);
      setErrorCount((c) => c + 1);
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-background overflow-hidden">

      {/* Vignette overlay on wrong password */}
      {errorCount > 0 && (
        <motion.div
          key={errorCount}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse 115% 115% at 50% 50%, ' +
              'transparent 30%, ' +
              'oklch(0.22 0.15 15 / 0.5) 68%, ' +
              'oklch(0.13 0.1 10 / 0.88) 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.4, times: [0, 0.07, 0.26, 1], ease: 'linear' }}
        />
      )}

      {/* Card */}
      <motion.div
        ref={cardScope}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass-strong relative z-10 w-full max-w-sm rounded-[28px] border border-white/8 p-8"
      >
        {/* ── Header ── */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.04]">
            <Lock
              className={cn(
                'h-7 w-7 transition-colors duration-500',
                error ? 'text-rose-400/80' : 'text-primary',
              )}
            />
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
              Unlock workspace
            </h1>
            <p className="text-sm text-muted-foreground">
              {showProfileSwitcher && activeProfile
                ? <>Unlocking as <span className="text-foreground font-medium">{activeProfile.name}</span></>
                : 'Enter your master password to continue'}
            </p>
          </div>
        </div>

        {/* ── Profile switcher (only shown when 2+ profiles exist) ── */}
        <AnimatePresence>
          {showProfileSwitcher && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="flex flex-col items-center gap-3">
                {/* Subtle divider */}
                <div className="h-px w-full bg-white/6" />

                {/* Avatar row */}
                <div className="flex items-end justify-center gap-4 flex-wrap">
                  {profiles.map((profile, i) => (
                    <motion.div
                      key={profile.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                    >
                      <ProfileAvatar
                        profile={profile}
                        active={profile.id === activeProfileId}
                        switching={switching}
                        onClick={() => handleSwitchProfile(profile.id)}
                      />
                    </motion.div>
                  ))}
                </div>

                <p className="text-[10px] text-muted-foreground/60">
                  Tap a profile to switch
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="Master password…"
                autoFocus
                className={cn(
                  'w-full rounded-lg bg-secondary/50 border px-3 py-2.5 pr-10 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring transition-[border-color] duration-300',
                  error ? 'border-rose-500/50' : 'border-border',
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[11px] text-rose-400/80"
              >
                Incorrect password. Try again.
              </motion.p>
            )}
          </div>

          <button
            type="submit"
            disabled={!password || loading || switching}
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

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Eye, EyeOff, KeyRound, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CredentialRecord } from '../../../shared/types/credentials.types';
import type { ProjectRecord } from '../../../shared/types/project.types';
import { ProviderLogo } from '../providers/ProviderLogo';
import { SecretIdentityIcon } from '../secrets/SecretIdentityIcon';
import { DropdownSelect, type DropdownOption } from '../ui/DropdownSelect';
import { PROVIDER_CATALOG } from '../../../shared/constants/provider-catalog';

export function CredentialsView() {
  const [items, setItems] = useState<CredentialRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revealedId, setRevealedId] = useState<number | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    title: '',
    providerId: '',
    projectId: '',
    username: '',
    password: '',
    notes: '',
  });

  const providerOptions: DropdownOption[] = [
    { value: '', label: 'No provider mapping', description: 'Store this without linking it to an integration.' },
    ...PROVIDER_CATALOG.map((provider) => ({
      value: provider.id,
      label: provider.name,
      icon: <ProviderLogo providerId={provider.id} size={16} />,
    })),
  ];

  const projectOptions: DropdownOption[] = [
    { value: '', label: 'No workspace mapping', description: 'Keep this credential global to the vault.' },
    ...projects.map((project) => ({
      value: String(project.id),
      label: project.name,
      description: project.description ?? undefined,
    })),
  ];

  const load = useCallback(async () => {
    const [credentials, workspaces] = await Promise.all([
      window.omniview.invoke('credentials:list', undefined) as Promise<CredentialRecord[]>,
      window.omniview.invoke('projects:list', undefined) as Promise<ProjectRecord[]>,
    ]);
    setItems(credentials);
    setProjects(workspaces);
  }, []);

  useEffect(() => {
    load().catch(() => toast.error('Failed to load credentials suite'));
  }, [load]);

  async function generatePassword() {
    try {
      const result = await window.omniview.invoke('credentials:generate-password', { length: 24 }) as { password: string };
      setForm((prev) => ({ ...prev, password: result.password }));
      toast.success('Secure password generated');
    } catch {
      toast.error('Failed to generate password');
    }
  }

  async function createCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.username || !form.password) return;

    setCreating(true);
    try {
      await window.omniview.invoke('credentials:create', {
        title: form.title,
        providerId: form.providerId || null,
        projectId: form.projectId ? Number(form.projectId) : null,
        username: form.username,
        password: form.password,
        notes: form.notes,
      });

      setForm({ title: '', providerId: '', projectId: '', username: '', password: '', notes: '' });
      setShowComposer(false);
      toast.success('Credential stored securely');
      await load();
    } catch {
      toast.error('Failed to store credential');
    } finally {
      setCreating(false);
    }
  }

  async function revealPassword(id: number) {
    if (revealedId === id) {
      setRevealedId(null);
      setRevealedPassword('');
      setShowPassword(false);
      return;
    }

    try {
      const result = await window.omniview.invoke('credentials:get-password', { id }) as { password: string };
      setRevealedId(id);
      setRevealedPassword(result.password);
      setShowPassword(false);
    } catch {
      toast.error('Failed to retrieve password');
    }
  }

  async function copyPassword() {
    if (!revealedPassword) return;
    try {
      await navigator.clipboard.writeText(revealedPassword);
      toast.success('Copied password (auto-clear in 20s)');
      setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => undefined);
      }, 20000);
    } catch {
      toast.error('Failed to copy password');
    }
  }

  async function removeCredential(id: number) {
    try {
      await window.omniview.invoke('credentials:delete', { id });
      toast.success('Credential removed');
      if (revealedId === id) {
        setRevealedId(null);
        setRevealedPassword('');
      }
      await load();
    } catch {
      toast.error('Failed to remove credential');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Credentials Suite</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Store usernames and passwords in your local vault, then map them to providers and workspaces as needed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowComposer(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add credential
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const providerEntry = item.providerId
            ? PROVIDER_CATALOG.find((p) => p.id === item.providerId)
            : null;

          return (
          <div key={item.id} className="glass rounded-[20px] border border-white/8 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">{item.username}</span>
                  {providerEntry ? (
                    <span className="flex items-center gap-1.5">
                      <ProviderLogo providerId={providerEntry.id} size={13} />
                      <span>{providerEntry.name}</span>
                    </span>
                  ) : item.providerId ? (
                    <span className="flex items-center gap-1.5">
                      <SecretIdentityIcon providerId={item.providerId} keyName={item.title} size={13} />
                      <span>{item.providerId}</span>
                    </span>
                  ) : (
                    <span className="italic opacity-50">No provider</span>
                  )}
                  {item.projectName && (
                    <span className="rounded-full border border-border/60 bg-secondary/30 px-2 py-0.5 text-[10px] tracking-wide">
                      {item.projectName}
                    </span>
                  )}
                </div>
                {item.notes && (
                  <p className="mt-1.5 text-xs text-muted-foreground/65 truncate">{item.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => revealPassword(item.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Reveal password"><KeyRound className="h-4 w-4" /></button>
                <button onClick={() => removeCredential(item.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Delete credential"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            {revealedId === item.id && (
              <div className="mt-3 rounded-xl border border-border bg-secondary/50 p-3">
                <code className="block break-all text-xs">{showPassword ? revealedPassword : '*'.repeat(Math.max(revealedPassword.length, 12))}</code>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setShowPassword((value) => !value)} className="inline-flex items-center gap-1 rounded-md border border-white/8 px-2 py-1 text-xs">
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showPassword ? 'Hide' : 'Reveal'}
                  </button>
                  <button onClick={copyPassword} className="inline-flex items-center gap-1 rounded-md border border-white/8 px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5" />Copy</button>
                </div>
              </div>
            )}
          </div>
          );
        })}

        {items.length === 0 && (
          <div className="glass rounded-[20px] border border-white/8 p-6 text-sm text-muted-foreground">No credentials stored yet.</div>
        )}
      </div>

      <AnimatePresence>
        {showComposer && (
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
              className="glass w-full max-w-3xl rounded-[24px] border border-white/10 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Add credential</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Capture a login once, keep it encrypted locally, and attach it to the right provider or workspace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Close composer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={createCredential} className="mt-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Credential title" className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm" />
                  <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="Username / email" className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm" />
                  <DropdownSelect
                    value={form.providerId}
                    onChange={(value) => setForm((p) => ({ ...p, providerId: value }))}
                    options={providerOptions}
                    placeholder="Provider mapping"
                  />
                  <DropdownSelect
                    value={form.projectId}
                    onChange={(value) => setForm((p) => ({ ...p, projectId: value }))}
                    options={projectOptions}
                    placeholder="Workspace mapping"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Password" className="min-w-[280px] flex-1 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm font-mono" />
                  <button type="button" onClick={generatePassword} className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs hover:bg-white/[0.08]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate secure password
                  </button>
                </div>

                <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" className="h-24 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm" />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowComposer(false)}
                    className="rounded-xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-white/[0.08]"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={creating || !form.title || !form.username || !form.password} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                    Store credential
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

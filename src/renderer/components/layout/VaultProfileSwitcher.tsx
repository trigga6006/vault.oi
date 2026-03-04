import { useState } from 'react';
import { Check, CircleUser, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useProfiles } from '../../hooks/useProfiles';
import { DropdownSelect } from '../ui/DropdownSelect';

export function VaultProfileSwitcher() {
  const { state, loading, switchProfile, createProfile } = useProfiles();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  async function handleCreateProfile() {
    const nextName = name.trim();
    if (!nextName) {
      toast.error('Profile name is required');
      return;
    }

    try {
      await createProfile(nextName);
      setCreating(false);
      setName('');
    } catch {
      toast.error('Failed to create profile');
    }
  }

  async function handleSwitch(profileId: string) {
    if (!profileId || !state || profileId === state.activeProfileId) return;
    try {
      await switchProfile(profileId);
    } catch {
      toast.error('Failed to switch profile');
    }
  }

  function handleOpenCreator() {
    setCreating(true);
  }

  function handleCloseCreator() {
    setCreating(false);
    setName('');
  }

  return (
    <div className="no-drag relative">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/45 px-2 py-1">
        <CircleUser className="h-3.5 w-3.5 text-muted-foreground" />
        <DropdownSelect
          value={state?.activeProfileId ?? ''}
          onChange={(value) => {
            void handleSwitch(value);
          }}
          disabled={!state || loading}
          className="min-h-0 min-w-[140px] border-0 bg-transparent px-0 py-0 shadow-none hover:bg-transparent"
          menuClassName="w-56"
          align="right"
          options={(state?.profiles ?? []).map((profile) => ({
            value: profile.id,
            label: profile.name,
          }))}
          placeholder="Select profile"
        />
        <button
          type="button"
          onClick={handleOpenCreator}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Create profile"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {creating && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            New profile
          </p>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreateProfile();
              }
              if (event.key === 'Escape') {
                handleCloseCreator();
              }
            }}
            placeholder="Work, Client A, Lab"
            className="mt-3 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseCreator}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <span className="inline-flex items-center gap-1">
                <X className="h-3.5 w-3.5" />
                Cancel
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCreateProfile();
              }}
              className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                Create
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

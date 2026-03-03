import { Plus, Vault } from 'lucide-react';
import { useProfiles } from '../../hooks/useProfiles';

export function VaultProfileSwitcher() {
  const { state, loading, switchProfile, createProfile } = useProfiles();

  async function handleCreateProfile() {
    const name = window.prompt('Create profile name (e.g. Work, Client A)');
    if (!name) return;
    await createProfile(name);
  }

  async function handleSwitch(profileId: string) {
    if (!profileId || !state || profileId === state.activeProfileId) return;
    await switchProfile(profileId);
  }

  return (
    <div className="no-drag flex items-center gap-2 rounded-xl border border-border bg-secondary/45 px-2 py-1.5">
      <Vault className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={state?.activeProfileId ?? ''}
        onChange={(event) => {
          void handleSwitch(event.target.value);
        }}
        disabled={!state || loading}
        className="bg-transparent text-xs text-foreground outline-none"
        title="Switch vault profile"
      >
        {(state?.profiles ?? []).map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          void handleCreateProfile();
        }}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Create profile"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

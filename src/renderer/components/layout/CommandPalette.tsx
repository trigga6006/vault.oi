import { Command } from 'cmdk';
import { useEffect } from 'react';
import {
  Blocks,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Settings,
  UserRound,
} from 'lucide-react';
import { useUiStore, type NavView } from '../../store/ui-store';

const commands: Array<{ id: NavView; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Go to Overview', icon: LayoutDashboard },
  { id: 'vault', label: 'Go to Secrets', icon: KeyRound },
  { id: 'providers', label: 'Go to Integrations', icon: Blocks },
  { id: 'projects', label: 'Go to Workspaces', icon: FolderKanban },
  { id: 'credentials', label: 'Go to Credentials', icon: UserRound },
  { id: 'settings', label: 'Go to Settings', icon: Settings },
];

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveView } =
    useUiStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-md"
        onClick={() => setCommandPaletteOpen(false)}
      />

      <div className="glass-strong relative w-full max-w-xl overflow-hidden rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <Command className="flex flex-col">
          <Command.Input
            placeholder="Jump to secrets, workspaces, or settings..."
            className="w-full border-b border-border bg-transparent px-4 py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matching destinations.
            </Command.Empty>

            <Command.Group
              heading="Workspace"
              className="px-2 py-1.5 text-xs text-muted-foreground"
            >
              {commands.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.label}
                    onSelect={() => {
                      setActiveView(cmd.id);
                      setCommandPaletteOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground data-[selected=true]:bg-accent"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {cmd.label}
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

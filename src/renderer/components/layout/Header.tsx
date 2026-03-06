import { Lock, Moon, Search, Sun } from 'lucide-react';
import { useProxy } from '../../hooks/useProxy';
import { useVault } from '../../hooks/useVault';
import { useUiStore } from '../../store/ui-store';
import { cn } from '../ui/cn';
import { SidebarTrigger } from '../ui/sidebar';
import { VaultProfileSwitcher } from './VaultProfileSwitcher';

export function Header() {
  const { toggleCommandPalette, theme, setTheme } = useUiStore();
  const { status } = useProxy();
  const { lockVault } = useVault();
  const windowControlsInset = window.omniview.platform === 'win32' ? 144 : 0;

  return (
    <header
      className="drag-region relative z-30 flex h-14 items-center justify-between border-b border-border bg-background/88 px-4 backdrop-blur-xl"
      style={{ paddingRight: `calc(1rem + ${windowControlsInset}px)` }}
    >
      <div className="flex w-52 items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <div className="no-drag flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              status.running ? 'bg-emerald-400' : 'bg-zinc-500',
            )}
          />
          <span className="hidden sm:inline">
            {status.running ? `gateway:${status.port}` : 'gateway:idle'}
          </span>
        </div>
      </div>

      <button
        onClick={toggleCommandPalette}
        className="no-drag flex items-center gap-2 rounded-xl border border-border bg-secondary/55 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary"
      >
        <Search className="h-3 w-3" />
        <span>Jump to command</span>
        <kbd className="ml-2 rounded-md bg-card px-1.5 py-0.5 text-[10px] font-mono">
          {window.omniview?.platform === 'darwin' ? 'Cmd+K' : 'Ctrl+K'}
        </kbd>
      </button>

      <div className="flex items-center justify-end gap-2">
        <VaultProfileSwitcher />
        <div className="no-drag flex items-center rounded-xl border border-border bg-secondary/50 p-1">
          <ThemeButton
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            icon={Moon}
            label="Dark mode"
          />
          <ThemeButton
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            icon={Sun}
            label="Light mode"
          />
        </div>
        <button
          onClick={lockVault}
          className="no-drag rounded-xl border border-border bg-secondary/45 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Lock workspace"
        >
          <Lock className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function ThemeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'rounded-lg p-1.5 text-muted-foreground transition-colors',
        active && 'bg-card text-foreground shadow-sm',
        !active && 'hover:bg-card/70 hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

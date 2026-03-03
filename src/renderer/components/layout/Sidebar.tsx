import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Blocks,
  Settings,
  Shield,
  UserRound,
} from 'lucide-react';
import { useUiStore, type NavView } from '../../store/ui-store';
import { cn } from '../ui/cn';

interface NavItem {
  id: NavView;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'vault', label: 'Secrets', icon: KeyRound },
  { id: 'providers', label: 'Integrations', icon: Blocks },
  { id: 'projects', label: 'Workspaces', icon: FolderKanban },
  { id: 'credentials', label: 'Credentials', icon: UserRound },
];

const bottomItems: NavItem[] = [{ id: 'settings', label: 'Settings', icon: Settings }];

export function Sidebar() {
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar } =
    useUiStore();

  return (
    <motion.aside
      className="glass-strong relative z-10 flex h-full flex-col border-r border-sidebar-border"
      animate={{ width: sidebarCollapsed ? 72 : 252 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    >
      <div className="drag-region flex h-16 items-center border-b border-sidebar-border px-3">
        <div className="no-drag flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-foreground">
          <Shield className="h-4 w-4" />
        </div>
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="no-drag ml-3"
            >
              <div className="text-sm font-semibold tracking-[-0.02em] text-sidebar-foreground">
                OmniView
              </div>
              <div className="text-[11px] text-muted-foreground">
                Secure developer workspace
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeView === item.id}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveView(item.id)}
          />
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {bottomItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeView === item.id}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveView(item.id)}
          />
        ))}

        <button
          onClick={toggleSidebar}
          className="mt-2 flex h-10 w-full items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'no-drag relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-xl border border-border bg-card/90"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}
      <Icon className="relative z-10 h-4 w-4 shrink-0" />
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="relative z-10 truncate"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

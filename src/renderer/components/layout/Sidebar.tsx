import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Blocks,
  Settings,
  UserRound,
  Workflow,
} from 'lucide-react';
import { useUiStore, type NavView } from '../../store/ui-store';
import { cn } from '../ui/cn';
import brandLogo from '../../../assets/logos/oilogov1.png';

interface NavItem {
  id: NavView;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'vault', label: 'Secrets', icon: KeyRound },
  { id: 'graph', label: 'Graph', icon: Workflow },
  { id: 'providers', label: 'Integrations', icon: Blocks },
  { id: 'projects', label: 'Workspaces', icon: FolderKanban },
  { id: 'credentials', label: 'Credentials', icon: UserRound },
];

const bottomItems: NavItem[] = [{ id: 'settings', label: 'Settings', icon: Settings }];

// Sidebar geometry constants — used to keep icon centering in sync with the spring
const W_OPEN = 252;
const W_CLOSED = 72;
const SECTION_PAD = 12; // p-3
const ICON_W = 16;      // h-4 w-4
// When collapsed the button spans (W_CLOSED - 2*SECTION_PAD) = 48px.
// Center the 16px icon: (48 - 16) / 2 = 16px padding on each side.
const PAD_COLLAPSED = (W_CLOSED - SECTION_PAD * 2 - ICON_W) / 2; // 16
const PAD_EXPANDED = SECTION_PAD;                                   // 12

const SIDEBAR_SPRING = { type: 'spring' as const, stiffness: 320, damping: 32 };

export function Sidebar() {
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <motion.aside
      className="glass-strong relative z-10 flex h-full flex-col overflow-hidden border-r border-sidebar-border"
      animate={{ width: sidebarCollapsed ? W_CLOSED : W_OPEN }}
      transition={SIDEBAR_SPRING}
    >
      {/* ── Brand header ─────────────────────────────────────── */}
      <div className="drag-region flex h-16 shrink-0 items-center border-b border-sidebar-border px-3 gap-3">
        <div className="no-drag flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
          <img
            src={brandLogo}
            alt="OmniView brand logo"
            className="h-7 w-7 object-contain"
          />
        </div>

        {/*
          Opacity-only fade — no x-slide, no width animation.
          whitespace-nowrap prevents the text from wrapping as the aside shrinks.
          overflow-hidden on the aside clips it cleanly.
        */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              key="brand-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="no-drag min-w-0 whitespace-nowrap"
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

      {/* ── Primary nav ──────────────────────────────────────── */}
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

      {/* ── Footer: settings + dedicated collapse toggle ─────── */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {bottomItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeView === item.id}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveView(item.id)}
          />
        ))}

        {/*
          Collapse toggle lives in its own dedicated square — visually
          separate from the Settings nav item above it.
          Right-aligned when open (pointing inward), centred when closed.
        */}
        <div
          className={cn(
            'flex pt-1 transition-[justify-content]',
            sidebarCollapsed ? 'justify-center' : 'justify-end',
          )}
        >
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="no-drag flex h-8 w-8 items-center justify-center rounded-xl border border-border/50 text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-[15px] w-[15px]" />
            ) : (
              <ChevronLeft className="h-[15px] w-[15px]" />
            )}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
    /*
      Animate paddingLeft/Right so the icon glides to centre as the sidebar
      shrinks — no jarring snap between px-3 and px-0.
      gap-3 is left in the className; once the label unmounts the gap
      disappears naturally, so it doesn't affect collapsed layout.
    */
    <motion.button
      onClick={onClick}
      animate={{
        paddingLeft: collapsed ? PAD_COLLAPSED : PAD_EXPANDED,
        paddingRight: collapsed ? PAD_COLLAPSED : PAD_EXPANDED,
      }}
      transition={SIDEBAR_SPRING}
      className={cn(
        'no-drag relative flex w-full items-center gap-3 rounded-xl py-2.5 text-sm transition-colors',
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
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

      {/*
        Opacity-only fade — no width animation, no layout shift.
        The aside's overflow-hidden clips the text as it shrinks.
        whitespace-nowrap prevents wrapping during the transition.
      */}
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="relative z-10 whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

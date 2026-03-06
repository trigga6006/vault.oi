import {
  Blocks,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  PanelLeft,
  Settings,
  UserRound,
  Workflow,
} from 'lucide-react';
import type React from 'react';
import { useUiStore, type NavView } from '../../store/ui-store';
import brandLogo from '../../../assets/logos/oilogov1.png';
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '../ui/sidebar';

interface NavItem {
  id: NavView;
  label: string;
  icon: React.ElementType;
}

const primaryItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'vault', label: 'Secrets', icon: KeyRound },
  { id: 'graph', label: 'Graph', icon: Workflow },
  { id: 'providers', label: 'Integrations', icon: Blocks },
  { id: 'projects', label: 'Workspaces', icon: FolderKanban },
  { id: 'credentials', label: 'Credentials', icon: UserRound },
];

const utilityItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { activeView, setActiveView } = useUiStore();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <SidebarRoot collapsible="icon" variant="sidebar">
      <SidebarHeader className="drag-region h-14 px-3">
        <div className="flex h-full items-center justify-between gap-2">
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-3">
              <div className="no-drag flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
                <img
                  src={brandLogo}
                  alt="vault.oi brand logo"
                  className="h-7 w-7 object-contain"
                />
              </div>
              <div className="no-drag min-w-0">
                <div className="truncate text-sm font-semibold tracking-[-0.02em] text-sidebar-foreground">
                  vault.oi
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  Secure developer workspace
                </div>
              </div>
            </div>
          )}
          <SidebarTrigger
            className={collapsed ? 'mx-auto' : 'shrink-0'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft className="h-4 w-4 rtl:rotate-180" />
          </SidebarTrigger>
        </div>
      </SidebarHeader>

      <SidebarContent className="no-drag">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Main</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarNavButton
                    item={item}
                    active={activeView === item.id}
                    collapsed={collapsed}
                    onClick={() => setActiveView(item.id)}
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="no-drag px-2 py-2">
        <SidebarMenu>
          {utilityItems.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarNavButton
                item={item}
                active={activeView === item.id}
                collapsed={collapsed}
                onClick={() => setActiveView(item.id)}
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  );
}

function SidebarNavButton({
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
    <SidebarMenuButton
      isActive={active}
      onClick={onClick}
      className={collapsed ? 'justify-center px-0' : 'gap-3'}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </SidebarMenuButton>
  );
}

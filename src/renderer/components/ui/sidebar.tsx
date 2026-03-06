import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { PanelLeftIcon } from 'lucide-react';
import { cn } from './cn';

const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_ICON = '4.5rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

type SidebarState = 'expanded' | 'collapsed';

type SidebarContextValue = {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }

    query.addListener(update);
    return () => query.removeListener(update);
  }, [breakpoint]);

  return isMobile;
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}

type SidebarProviderProps = React.ComponentProps<'div'> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const isMobile = useIsMobile();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [openMobile, setOpenMobile] = useState(false);

  const open = openProp ?? uncontrolledOpen;

  const setOpen = useCallback((nextOpen: boolean) => {
    if (openProp === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }, [onOpenChange, openProp]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
      return;
    }
    setOpen(!open);
  }, [isMobile, open, setOpen]);

  useEffect(() => {
    if (!isMobile && openMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, openMobile]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== SIDEBAR_KEYBOARD_SHORTCUT) return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSidebar]);

  const contextValue = useMemo<SidebarContextValue>(() => ({
    state: open ? 'expanded' : 'collapsed',
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  }), [isMobile, open, openMobile, setOpen, toggleSidebar]);

  const mergedStyle = {
    '--sidebar-width': SIDEBAR_WIDTH,
    '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
    '--sidebar-width-mobile': SIDEBAR_WIDTH_MOBILE,
    ...style,
  } as React.CSSProperties;

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        data-state={contextValue.state}
        className={cn('group/sidebar-wrapper flex h-full w-full', className)}
        style={mergedStyle}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

type SidebarProps = React.ComponentProps<'aside'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
  dir?: 'ltr' | 'rtl';
};

export function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  dir,
  ...props
}: SidebarProps) {
  const { isMobile, open, openMobile, setOpenMobile } = useSidebar();
  const collapsed = collapsible !== 'none' && !open;

  const desktopWidth = collapsible === 'none'
    ? 'var(--sidebar-width)'
    : collapsible === 'icon'
      ? (open ? 'var(--sidebar-width)' : 'var(--sidebar-width-icon)')
      : (open ? 'var(--sidebar-width)' : '0rem');

  const variantStyles = variant === 'floating'
    ? 'm-2 rounded-2xl shadow-2xl'
    : variant === 'inset'
      ? 'm-2 rounded-2xl border border-sidebar-border'
      : '';

  if (isMobile) {
    return (
      <>
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden',
            openMobile ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          )}
          onClick={() => setOpenMobile(false)}
          aria-hidden="true"
        />
        <aside
          data-slot="sidebar"
          data-mobile="true"
          data-side={side}
          dir={dir}
          className={cn(
            'glass-strong fixed inset-y-0 z-50 flex flex-col border-sidebar-border transition-transform duration-200 ease-out md:hidden',
            side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
            openMobile
              ? 'translate-x-0'
              : side === 'left'
                ? '-translate-x-full'
                : 'translate-x-full',
            className,
          )}
          style={{ width: 'var(--sidebar-width-mobile)' }}
          {...props}
        >
          {children}
        </aside>
      </>
    );
  }

  return (
    <div
      data-slot="sidebar-container"
      data-side={side}
      data-state={open ? 'expanded' : 'collapsed'}
      data-collapsible={collapsed ? collapsible : ''}
      data-variant={variant}
      className="relative hidden h-full shrink-0 transition-[width] duration-200 ease-out md:block"
      style={{ width: desktopWidth }}
    >
      <aside
        data-slot="sidebar"
        data-side={side}
        dir={dir}
        className={cn(
          'glass-strong relative flex h-full w-full flex-col overflow-hidden border-sidebar-border transition-transform duration-200 ease-out',
          side === 'left' ? 'border-r' : 'border-l',
          collapsible === 'offcanvas' && collapsed && (side === 'left' ? '-translate-x-full' : 'translate-x-full'),
          variantStyles,
          className,
        )}
        {...props}
      >
        {children}
      </aside>
    </div>
  );
}

export function SidebarInset({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-inset"
      className={cn('relative flex min-w-0 flex-1 flex-col overflow-hidden', className)}
      {...props}
    />
  );
}

export function SidebarTrigger({
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      className={cn(
        'no-drag inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/55 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          toggleSidebar();
        }
      }}
      {...props}
    >
      {children ?? <PanelLeftIcon className="h-4 w-4 rtl:rotate-180" />}
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  );
}

export function SidebarRail({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      onClick={toggleSidebar}
      className={cn(
        'no-drag absolute inset-y-0 -right-2 z-20 hidden w-4 cursor-col-resize transition-colors hover:after:bg-sidebar-border after:absolute after:inset-y-0 after:left-1/2 after:w-px md:flex',
        className,
      )}
      {...props}
    >
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn('shrink-0 border-b border-sidebar-border', className)}
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn('shrink-0 border-t border-sidebar-border', className)}
      {...props}
    />
  );
}

export function SidebarContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', className)}
      {...props}
    />
  );
}

export function SidebarGroup({
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="sidebar-group"
      className={cn('px-2 py-2', className)}
      {...props}
    />
  );
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn('px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground', className)}
      {...props}
    />
  );
}

export function SidebarGroupAction({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-slot="sidebar-group-action"
      className={cn(
        'inline-flex h-7 items-center justify-center rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn('space-y-1', className)}
      {...props}
    />
  );
}

export function SidebarMenu({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn('space-y-1', className)}
      {...props}
    />
  );
}

export function SidebarMenuItem({
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn('relative', className)}
      {...props}
    />
  );
}

type SidebarMenuButtonProps = React.ComponentProps<'button'> & {
  isActive?: boolean;
};

export function SidebarMenuButton({
  className,
  isActive = false,
  ...props
}: SidebarMenuButtonProps) {
  return (
    <button
      type="button"
      data-slot="sidebar-menu-button"
      data-active={isActive ? 'true' : 'false'}
      className={cn(
        'no-drag flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
        isActive
          ? 'border border-border bg-card/90 text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenuAction({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-slot="sidebar-menu-action"
      className={cn(
        'no-drag absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="sidebar-menu-badge"
      className={cn(
        'absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenuSub({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn('ml-5 mt-1 space-y-1 border-l border-sidebar-border pl-3', className)}
      {...props}
    />
  );
}

export function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      className={cn(className)}
      {...props}
    />
  );
}

export function SidebarMenuSubButton({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-slot="sidebar-menu-sub-button"
      className={cn(
        'no-drag flex w-full items-center rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

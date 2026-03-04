import { useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { Toaster } from 'sonner';
import { useUiStore } from '../../store/ui-store';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { activeView, theme, setTheme } = useUiStore();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('omniview-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }, [setTheme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem('omniview-theme', theme);
  }, [theme]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeView]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <Header />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <CommandPalette />
      <Toaster
        theme={theme}
        position="bottom-right"
        toastOptions={{
          className: 'glass-strong',
        }}
      />
    </div>
  );
}

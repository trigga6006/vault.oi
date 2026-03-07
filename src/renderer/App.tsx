import { lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
import { VaultSetup } from './components/vault/VaultSetup';
import { VaultUnlock } from './components/vault/VaultUnlock';
import { useUiStore } from './store/ui-store';
import { useVault } from './hooks/useVault';

const MainLayout = lazy(async () => ({
  default: (await import('./components/layout/MainLayout')).MainLayout,
}));

const DashboardView = lazy(async () => ({
  default: (await import('./components/dashboard/DashboardView')).DashboardView,
}));

const ProviderList = lazy(async () => ({
  default: (await import('./components/providers/ProviderList')).ProviderList,
}));

const SettingsView = lazy(async () => ({
  default: (await import('./components/settings/SettingsView')).SettingsView,
}));

const KeyVault = lazy(async () => ({
  default: (await import('./components/vault/KeyVault')).KeyVault,
}));

const ProjectsView = lazy(async () => ({
  default: (await import('./components/projects/ProjectsView')).ProjectsView,
}));

const CredentialsView = lazy(async () => ({
  default: (await import('./components/credentials/CredentialsView')).CredentialsView,
}));

const GraphView = lazy(async () => ({
  default: (await import('./components/graph/GraphView')).GraphView,
}));

function ViewRouter() {
  const { activeView } = useUiStore();

  switch (activeView) {
    case 'overview':
      return <DashboardView />;
    case 'providers':
      return <ProviderList />;
    case 'vault':
      return <KeyVault />;
    case 'graph':
      return <GraphView />;
    case 'projects':
      return <ProjectsView />;
    case 'credentials':
      return <CredentialsView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <DashboardView />;
  }
}

function LoadingScreen({ label = 'Loading workspace...' }: { label?: string }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function App() {
  const { initialized, unlocked, checking, initializeVault, unlockVault } =
    useVault();

  if (checking) {
    return <LoadingScreen label="Checking vault status..." />;
  }

  if (!initialized) {
    return (
      <>
        <Toaster position="bottom-center" />
        <VaultSetup onInitialize={initializeVault} />
      </>
    );
  }

  if (!unlocked) {
    return (
      <>
        <Toaster position="bottom-center" />
        <VaultUnlock onUnlock={unlockVault} />
      </>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <MainLayout>
        <ViewRouter />
      </MainLayout>
    </Suspense>
  );
}

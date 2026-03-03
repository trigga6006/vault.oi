import { MainLayout } from './components/layout/MainLayout';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProviderList } from './components/providers/ProviderList';
import { SettingsView } from './components/settings/SettingsView';
import { KeyVault } from './components/vault/KeyVault';
import { VaultSetup } from './components/vault/VaultSetup';
import { VaultUnlock } from './components/vault/VaultUnlock';
import { ProjectsView } from './components/projects/ProjectsView';
import { CredentialsView } from './components/credentials/CredentialsView';
import { useUiStore } from './store/ui-store';
import { useVault } from './hooks/useVault';

function ViewRouter() {
  const { activeView } = useUiStore();

  switch (activeView) {
    case 'overview':
      return <DashboardView />;
    case 'providers':
      return <ProviderList />;
    case 'vault':
      return <KeyVault />;
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

export function App() {
  const { initialized, unlocked, checking, initializeVault, unlockVault } =
    useVault();

  // Show nothing while checking vault status
  if (checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // First run: create vault
  if (!initialized) {
    return <VaultSetup onInitialize={initializeVault} />;
  }

  // Vault locked: unlock screen
  if (!unlocked) {
    return <VaultUnlock onUnlock={unlockVault} />;
  }

  // Vault unlocked: show main app
  return (
    <MainLayout>
      <ViewRouter />
    </MainLayout>
  );
}

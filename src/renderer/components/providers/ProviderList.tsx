import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Blocks, Plus } from 'lucide-react';
import { ProviderCard } from './ProviderCard';
import { ProviderConfigForm } from './ProviderConfigForm';
import { useProviderStore } from '../../store/provider-store';
import { toast } from 'sonner';
import type { ProviderConfigRecord } from '../../../shared/types/models.types';
import type { HealthCheckResult } from '../../../shared/types/provider.types';

export function ProviderList() {
  const [showForm, setShowForm] = useState(false);
  const [editProviderId, setEditProviderId] = useState<string | undefined>();
  const { providerConfigs, healthChecks, setProviderConfigs, setHealthCheck } = useProviderStore();

  const loadConfigs = useCallback(async () => {
    try {
      const configs = await window.omniview.invoke('config:list-providers', undefined) as ProviderConfigRecord[];
      setProviderConfigs(configs);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  }, [setProviderConfigs]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  async function handleHealthCheck(providerId: string) {
    try {
      const result = await window.omniview.invoke('provider:health-check', { providerId }) as HealthCheckResult;
      setHealthCheck(providerId, result);
    } catch {
      toast.error(`Health check failed for ${providerId}`);
    }
  }

  async function handleRemove(providerId: string) {
    try {
      await window.omniview.invoke('provider:deactivate', { providerId });
      toast.success(`Removed ${providerId}`);
      loadConfigs();
    } catch {
      toast.error(`Failed to remove ${providerId}`);
    }
  }

  function handleConfigure(providerId: string) {
    setEditProviderId(providerId);
    setShowForm(true);
  }

  function handleFormSaved() {
    setShowForm(false);
    setEditProviderId(undefined);
    loadConfigs();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Integrations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Configure the providers OmniView can route through, test connectivity,
            and keep endpoints ready for your local gateway.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditProviderId(undefined); setShowForm(true); }}
            className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/92"
          >
            <Plus className="h-4 w-4" />
            Add integration
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <ProviderConfigForm
            onSaved={handleFormSaved}
            onCancel={() => { setShowForm(false); setEditProviderId(undefined); }}
            editProviderId={editProviderId}
          />
        )}
      </AnimatePresence>

      {providerConfigs.length === 0 && !showForm ? (
        <div className="glass rounded-[28px] border border-white/8 p-12 flex flex-col items-center justify-center min-h-[320px] gap-4">
          <Blocks className="h-12 w-12 text-muted-foreground/50" />
          <div className="space-y-2 text-center">
            <p className="text-base font-medium text-foreground">
              No integrations configured yet
            </p>
            <p className="text-sm text-muted-foreground">
              Add your first provider connection so secrets can be routed into
              real requests.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {providerConfigs.map((config) => (
              <ProviderCard
                key={config.providerId}
                config={config}
                health={healthChecks[config.providerId]}
                onConfigure={handleConfigure}
                onRemove={handleRemove}
                onHealthCheck={handleHealthCheck}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

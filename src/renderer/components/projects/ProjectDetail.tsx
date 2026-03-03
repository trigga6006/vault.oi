import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EnvironmentBadge } from './EnvironmentBadge';
import type {
  Environment,
  ProjectKeyAssignment,
  ProjectRecord,
} from '../../../shared/types/project.types';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';

interface ProjectDetailProps {
  project: ProjectRecord;
  onBack: () => void;
}

export function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const [assignments, setAssignments] = useState<ProjectKeyAssignment[]>([]);
  const [allKeys, setAllKeys] = useState<ApiKeyMetadata[]>([]);
  const [addingEnv, setAddingEnv] = useState<Environment | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      const result = (await window.omniview.invoke('projects:get-keys', {
        projectId: project.id,
      })) as ProjectKeyAssignment[];
      setAssignments(result);
    } catch {
      toast.error('Failed to load workspace assignments');
    }
  }, [project.id]);

  const fetchKeys = useCallback(async () => {
    try {
      const result = (await window.omniview.invoke(
        'keys:list',
        undefined,
      )) as ApiKeyMetadata[];
      setAllKeys(result);
    } catch {
      toast.error('Failed to load secrets');
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
    fetchKeys();
  }, [fetchAssignments, fetchKeys]);

  async function handleAssign(env: Environment) {
    if (!selectedKeyId) return;
    try {
      await window.omniview.invoke('projects:assign-key', {
        projectId: project.id,
        apiKeyId: selectedKeyId,
        environment: env,
        isPrimary: true,
      });
      toast.success('Secret assigned');
      setAddingEnv(null);
      setSelectedKeyId(null);
      await fetchAssignments();
    } catch {
      toast.error('Failed to assign secret');
    }
  }

  async function handleUnassign(assignment: ProjectKeyAssignment) {
    try {
      await window.omniview.invoke('projects:unassign-key', {
        projectId: project.id,
        apiKeyId: assignment.apiKeyId,
        environment: assignment.environment,
      });
      toast.success('Secret removed');
      await fetchAssignments();
    } catch {
      toast.error('Failed to remove secret');
    }
  }

  const environments: Environment[] = ['dev', 'staging', 'prod'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {project.name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Environment-specific secret assignments for this workspace.
            </p>
          </div>
        </div>
      </div>

      {project.description && (
        <p className="text-sm leading-6 text-muted-foreground">
          {project.description}
        </p>
      )}

      {environments.map((env) => {
        const envAssignments = assignments.filter((item) => item.environment === env);
        return (
          <section
            key={env}
            className="glass rounded-[24px] border border-white/8 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <EnvironmentBadge environment={env} className="text-xs" />
              <button
                onClick={() => setAddingEnv(env)}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Assign secret
              </button>
            </div>

            {addingEnv === env && (
              <div className="flex items-center gap-2 rounded-2xl bg-secondary/30 p-2">
                <select
                  value={selectedKeyId ?? ''}
                  onChange={(e) => setSelectedKeyId(Number(e.target.value) || null)}
                  className="flex-1 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs text-foreground outline-none"
                >
                  <option value="">Select a secret...</option>
                  {allKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.providerId} - {key.keyLabel} ({key.keyPrefix}...)
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAssign(env)}
                  disabled={!selectedKeyId}
                  className="rounded-xl bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Assign
                </button>
                <button
                  onClick={() => {
                    setAddingEnv(null);
                    setSelectedKeyId(null);
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}

            {envAssignments.length === 0 && addingEnv !== env ? (
              <p className="text-xs text-muted-foreground/70">
                No secrets assigned.
              </p>
            ) : (
              <div className="space-y-2">
                {envAssignments.map((assignment) => {
                  const keyMeta = allKeys.find(
                    (key) => key.id === assignment.apiKeyId,
                  );

                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between rounded-2xl bg-secondary/20 px-3 py-2"
                    >
                      <span className="text-xs text-foreground">
                        {keyMeta?.providerId ?? '?'} - {keyMeta?.keyLabel ?? '?'}{' '}
                        <span className="text-muted-foreground">
                          ({keyMeta?.keyPrefix ?? '****'}...)
                        </span>
                        {assignment.isPrimary && (
                          <span className="ml-1.5 text-[10px] text-primary">
                            Primary
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => handleUnassign(assignment)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </motion.div>
  );
}

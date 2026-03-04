import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileUp, Loader2, X } from 'lucide-react';
import { DropdownSelect, type DropdownOption } from '../ui/DropdownSelect';
import type { Environment, ProjectRecord } from '../../../shared/types/project.types';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

interface CreateWorkspaceImportPayload {
  name: string;
  description: string;
  color: string;
  gitRepoPath: string;
  envFilePath: string;
  environment: Environment;
}

interface ImportWorkspaceEnvPayload {
  envFilePath: string;
  environment: Environment;
}

interface ProjectEnvImportDialogProps {
  mode: 'create' | 'import';
  project?: ProjectRecord | null;
  onCancel: () => void;
  onPickFile: () => Promise<string | null>;
  onCreate?: (data: CreateWorkspaceImportPayload) => Promise<void>;
  onImport?: (data: ImportWorkspaceEnvPayload) => Promise<void>;
}

export function ProjectEnvImportDialog({
  mode,
  project,
  onCancel,
  onPickFile,
  onCreate,
  onImport,
}: ProjectEnvImportDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [gitRepoPath, setGitRepoPath] = useState(project?.gitRepoPath ?? '');
  const [envFilePath, setEnvFilePath] = useState('');
  const [environment, setEnvironment] = useState<Environment>('dev');
  const [pickingFile, setPickingFile] = useState(false);
  const [saving, setSaving] = useState(false);

  const title = mode === 'create' ? 'Create workspace from .env' : `Import .env into ${project?.name ?? 'workspace'}`;
  const descriptionText = mode === 'create'
    ? 'Choose an environment file, create the workspace, and import every env variable into the vault with a default dev assignment.'
    : 'Choose an environment file and attach its variables to this workspace. Imported values will be assigned to the selected environment.';

  const environmentOptions: DropdownOption[] = useMemo(
    () => [
      { value: 'dev', label: 'Development', description: 'Local and day-to-day work.' },
      { value: 'staging', label: 'Staging', description: 'Pre-production validation.' },
      { value: 'prod', label: 'Production', description: 'Live deployment secrets.' },
    ],
    [],
  );

  async function handlePickFile() {
    setPickingFile(true);
    try {
      const selectedPath = await onPickFile();
      if (!selectedPath) return;

      setEnvFilePath(selectedPath);
      if (mode === 'create' && !name.trim()) {
        setName(deriveWorkspaceName(selectedPath));
      }
    } finally {
      setPickingFile(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!envFilePath) return;

    setSaving(true);
    try {
      if (mode === 'create') {
        if (!name.trim() || !onCreate) return;
        await onCreate({
          name: name.trim(),
          description,
          color,
          gitRepoPath,
          envFilePath,
          environment,
        });
      } else {
        if (!onImport) return;
        await onImport({
          envFilePath,
          environment,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="glass w-full max-w-2xl rounded-[28px] border border-white/10 p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {descriptionText}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {mode === 'create' && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Workspace name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="backend-api"
                      autoFocus
                      className="w-full rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Repository path</label>
                    <input
                      type="text"
                      value={gitRepoPath}
                      onChange={(event) => setGitRepoPath(event.target.value)}
                      placeholder="Optional linked repo path"
                      className="w-full rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Optional description..."
                    className="w-full rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        onClick={() => setColor(swatch)}
                        className="h-7 w-7 rounded-full border-2 transition-transform"
                        style={{
                          backgroundColor: swatch,
                          borderColor: color === swatch ? 'white' : 'transparent',
                          transform: color === swatch ? 'scale(1.08)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-4 md:grid-cols-[1.6fr_0.9fr]">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Environment file</label>
                <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                  <button
                    type="button"
                    onClick={handlePickFile}
                    disabled={pickingFile}
                    className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    {(pickingFile || saving) && <Loader2 className="h-4 w-4 animate-spin" />}
                    {!pickingFile && !saving && <FileUp className="h-4 w-4" />}
                    Choose .env
                  </button>
                  <div
                    className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-secondary/35 px-3 py-2.5"
                    title={envFilePath || undefined}
                  >
                    <p className={`truncate text-sm ${envFilePath ? 'font-mono text-foreground' : 'text-muted-foreground'}`}>
                      {envFilePath ? shortPath(envFilePath) : 'No file selected'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Assign imported values to</label>
                <DropdownSelect
                  value={environment}
                  onChange={(value) => setEnvironment(value as Environment)}
                  options={environmentOptions}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !envFilePath || (mode === 'create' && !name.trim())}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/92 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Create + import' : 'Import into workspace'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-2xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Show only the last two path segments so the pill stays compact.
// Full path is available via the title attribute on hover.
function shortPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return filePath;
  return `\u2026/${parts.slice(-2).join('/')}`;
}

function deriveWorkspaceName(filePath: string): string {
  const segments = filePath.split(/[\\/]/).filter(Boolean);
  if (segments.length >= 2) {
    return segments[segments.length - 2];
  }

  const fileName = segments[segments.length - 1] ?? 'workspace';
  return fileName.replace(/^\./, '').replace(/\.[^.]+$/, '') || 'workspace';
}

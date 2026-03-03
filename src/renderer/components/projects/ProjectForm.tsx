import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProjectRecord } from '../../../shared/types/project.types';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

interface ProjectFormProps {
  onSave: (data: { name: string; description: string; color: string; gitRepoPath: string }) => Promise<void>;
  onCancel: () => void;
  initial?: ProjectRecord;
}

export function ProjectForm({ onSave, onCancel, initial }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6366f1');
  const [gitRepoPath, setGitRepoPath] = useState(initial?.gitRepoPath ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description, color, gitRepoPath });
    } catch {
      toast.error('Failed to save project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass rounded-xl p-6 space-y-5 max-w-lg"
    >
      <h2 className="text-lg font-semibold text-foreground">
        {initial ? 'Edit Workspace' : 'Create Workspace'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Workspace Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Frontend app"
            autoFocus
            className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-6 w-6 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? 'white' : 'transparent',
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Git Repo Path <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <input
            type="text"
            value={gitRepoPath}
            onChange={(e) => setGitRepoPath(e.target.value)}
            placeholder="C:\\repos\\frontend-app"
            className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {initial ? 'Update Workspace' : 'Create Workspace'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderKanban, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectForm } from './ProjectForm';
import { ProjectDetail } from './ProjectDetail';
import { useProjectStore } from '../../store/project-store';
import type { ProjectRecord } from '../../../shared/types/project.types';

export function ProjectsView() {
  const { projects, setProjects } = useProjectStore();
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<ProjectRecord | null>(null);
  const [detailProject, setDetailProject] = useState<ProjectRecord | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const result = (await window.omniview.invoke(
        'projects:list',
        undefined,
      )) as ProjectRecord[];
      setProjects(result);
    } catch {
      toast.error('Failed to load projects');
    }
  }, [setProjects]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate(data: {
    name: string;
    description: string;
    color: string;
    gitRepoPath: string;
  }) {
    await window.omniview.invoke('projects:create', {
      name: data.name,
      description: data.description || undefined,
      color: data.color,
      gitRepoPath: data.gitRepoPath || undefined,
    });
    toast.success('Project created');
    setShowForm(false);
    await fetchProjects();
  }

  async function handleUpdate(data: {
    name: string;
    description: string;
    color: string;
    gitRepoPath: string;
  }) {
    if (!editProject) return;
    await window.omniview.invoke('projects:update', {
      id: editProject.id,
      name: data.name,
      description: data.description || undefined,
      color: data.color,
      gitRepoPath: data.gitRepoPath || undefined,
    });
    toast.success('Project updated');
    setEditProject(null);
    await fetchProjects();
  }

  async function handleDelete(id: number) {
    try {
      await window.omniview.invoke('projects:delete', { id });
      toast.success('Project deleted');
      await fetchProjects();
    } catch {
      toast.error('Failed to delete project');
    }
  }

  // Show project detail
  if (detailProject) {
    return (
      <ProjectDetail
        project={detailProject}
        onBack={() => {
          setDetailProject(null);
          fetchProjects();
        }}
      />
    );
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
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Workspaces</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Organize secrets by repo, product area, or team and map credentials
            cleanly across dev, staging, and prod.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/92"
        >
          <Plus className="h-4 w-4" />
          New Workspace
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <ProjectForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
        )}
        {editProject && (
          <ProjectForm
            initial={editProject}
            onSave={handleUpdate}
            onCancel={() => setEditProject(null)}
          />
        )}
      </AnimatePresence>

      {projects.length === 0 && !showForm ? (
        <div className="glass rounded-[28px] border border-white/8 p-12 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FolderKanban className="h-8 w-8 text-primary/60" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No workspaces yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a workspace to assign secrets by repo and environment
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/30 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create First Workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <motion.div
              key={project.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-[24px] border border-white/8 p-5 space-y-3 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setDetailProject(project)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <h3 className="text-sm font-medium text-foreground">
                    {project.name}
                  </h3>
                  {project.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setEditProject(project)}
                    className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {project.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {project.description}
                </p>
              )}
              <div className="text-[11px] text-muted-foreground/60">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

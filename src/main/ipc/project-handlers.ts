import { registerHandler } from './register-all';
import { projectService } from '../services/project-service';

export function registerProjectHandlers(): void {
  registerHandler('projects:list', async () => {
    return projectService.listProjects();
  });

  registerHandler('projects:get', async ({ id }) => {
    return projectService.getProject(id);
  });

  registerHandler('projects:create', async (data) => {
    return projectService.createProject(data);
  });

  registerHandler('projects:update', async ({ id, ...data }) => {
    await projectService.updateProject(id, data);
  });

  registerHandler('projects:delete', async ({ id }) => {
    await projectService.deleteProject(id);
  });

  registerHandler('projects:assign-key', async ({ projectId, apiKeyId, environment, isPrimary }) => {
    await projectService.assignKey(projectId, apiKeyId, environment, isPrimary);
  });

  registerHandler('projects:unassign-key', async ({ projectId, apiKeyId, environment }) => {
    await projectService.unassignKey(projectId, apiKeyId, environment);
  });

  registerHandler('projects:get-keys', async ({ projectId }) => {
    return projectService.getKeysForProject(projectId);
  });

  registerHandler('projects:set-active', async ({ projectId }) => {
    // Just acknowledge — active project is tracked in renderer state
    return { projectId };
  });
}

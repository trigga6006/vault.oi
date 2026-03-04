import { apiKeyRepo } from '../database/repositories/api-key.repo';
import { projectKeyRepo } from '../database/repositories/project-key.repo';
import { projectRepo } from '../database/repositories/project.repo';
import type { GraphEdge, GraphFocusTarget, GraphInsight, GraphMap, GraphNode, GraphTone } from '../../shared/types/graph.types';
import type { Environment } from '../../shared/types/project.types';

type ApiKeyRow = Awaited<ReturnType<typeof apiKeyRepo.getById>>;
type ProjectRow = Awaited<ReturnType<typeof projectRepo.getById>>;

interface AssignmentWithProject {
  id: number;
  projectId: number;
  apiKeyId: number;
  environment: Environment;
  isPrimary: boolean;
  project: NonNullable<ProjectRow>;
}

interface SecretRisk {
  code: string;
  label: string;
  subtitle: string;
  tone: GraphTone;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRES_SOON_DAYS = 14;
const STALE_DAYS = 90;

function formatRelativeDate(value: string | null): string {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const diffDays = Math.floor((Date.now() - date.getTime()) / DAY_MS);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

function formatAbsoluteDate(value: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function compactPathLabel(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) ?? normalized;
}

function getSecretRisks(secret: NonNullable<ApiKeyRow>, workspaceCount: number): SecretRisk[] {
  const risks: SecretRisk[] = [];
  const now = Date.now();

  if (!secret.isActive) {
    risks.push({
      code: 'inactive',
      label: 'Inactive',
      subtitle: 'This secret will not be selected for requests.',
      tone: 'warning',
    });
  }

  if (secret.expiresAt) {
    const expiresAt = new Date(secret.expiresAt).getTime();
    const diffDays = Math.ceil((expiresAt - now) / DAY_MS);
    if (diffDays < 0) {
      risks.push({
        code: 'expired',
        label: 'Expired',
        subtitle: `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago.`,
        tone: 'danger',
      });
    } else if (diffDays <= EXPIRES_SOON_DAYS) {
      risks.push({
        code: 'expires-soon',
        label: 'Expires soon',
        subtitle: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}.`,
        tone: 'warning',
      });
    }
  }

  if (!secret.lastVerifiedAt) {
    risks.push({
      code: 'unverified',
      label: 'Unverified',
      subtitle: 'No manual verification timestamp yet.',
      tone: 'warning',
    });
  }

  if (!secret.lastUsedAt) {
    risks.push({
      code: 'never-used',
      label: 'Never used',
      subtitle: 'No gateway usage has been recorded.',
      tone: 'info',
    });
  }

  const rotationAnchor = secret.lastRotatedAt ?? secret.createdAt;
  const staleDays = Math.floor((now - new Date(rotationAnchor).getTime()) / DAY_MS);
  if (staleDays >= STALE_DAYS) {
    risks.push({
      code: 'stale',
      label: 'Rotation stale',
      subtitle: `Last rotated or created ${staleDays} days ago.`,
      tone: 'warning',
    });
  }

  if (workspaceCount > 1) {
    risks.push({
      code: 'shared',
      label: 'Shared',
      subtitle: `Mapped into ${workspaceCount} workspaces.`,
      tone: 'info',
    });
  }

  return risks;
}

async function getAssignmentsForSecret(secretId: number): Promise<AssignmentWithProject[]> {
  const projects = await projectRepo.list();
  const assignments: AssignmentWithProject[] = [];

  for (const project of projects) {
    const projectAssignments = await projectKeyRepo.listForProject(project.id);
    for (const assignment of projectAssignments) {
      if (assignment.apiKeyId !== secretId) continue;
      assignments.push({ ...assignment, project });
    }
  }

  return assignments.sort((a, b) => {
    if (a.project.name === b.project.name) {
      if (a.environment === b.environment) return Number(b.isPrimary) - Number(a.isPrimary);
      return a.environment.localeCompare(b.environment);
    }
    return a.project.name.localeCompare(b.project.name);
  });
}

function createNode(node: GraphNode): GraphNode {
  return node;
}

function createEdge(edge: GraphEdge): GraphEdge {
  return edge;
}

function createInsight(insight: GraphInsight): GraphInsight {
  return insight;
}

export class GraphService {
  async getMap(focus: GraphFocusTarget): Promise<GraphMap> {
    if (focus.type === 'secret') {
      return this.buildSecretMap(focus.id);
    }

    return this.buildWorkspaceMap(focus.id);
  }

  private async buildSecretMap(secretId: number): Promise<GraphMap> {
    const secret = await apiKeyRepo.getById(secretId);
    if (!secret) {
      throw new Error('Secret not found');
    }

    const assignments = await getAssignmentsForSecret(secretId);
    const workspaceCount = new Set(assignments.map((assignment) => assignment.projectId)).size;
    const risks = getSecretRisks(secret, workspaceCount);

    const nodes: GraphNode[] = [
      createNode({
        id: `secret:${secret.id}`,
        label: secret.keyLabel,
        subtitle: `${secret.providerId} • ${secret.keyPrefix ?? 'masked'}...`,
        kind: 'secret',
        tone: 'info',
        column: 0,
        order: 0,
        emphasis: true,
      }),
    ];
    const edges: GraphEdge[] = [];
    const warnings: string[] = [];

    const workspaceOrder = new Map<number, number>();
    assignments.forEach((assignment) => {
      if (!workspaceOrder.has(assignment.projectId)) {
        workspaceOrder.set(assignment.projectId, workspaceOrder.size);
        nodes.push(createNode({
          id: `workspace:${assignment.projectId}`,
          label: assignment.project.name,
          subtitle: assignment.project.gitRepoPath ? compactPathLabel(assignment.project.gitRepoPath) : 'Workspace mapping',
          badge: assignment.project.isDefault ? 'Default' : undefined,
          kind: 'workspace',
          tone: 'neutral',
          column: 1,
          order: workspaceOrder.size - 1,
        }));
        edges.push(createEdge({
          id: `secret:${secret.id}:workspace:${assignment.projectId}`,
          source: `secret:${secret.id}`,
          target: `workspace:${assignment.projectId}`,
          label: 'mapped to',
          tone: 'info',
        }));
      }
    });

    assignments.forEach((assignment, index) => {
      nodes.push(createNode({
        id: `environment:${assignment.id}`,
        label: assignment.environment.toUpperCase(),
        subtitle: assignment.project.name,
        badge: assignment.isPrimary ? 'Primary' : 'Assigned',
        kind: 'environment',
        tone: assignment.isPrimary ? 'success' : 'neutral',
        column: 2,
        order: index,
      }));
      edges.push(createEdge({
        id: `workspace:${assignment.projectId}:environment:${assignment.id}`,
        source: `workspace:${assignment.projectId}`,
        target: `environment:${assignment.id}`,
        label: assignment.isPrimary ? 'primary' : 'assigned',
        tone: assignment.isPrimary ? 'success' : 'neutral',
      }));
    });

    if (secret.generatedWhere) {
      nodes.push(createNode({
        id: `source:${secret.id}`,
        label: compactPathLabel(secret.generatedWhere),
        subtitle: secret.generatedWhere,
        kind: 'source',
        tone: 'info',
        column: 3,
        order: 0,
      }));
      edges.push(createEdge({
        id: `secret:${secret.id}:source`,
        source: `secret:${secret.id}`,
        target: `source:${secret.id}`,
        label: 'origin',
        tone: 'info',
      }));
    } else {
      warnings.push('This secret does not have a recorded source path yet.');
    }

    risks.forEach((risk, index) => {
      nodes.push(createNode({
        id: `risk:${secret.id}:${risk.code}`,
        label: risk.label,
        subtitle: risk.subtitle,
        kind: 'risk',
        tone: risk.tone,
        column: 4,
        order: index,
      }));
      edges.push(createEdge({
        id: `secret:${secret.id}:risk:${risk.code}`,
        source: `secret:${secret.id}`,
        target: `risk:${secret.id}:${risk.code}`,
        label: 'risk',
        tone: risk.tone,
      }));
    });

    if (assignments.length === 0) {
      warnings.push('This secret is not assigned to any workspace yet.');
    }

    return {
      focus: { type: 'secret', id: secret.id },
      title: secret.keyLabel,
      subtitle: 'Secret dependency map based on current vault metadata and workspace assignments.',
      columns: [
        { index: 0, label: 'Secret' },
        { index: 1, label: 'Workspaces' },
        { index: 2, label: 'Environments' },
        { index: 3, label: 'Source' },
        { index: 4, label: 'Risk' },
      ],
      nodes,
      edges,
      insights: [
        createInsight({ id: 'provider', label: 'Provider', value: secret.providerId, tone: 'info' }),
        createInsight({ id: 'workspaces', label: 'Workspaces', value: String(workspaceCount), tone: workspaceCount > 1 ? 'warning' : 'neutral' }),
        createInsight({ id: 'last-used', label: 'Last used', value: formatRelativeDate(secret.lastUsedAt), tone: secret.lastUsedAt ? 'neutral' : 'warning' }),
        createInsight({ id: 'last-updated', label: 'Last updated', value: formatAbsoluteDate(secret.updatedAt), tone: 'neutral' }),
        createInsight({ id: 'expires', label: 'Expires', value: formatAbsoluteDate(secret.expiresAt), tone: secret.expiresAt ? 'warning' : 'neutral' }),
      ],
      warnings,
    };
  }

  private async buildWorkspaceMap(projectId: number): Promise<GraphMap> {
    const project = await projectRepo.getById(projectId);
    if (!project) {
      throw new Error('Workspace not found');
    }

    const assignments = await projectKeyRepo.listForProject(project.id);
    const keys = await Promise.all(assignments.map((assignment) => apiKeyRepo.getById(assignment.apiKeyId)));
    const keysById = new Map<number, NonNullable<ApiKeyRow>>();
    keys.forEach((key) => {
      if (key) keysById.set(key.id, key);
    });

    const nodes: GraphNode[] = [
      createNode({
        id: `workspace:${project.id}`,
        label: project.name,
        subtitle: project.gitRepoPath ? compactPathLabel(project.gitRepoPath) : 'Workspace',
        badge: project.isDefault ? 'Default' : undefined,
        kind: 'workspace',
        tone: 'info',
        column: 0,
        order: 0,
        emphasis: true,
      }),
    ];
    const edges: GraphEdge[] = [];
    const warnings: string[] = [];
    const secretOrder = new Map<number, number>();
    const sourceOrder = new Map<string, number>();
    let riskIndex = 0;

    assignments.forEach((assignment) => {
      const key = keysById.get(assignment.apiKeyId);
      if (!key) return;

      if (!secretOrder.has(key.id)) {
        secretOrder.set(key.id, secretOrder.size);
        nodes.push(createNode({
          id: `secret:${key.id}`,
          label: key.keyLabel,
          subtitle: `${key.providerId} • ${key.keyPrefix ?? 'masked'}...`,
          kind: 'secret',
          tone: 'neutral',
          column: 1,
          order: secretOrder.size - 1,
        }));
        edges.push(createEdge({
          id: `workspace:${project.id}:secret:${key.id}`,
          source: `workspace:${project.id}`,
          target: `secret:${key.id}`,
          label: 'contains',
          tone: 'info',
        }));

        if (key.generatedWhere) {
          if (!sourceOrder.has(key.generatedWhere)) {
            sourceOrder.set(key.generatedWhere, sourceOrder.size);
            nodes.push(createNode({
              id: `source:${Buffer.from(key.generatedWhere).toString('base64url')}`,
              label: compactPathLabel(key.generatedWhere),
              subtitle: key.generatedWhere,
              kind: 'source',
              tone: 'info',
              column: 3,
              order: sourceOrder.size - 1,
            }));
          }
          edges.push(createEdge({
            id: `secret:${key.id}:source:${Buffer.from(key.generatedWhere).toString('base64url')}`,
            source: `secret:${key.id}`,
            target: `source:${Buffer.from(key.generatedWhere).toString('base64url')}`,
            label: 'origin',
            tone: 'info',
          }));
        }

        const risks = getSecretRisks(key, 1);
        risks.forEach((risk) => {
          nodes.push(createNode({
            id: `risk:${key.id}:${risk.code}`,
            label: risk.label,
            subtitle: `${key.keyLabel} • ${risk.subtitle}`,
            kind: 'risk',
            tone: risk.tone,
            column: 4,
            order: riskIndex++,
          }));
          edges.push(createEdge({
            id: `secret:${key.id}:risk:${risk.code}`,
            source: `secret:${key.id}`,
            target: `risk:${key.id}:${risk.code}`,
            label: 'risk',
            tone: risk.tone,
          }));
        });
      }

      nodes.push(createNode({
        id: `environment:${assignment.id}`,
        label: assignment.environment.toUpperCase(),
        subtitle: key.keyLabel,
        badge: assignment.isPrimary ? 'Primary' : 'Assigned',
        kind: 'environment',
        tone: assignment.isPrimary ? 'success' : 'neutral',
        column: 2,
        order: nodes.filter((node) => node.kind === 'environment').length,
      }));
      edges.push(createEdge({
        id: `secret:${key.id}:environment:${assignment.id}`,
        source: `secret:${key.id}`,
        target: `environment:${assignment.id}`,
        label: assignment.isPrimary ? 'primary' : 'assigned',
        tone: assignment.isPrimary ? 'success' : 'neutral',
      }));
    });

    if (assignments.length === 0) {
      warnings.push('This workspace does not have any assigned secrets yet.');
    }

    const expiringSoon = Array.from(keysById.values()).filter((key) => {
      if (!key.expiresAt) return false;
      const diffDays = Math.ceil((new Date(key.expiresAt).getTime() - Date.now()) / DAY_MS);
      return diffDays >= 0 && diffDays <= EXPIRES_SOON_DAYS;
    }).length;

    const sourcedSecrets = Array.from(keysById.values()).filter((key) => !!key.generatedWhere).length;

    return {
      focus: { type: 'workspace', id: project.id },
      title: project.name,
      subtitle: 'Workspace dependency map based on current secret assignments and recorded source metadata.',
      columns: [
        { index: 0, label: 'Workspace' },
        { index: 1, label: 'Secrets' },
        { index: 2, label: 'Environments' },
        { index: 3, label: 'Sources' },
        { index: 4, label: 'Risk' },
      ],
      nodes,
      edges,
      insights: [
        createInsight({ id: 'assigned', label: 'Assigned secrets', value: String(keysById.size), tone: 'info' }),
        createInsight({ id: 'env-links', label: 'Environment links', value: String(assignments.length), tone: 'neutral' }),
        createInsight({ id: 'expiring', label: 'Expiring soon', value: String(expiringSoon), tone: expiringSoon > 0 ? 'warning' : 'success' }),
        createInsight({ id: 'sourced', label: 'With source path', value: String(sourcedSecrets), tone: sourcedSecrets > 0 ? 'info' : 'neutral' }),
        createInsight({ id: 'updated', label: 'Last updated', value: formatAbsoluteDate(project.updatedAt), tone: 'neutral' }),
      ],
      warnings,
    };
  }
}

export const graphService = new GraphService();

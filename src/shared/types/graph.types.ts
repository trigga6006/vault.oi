export type GraphFocusTarget =
  | { type: 'secret'; id: number }
  | { type: 'workspace'; id: number };

export type GraphNodeKind = 'secret' | 'workspace' | 'environment' | 'source' | 'risk';
export type GraphTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface GraphColumn {
  index: number;
  label: string;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  tone: GraphTone;
  column: number;
  order: number;
  subtitle?: string;
  badge?: string;
  emphasis?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  tone: GraphTone;
}

export interface GraphInsight {
  id: string;
  label: string;
  value: string;
  tone: GraphTone;
}

export interface GraphMap {
  focus: GraphFocusTarget;
  title: string;
  subtitle: string;
  columns: GraphColumn[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  insights: GraphInsight[];
  warnings: string[];
}

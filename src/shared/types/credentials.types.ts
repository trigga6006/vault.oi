export interface CredentialRecord {
  id: number;
  title: string;
  providerId: string | null;
  projectId: number | null;
  projectName: string | null;
  username: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCredentialPayload {
  title: string;
  providerId?: string | null;
  projectId?: number | null;
  username: string;
  password: string;
  notes?: string;
}

export interface UpdateCredentialPayload {
  id: number;
  title?: string;
  providerId?: string | null;
  projectId?: number | null;
  username?: string;
  password?: string;
  notes?: string;
}

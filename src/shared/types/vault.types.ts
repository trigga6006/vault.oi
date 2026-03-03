export interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  autoLockMinutes: number;
}

export interface ApiKeyMetadata {
  id: number;
  providerId: string;
  keyLabel: string;
  keyPrefix: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  lastRotatedAt: string | null;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  serviceType: string | null;
  generatedWhere: string | null;
  notes: string | null;
}

export interface StoreKeyPayload {
  providerId: string;
  apiKey: string;
  label?: string;
  notes?: string;
  serviceType?: string;
  generatedWhere?: string;
  expiresAt?: string;
}

export interface RotateKeyPayload {
  id: number;
  newKey: string;
}

export interface UpdateKeyPayload {
  id: number;
  label?: string;
  notes?: string;
  serviceType?: string;
  generatedWhere?: string;
  expiresAt?: string | null;
  lastVerifiedAt?: string;
  isActive?: boolean;
}

export interface TestKeyPayload {
  providerId: string;
  apiKey: string;
}

export interface VaultInitPayload {
  password: string;
}

export interface VaultUnlockPayload {
  password: string;
}

export interface VaultChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface VaultAutoLockPayload {
  minutes: number;
}

export interface SecretsImportResult {
  imported: number;
  skipped: number;
  source: '.env' | 'csv' | 'json';
}

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
  lastUsedAt: string | null;
  lastRotatedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
}

export interface StoreKeyPayload {
  providerId: string;
  apiKey: string;
  label?: string;
  notes?: string;
}

export interface RotateKeyPayload {
  id: number;
  newKey: string;
}

export interface UpdateKeyPayload {
  id: number;
  label?: string;
  notes?: string;
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

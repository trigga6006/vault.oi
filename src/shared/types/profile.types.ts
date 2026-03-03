export interface VaultProfile {
  id: string;
  name: string;
  createdAt: string;
}

export interface VaultProfileState {
  activeProfileId: string;
  profiles: VaultProfile[];
}

export interface CreateVaultProfilePayload {
  name: string;
}

export interface SwitchVaultProfilePayload {
  profileId: string;
}

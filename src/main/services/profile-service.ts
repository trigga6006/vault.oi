import fs from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import type { VaultProfile, VaultProfileState } from '../../shared/types/profile.types';
import { closeDatabase, initializeDatabase, setDatabaseProfile } from '../database/connection';
import { vaultService } from './vault-service';

const DEFAULT_PROFILE_ID = 'personal';
const DEFAULT_PROFILE_NAME = 'Personal';
const PROFILES_FILE_NAME = 'vault-profiles.json';

interface ProfileStorage {
  activeProfileId: string;
  profiles: VaultProfile[];
}

const PROFILE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyProfileId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function isValidProfileId(profileId: string): boolean {
  return PROFILE_ID_PATTERN.test(profileId);
}

function createInitialState(): ProfileStorage {
  return {
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: DEFAULT_PROFILE_NAME,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export class ProfileService {
  private state: ProfileStorage | null = null;

  private get storagePath(): string {
    return path.join(app.getPath('userData'), PROFILES_FILE_NAME);
  }

  async initialize(): Promise<VaultProfileState> {
    const loaded = await this.loadState();
    const active = loaded.profiles.find((p) => p.id === loaded.activeProfileId) ?? loaded.profiles[0];
    loaded.activeProfileId = active.id;
    this.state = loaded;
    setDatabaseProfile(active.id);
    return {
      activeProfileId: loaded.activeProfileId,
      profiles: loaded.profiles,
    };
  }

  async getState(): Promise<VaultProfileState> {
    if (!this.state) {
      await this.initialize();
    }

    const state = this.state ?? (await this.loadState());
    this.state = state;
    return {
      activeProfileId: state.activeProfileId,
      profiles: state.profiles,
    };
  }

  async createProfile(name: string): Promise<VaultProfile> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Profile name is required');
    }

    if (!this.state) {
      await this.initialize();
    }

    const idBase = slugifyProfileId(trimmed);
    if (!idBase) {
      throw new Error('Profile name must include letters or numbers');
    }

    let id = idBase;
    let suffix = 2;
    const state = this.state;
    if (!state) throw new Error('Profile state unavailable');

    while (state.profiles.some((profile) => profile.id === id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }

    const profile: VaultProfile = {
      id,
      name: trimmed,
      createdAt: new Date().toISOString(),
    };

    state.profiles.push(profile);
    await this.saveState(state);
    return profile;
  }

  async switchProfile(profileId: string): Promise<void> {
    if (!this.state) {
      await this.initialize();
    }

    const state = this.state;
    if (!state) throw new Error('Profile state unavailable');

    const target = state.profiles.find((profile) => profile.id === profileId);
    if (!target) {
      throw new Error('Profile not found');
    }

    if (state.activeProfileId === profileId) {
      return;
    }

    state.activeProfileId = profileId;
    await this.saveState(state);

    closeDatabase();
    setDatabaseProfile(profileId);
    initializeDatabase();
    vaultService.lock();
    await vaultService.checkInitialized();

    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('profile:switched', { profileId });
        win.webContents.reload();
      }
    }
  }

  private async loadState(): Promise<ProfileStorage> {
    try {
      const content = await fs.readFile(this.storagePath, 'utf8');
      const parsed = JSON.parse(content) as ProfileStorage;

      if (!Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
        throw new Error('Invalid profile state');
      }

      const uniqueProfiles = new Map<string, VaultProfile>();
      for (const profile of parsed.profiles) {
        if (!profile || typeof profile.id !== 'string' || !isValidProfileId(profile.id)) continue;
        if (typeof profile.name !== 'string' || !profile.name.trim()) continue;
        if (uniqueProfiles.has(profile.id)) continue;

        uniqueProfiles.set(profile.id, {
          id: profile.id,
          name: profile.name.trim(),
          createdAt: profile.createdAt || new Date().toISOString(),
        });
      }

      if (uniqueProfiles.size === 0) {
        throw new Error('Invalid profile state');
      }

      const profiles = Array.from(uniqueProfiles.values());
      const hasActiveProfile =
        typeof parsed.activeProfileId === 'string' && profiles.some((profile) => profile.id === parsed.activeProfileId);
      const activeProfileId = hasActiveProfile ? parsed.activeProfileId : profiles[0].id;

      return { activeProfileId, profiles };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        const initial = createInitialState();
        await this.saveState(initial);
        return initial;
      }

      throw error;
    }
  }

  private async saveState(state: ProfileStorage): Promise<void> {
    await fs.writeFile(this.storagePath, JSON.stringify(state, null, 2), 'utf8');
  }
}

export const profileService = new ProfileService();

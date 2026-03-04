import { BrowserWindow } from 'electron';
import { getRawDatabase } from '../database/connection';
import { apiKeyRepo } from '../database/repositories/api-key.repo';

interface RotationPolicy {
  id: number;
  projectId: number | null;
  providerId: string;
  rotationIntervalDays: number;
  reminderDaysBefore: number;
  enabled: boolean;
}

interface RotationReminder {
  keyId: number;
  providerId: string;
  keyLabel: string;
  ageDays: number;
  policyDays: number;
}

export class KeyRotationService {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    // Check every hour
    this.timer = setInterval(() => this.checkRotations(), 60 * 60 * 1000);
    // Initial check after 30 seconds
    setTimeout(() => this.checkRotations(), 30000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkRotations(): Promise<RotationReminder[]> {
    const reminders: RotationReminder[] = [];

    try {
      const policies = this.getPolicies().filter((p) => p.enabled);
      if (policies.length === 0) return reminders;

      const keys = await apiKeyRepo.list();
      const now = Date.now();

      for (const policy of policies) {
        const providerKeys = keys.filter(
          (k) => k.providerId === policy.providerId && k.isActive,
        );

        for (const key of providerKeys) {
          const createdAt = new Date(key.createdAt).getTime();
          const lastRotated = key.lastRotatedAt
            ? new Date(key.lastRotatedAt).getTime()
            : createdAt;

          const ageDays = Math.floor((now - lastRotated) / (1000 * 60 * 60 * 24));
          const reminderThreshold =
            policy.rotationIntervalDays - policy.reminderDaysBefore;

          if (ageDays >= reminderThreshold) {
            reminders.push({
              keyId: key.id,
              providerId: key.providerId,
              keyLabel: key.keyLabel,
              ageDays,
              policyDays: policy.rotationIntervalDays,
            });
          }
        }
      }

      // Emit to renderer
      if (reminders.length > 0) {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('key:rotation-reminder', reminders);
          }
        }
      }
    } catch (err) {
      console.warn('[KeyRotation] Check failed:', err);
    }

    return reminders;
  }

  getPolicies(): RotationPolicy[] {
    const raw = getRawDatabase();
    if (!raw) return [];
    try {
      return raw
        .prepare('SELECT * FROM key_rotation_policies')
        .all() as RotationPolicy[];
    } catch {
      return [];
    }
  }

  setPolicy(data: {
    providerId: string;
    projectId?: number;
    rotationIntervalDays: number;
    reminderDaysBefore: number;
    enabled: boolean;
  }): void {
    const raw = getRawDatabase();
    if (!raw) return;

    raw.prepare(`
      INSERT INTO key_rotation_policies (provider_id, project_id, rotation_interval_days, reminder_days_before, enabled)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      data.providerId,
      data.projectId ?? null,
      data.rotationIntervalDays,
      data.reminderDaysBefore,
      data.enabled ? 1 : 0,
    );
  }

  deletePoliciesForProject(projectId: number): void {
    const raw = getRawDatabase();
    if (!raw) return;

    raw.prepare('DELETE FROM key_rotation_policies WHERE project_id = ?').run(projectId);
  }
}

export const keyRotationService = new KeyRotationService();

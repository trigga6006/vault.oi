import crypto from 'node:crypto';
import { argon2id } from '@noble/hashes/argon2.js';
import { vaultRepo } from '../database/repositories/vault.repo';
import type { VaultStatus } from '../../shared/types/vault.types';
import { BrowserWindow } from 'electron';

const SENTINEL = 'omniview-vault-sentinel-v1';
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits for AES-256-GCM
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const KDF_DEFAULTS = {
  algorithm: 'argon2id' as const,
  timeCost: 3,
  memoryCost: 65536, // 64 MB
  parallelism: 1,
};

export class VaultService {
  private derivedKey: Buffer | null = null;
  private autoLockTimer: ReturnType<typeof setTimeout> | null = null;
  private autoLockMinutes = 15;
  private _initialized = false;
  private _unlocked = false;
  private failedAttempts = 0;
  private lockoutUntil = 0;

  get isInitialized() {
    return this._initialized;
  }

  get isUnlocked() {
    return this._unlocked;
  }

  async checkInitialized(): Promise<boolean> {
    const meta = await vaultRepo.get();
    this._initialized = meta !== null;
    if (meta) {
      this.autoLockMinutes = meta.autoLockMinutes;
    }
    return this._initialized;
  }

  getStatus(): VaultStatus {
    return {
      initialized: this._initialized,
      unlocked: this._unlocked,
      autoLockMinutes: this.autoLockMinutes,
    };
  }

  /** First-time setup: create vault with master password */
  async initialize(password: string): Promise<void> {
    const existing = await vaultRepo.get();
    if (existing) {
      throw new Error('Vault already initialized');
    }

    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = this.deriveKey(password, salt);

    const verificationCiphertext = this.encryptWithKey(SENTINEL, key);

    await vaultRepo.create({
      salt,
      kdfAlgorithm: KDF_DEFAULTS.algorithm,
      kdfTimeCost: KDF_DEFAULTS.timeCost,
      kdfMemoryCost: KDF_DEFAULTS.memoryCost,
      kdfParallelism: KDF_DEFAULTS.parallelism,
      verificationCiphertext,
      autoLockMinutes: this.autoLockMinutes,
    });

    this.derivedKey = key;
    this._initialized = true;
    this._unlocked = true;
    this.resetAutoLockTimer();
  }

  /** Unlock vault with master password (rate-limited) */
  async unlock(password: string): Promise<boolean> {
    // Rate limiting: exponential backoff after 5 failures
    if (this.lockoutUntil > Date.now()) {
      const waitSec = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
      throw new Error(`Too many attempts. Try again in ${waitSec} seconds.`);
    }

    const meta = await vaultRepo.get();
    if (!meta) {
      throw new Error('Vault not initialized');
    }

    const salt = meta.salt;
    const key = this.deriveKey(password, salt);

    try {
      const decrypted = this.decryptWithKey(meta.verificationCiphertext, key);
      if (decrypted !== SENTINEL) {
        this.failedAttempts++;
        if (this.failedAttempts >= 5) {
          // Exponential backoff: 2^(attempts-5) seconds, capped at 5 minutes
          const delaySec = Math.min(Math.pow(2, this.failedAttempts - 5), 300);
          this.lockoutUntil = Date.now() + delaySec * 1000;
        }
        key.fill(0);
        return false;
      }
    } catch {
      this.failedAttempts++;
      if (this.failedAttempts >= 5) {
        const delaySec = Math.min(Math.pow(2, this.failedAttempts - 5), 300);
        this.lockoutUntil = Date.now() + delaySec * 1000;
      }
      key.fill(0);
      return false;
    }

    this.failedAttempts = 0;
    this.lockoutUntil = 0;
    this.derivedKey = key;
    this._unlocked = true;
    this.autoLockMinutes = meta.autoLockMinutes;
    this.resetAutoLockTimer();
    return true;
  }

  /** Lock vault — zero key from memory */
  lock(): void {
    if (this.derivedKey) {
      this.derivedKey.fill(0);
      this.derivedKey = null;
    }
    this._unlocked = false;
    this.clearAutoLockTimer();

    // Notify renderer
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('vault:locked');
      }
    }
  }

  /** Change master password — re-encrypt all stored keys */
  async changePassword(
    currentPassword: string,
    newPassword: string,
    reEncryptCallback?: (oldDecrypt: (ct: string) => string, newEncrypt: (pt: string) => string) => Promise<void>,
  ): Promise<boolean> {
    const meta = await vaultRepo.get();
    if (!meta) throw new Error('Vault not initialized');

    // Verify current password
    const oldKey = this.deriveKey(currentPassword, meta.salt);
    try {
      const decrypted = this.decryptWithKey(meta.verificationCiphertext, oldKey);
      if (decrypted !== SENTINEL) return false;
    } catch {
      return false;
    }

    // Derive new key with fresh salt
    const newSalt = crypto.randomBytes(SALT_LENGTH);
    const newKey = this.deriveKey(newPassword, newSalt);
    const newVerification = this.encryptWithKey(SENTINEL, newKey);

    // Re-encrypt all stored data
    if (reEncryptCallback) {
      await reEncryptCallback(
        (ct: string) => this.decryptWithKey(ct, oldKey),
        (pt: string) => this.encryptWithKey(pt, newKey),
      );
    }

    // Update vault metadata
    await vaultRepo.updateSaltAndVerification(meta.id, newSalt, newVerification);

    // Zero old key
    oldKey.fill(0);
    if (this.derivedKey) this.derivedKey.fill(0);

    this.derivedKey = newKey;
    this.resetAutoLockTimer();
    return true;
  }

  /** Set auto-lock timeout */
  async setAutoLock(minutes: number): Promise<void> {
    this.autoLockMinutes = minutes;
    const meta = await vaultRepo.get();
    if (meta) {
      await vaultRepo.updateAutoLock(meta.id, minutes);
    }
    this.resetAutoLockTimer();
  }

  /** Encrypt plaintext using the derived key */
  encrypt(plaintext: string): string {
    if (!this.derivedKey) {
      throw new Error('Vault is locked');
    }
    this.resetAutoLockTimer();
    return this.encryptWithKey(plaintext, this.derivedKey);
  }

  /** Decrypt ciphertext using the derived key */
  decrypt(ciphertext: string): string {
    if (!this.derivedKey) {
      throw new Error('Vault is locked');
    }
    this.resetAutoLockTimer();
    return this.decryptWithKey(ciphertext, this.derivedKey);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private deriveKey(password: string, salt: Buffer): Buffer {
    const hash = argon2id(password, salt, {
      t: KDF_DEFAULTS.timeCost,
      m: KDF_DEFAULTS.memoryCost,
      p: KDF_DEFAULTS.parallelism,
      dkLen: KEY_LENGTH,
    });
    return Buffer.from(hash);
  }

  private encryptWithKey(plaintext: string, key: Buffer): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    // Format: base64(iv + authTag + ciphertext)
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  private decryptWithKey(ciphertext: string, key: Buffer): string {
    const combined = Buffer.from(ciphertext, 'base64');
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf-8');
  }

  private resetAutoLockTimer(): void {
    this.clearAutoLockTimer();
    if (this.autoLockMinutes > 0 && this._unlocked) {
      this.autoLockTimer = setTimeout(
        () => this.lock(),
        this.autoLockMinutes * 60 * 1000,
      );
    }
  }

  private clearAutoLockTimer(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }
}

export const vaultService = new VaultService();

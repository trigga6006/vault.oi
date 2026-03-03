import fs from 'node:fs';
import { dialog } from 'electron';
import { apiKeyRepo } from '../database/repositories/api-key.repo';
import { vaultService } from './vault-service';
import { PROVIDER_IDS } from '../../shared/constants/provider-ids';
import type { SecretsImportResult } from '../../shared/types/vault.types';

type SecretInput = {
  providerId: string;
  label: string;
  secret: string;
  notes?: string;
};

const KNOWN_PROVIDERS = new Set(Object.values(PROVIDER_IDS));

const ENV_PROVIDER_HINTS: Array<{ pattern: RegExp; providerId: string }> = [
  { pattern: /OPENAI/i, providerId: 'openai' },
  { pattern: /ANTHROPIC|CLAUDE/i, providerId: 'anthropic' },
  { pattern: /GEMINI|GOOGLE/i, providerId: 'google' },
  { pattern: /XAI|GROK/i, providerId: 'xai' },
  { pattern: /MISTRAL/i, providerId: 'mistral' },
  { pattern: /COHERE/i, providerId: 'cohere' },
  { pattern: /TOGETHER/i, providerId: 'together' },
  { pattern: /FIREWORKS/i, providerId: 'fireworks' },
  { pattern: /HUGGING ?FACE|HF_/i, providerId: 'huggingface' },
  { pattern: /PERPLEXITY/i, providerId: 'perplexity' },
  { pattern: /OLLAMA/i, providerId: 'ollama' },
  { pattern: /OPENROUTER/i, providerId: 'openrouter' },
  { pattern: /DEEPSEEK/i, providerId: 'deepseek' },
  { pattern: /QWEN|DASHSCOPE/i, providerId: 'qwen' },
  { pattern: /COPILOT/i, providerId: 'copilot' },
  { pattern: /CURSOR/i, providerId: 'cursor' },
];

export class SecretsImportService {
  async importFromFile(): Promise<SecretsImportResult> {
    if (!vaultService.isUnlocked) {
      throw new Error('Vault must be unlocked to import secrets');
    }

    const result = await dialog.showOpenDialog({
      title: 'Import Secrets',
      filters: [
        { name: 'Environment files', extensions: ['env', 'txt'] },
        { name: 'CSV files', extensions: ['csv'] },
        { name: 'JSON files', extensions: ['json'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { imported: 0, skipped: 0, source: '.env' };
    }

    const filePath = result.filePaths[0];
    const raw = fs.readFileSync(filePath, 'utf-8');

    const filePathLower = filePath.toLowerCase();
    const isCsv = filePathLower.endsWith('.csv');
    const isJson = filePathLower.endsWith('.json');
    const parsed = isCsv ? this.parseCsv(raw) : isJson ? this.parseJson(raw) : this.parseDotEnv(raw);

    let imported = 0;
    let skipped = 0;

    for (const item of parsed) {
      if (!item.secret || !item.providerId) {
        skipped++;
        continue;
      }

      const encrypted = vaultService.encrypt(item.secret);
      await apiKeyRepo.insert({
        providerId: item.providerId,
        keyLabel: item.label,
        encryptedKey: encrypted,
        keyPrefix: item.secret.slice(0, 8),
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      if (item.notes) {
        const rows = await apiKeyRepo.list();
        const latest = rows[0];
        if (latest) {
          await apiKeyRepo.update(latest.id, { notes: item.notes });
        }
      }

      imported++;
    }

    return {
      imported,
      skipped,
      source: isCsv ? 'csv' : isJson ? 'json' : '.env',
    };
  }

  private parseDotEnv(raw: string): SecretInput[] {
    const rows: SecretInput[] = [];

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;

      const envName = match[1];
      const value = this.unquote(match[2].trim());
      if (!value) continue;

      const providerId = this.inferProviderFromName(envName);
      if (!providerId) continue;

      rows.push({ providerId, label: envName, secret: value });
    }

    return rows;
  }

  private parseCsv(raw: string): SecretInput[] {
    const table = this.readCsvTable(raw);
    if (table.length < 2) return [];

    const headers = table[0].map((h) => h.trim().toLowerCase());
    const idx = {
      provider: this.findHeader(headers, ['provider', 'providerid', 'service']),
      label: this.findHeader(headers, ['label', 'name', 'key', 'title']),
      value: this.findHeader(headers, ['value', 'secret', 'apikey', 'api_key', 'password', 'login_password']),
      notes: this.findHeader(headers, ['notes', 'note', 'description']),
      username: this.findHeader(headers, ['username', 'login_username']),
    };

    const rows: SecretInput[] = [];

    for (const row of table.slice(1)) {
      const rawValue = idx.value >= 0 ? row[idx.value] ?? '' : '';
      const secret = rawValue.trim();
      if (!secret) continue;

      const providerCandidate = idx.provider >= 0 ? row[idx.provider] ?? '' : '';
      const usernameCandidate = idx.username >= 0 ? row[idx.username] ?? '' : '';
      const labelCandidate = idx.label >= 0 ? row[idx.label] ?? '' : '';

      const providerId = this.normalizeProvider(providerCandidate)
        ?? this.inferProviderFromName(usernameCandidate)
        ?? this.inferProviderFromName(labelCandidate);
      if (!providerId) continue;

      const notes = idx.notes >= 0 ? row[idx.notes]?.trim() : '';

      rows.push({
        providerId,
        label: (labelCandidate || usernameCandidate || 'Imported secret').trim(),
        secret,
        notes: notes || undefined,
      });
    }

    return rows;
  }


  private parseJson(raw: string): SecretInput[] {
    try {
      const parsed = JSON.parse(raw);
      const candidates = this.flattenJsonCandidates(parsed);
      const rows: SecretInput[] = [];

      for (const candidate of candidates) {
        const secret = this.pickFirstString(candidate, [
          'secret',
          'apiKey',
          'api_key',
          'token',
          'password',
          'login_password',
          'value',
        ]);
        if (!secret) continue;

        const providerSeed = this.pickFirstString(candidate, [
          'provider',
          'providerId',
          'service',
          'username',
          'login_username',
          'name',
          'title',
        ]);

        const providerId = this.normalizeProvider(providerSeed ?? '') ?? this.inferProviderFromName(providerSeed ?? '');
        if (!providerId) continue;

        const label = this.pickFirstString(candidate, ['label', 'name', 'title', 'username']) ?? 'Imported secret';
        const notes = this.pickFirstString(candidate, ['notes', 'note', 'description']);

        rows.push({ providerId, label, secret, notes: notes ?? undefined });
      }

      return rows;
    } catch {
      return [];
    }
  }

  private flattenJsonCandidates(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.flattenJsonCandidates(item));
    }

    if (!value || typeof value !== 'object') {
      return [];
    }

    const obj = value as Record<string, unknown>;
    const rows: Record<string, unknown>[] = [obj];

    for (const nestedKey of ['items', 'entries', 'vaults', 'logins']) {
      if (nestedKey in obj) {
        rows.push(...this.flattenJsonCandidates(obj[nestedKey]));
      }
    }

    return rows;
  }

  private pickFirstString(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private findHeader(headers: string[], names: string[]): number {
    for (const name of names) {
      const i = headers.indexOf(name);
      if (i >= 0) return i;
    }
    return -1;
  }

  private normalizeProvider(raw: string): string | null {
    const normalized = raw.trim().toLowerCase().replace(/[\s_-]/g, '');
    if (!normalized) return null;

    for (const provider of KNOWN_PROVIDERS) {
      if (provider.replace(/[_-]/g, '') === normalized) {
        return provider;
      }
    }

    return this.inferProviderFromName(raw);
  }

  private inferProviderFromName(input: string): string | null {
    const text = input.trim();
    if (!text) return null;

    for (const hint of ENV_PROVIDER_HINTS) {
      if (hint.pattern.test(text)) {
        return hint.providerId;
      }
    }

    return null;
  }

  private unquote(value: string): string {
    if (!value) return value;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }

  private readCsvTable(raw: string): string[][] {
    const rows: string[][] = [];
    let cell = '';
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      const next = raw[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(cell);
        cell = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') {
          i++;
        }
        row.push(cell);
        if (row.some((value) => value.trim().length > 0)) {
          rows.push(row);
        }
        row = [];
        cell = '';
        continue;
      }

      cell += char;
    }

    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }
    }

    return rows;
  }
}

export const secretsImportService = new SecretsImportService();

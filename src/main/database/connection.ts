import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import * as schema from './schema';

let db: ReturnType<typeof drizzle> | null = null;
let sqlite: Database.Database | null = null;

export function getDatabase() {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'omniview.db');
  sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, { schema });
  return db;
}

export function getRawDatabase() {
  return sqlite;
}

export function closeDatabase() {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

export function initializeDatabase() {
  const database = getDatabase();
  // Create tables if they don't exist
  const raw = sqlite!;

  raw.exec(`
    CREATE TABLE IF NOT EXISTS usage_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      model TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER,
      cache_write_tokens INTEGER,
      cost_usd REAL,
      source TEXT NOT NULL DEFAULT 'api',
      raw_data TEXT
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      model TEXT NOT NULL,
      request_body TEXT,
      response_body TEXT,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL,
      latency_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      error_code TEXT,
      streamed INTEGER NOT NULL DEFAULT 0,
      source_app TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS error_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_log_id INTEGER REFERENCES request_logs(id),
      provider_id TEXT NOT NULL,
      model TEXT NOT NULL,
      error_code TEXT NOT NULL,
      status_code INTEGER,
      message TEXT NOT NULL,
      raw_response TEXT,
      retryable INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      model TEXT NOT NULL,
      bucket_start TEXT NOT NULL,
      granularity TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL,
      avg_latency_ms REAL,
      p95_latency_ms REAL,
      error_count INTEGER NOT NULL DEFAULT 0,
      rate_limit_hit_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS provider_configs (
      provider_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      auth_method TEXT NOT NULL DEFAULT 'api_key',
      encrypted_credentials TEXT,
      base_url TEXT,
      organization_id TEXT,
      usage_fetch_interval INTEGER NOT NULL DEFAULT 5,
      last_usage_fetch TEXT,
      timeout INTEGER NOT NULL DEFAULT 30000,
      max_retries INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      provider_id TEXT,
      model TEXT,
      metric TEXT NOT NULL,
      condition TEXT NOT NULL,
      threshold REAL NOT NULL,
      window_minutes INTEGER NOT NULL DEFAULT 60,
      cooldown_minutes INTEGER NOT NULL DEFAULT 30,
      action TEXT NOT NULL,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_rule_id INTEGER NOT NULL REFERENCES alert_rules(id),
      triggered_at TEXT NOT NULL,
      metric_value REAL NOT NULL,
      threshold REAL NOT NULL,
      message TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vault_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salt BLOB NOT NULL,
      kdf_algorithm TEXT NOT NULL DEFAULT 'argon2id',
      kdf_time_cost INTEGER NOT NULL DEFAULT 3,
      kdf_memory_cost INTEGER NOT NULL DEFAULT 65536,
      kdf_parallelism INTEGER NOT NULL DEFAULT 1,
      verification_ciphertext TEXT NOT NULL,
      auto_lock_minutes INTEGER NOT NULL DEFAULT 15
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      key_label TEXT NOT NULL DEFAULT 'Default',
      encrypted_key TEXT NOT NULL,
      key_prefix TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      last_rotated_at TEXT,
      expires_at TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#6366f1',
      git_repo_path TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      api_key_id INTEGER NOT NULL REFERENCES api_keys(id),
      environment TEXT NOT NULL DEFAULT 'dev',
      is_primary INTEGER NOT NULL DEFAULT 0,
      UNIQUE(project_id, api_key_id, environment)
    );

    CREATE TABLE IF NOT EXISTS key_rotation_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id),
      provider_id TEXT NOT NULL,
      rotation_interval_days INTEGER NOT NULL DEFAULT 90,
      reminder_days_before INTEGER NOT NULL DEFAULT 14,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS model_pricing (
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_pattern TEXT,
      input_price_per_m_tok REAL NOT NULL,
      output_price_per_m_tok REAL NOT NULL,
      cached_input_price_per_m_tok REAL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_snapshots_provider ON usage_snapshots(provider_id, period_start);
    CREATE INDEX IF NOT EXISTS idx_request_logs_provider ON request_logs(provider_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_metrics_bucket ON usage_metrics(provider_id, bucket_start, granularity);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_metrics_unique_bucket ON usage_metrics(provider_id, model, bucket_start, granularity);
    CREATE INDEX IF NOT EXISTS idx_error_records_provider ON error_records(provider_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_project_keys_project ON project_keys(project_id, environment);
  `);

  // Add project_id and environment columns to existing tables (safe migration)
  const columns = raw.pragma('table_info(request_logs)') as Array<{ name: string }>;
  const columnNames = columns.map((c) => c.name);
  if (!columnNames.includes('project_id')) {
    raw.exec(`ALTER TABLE request_logs ADD COLUMN project_id INTEGER`);
  }
  if (!columnNames.includes('environment')) {
    raw.exec(`ALTER TABLE request_logs ADD COLUMN environment TEXT`);
  }
  if (!columnNames.includes('git_branch')) {
    raw.exec(`ALTER TABLE request_logs ADD COLUMN git_branch TEXT`);
  }

  const metricsColumns = raw.pragma('table_info(usage_metrics)') as Array<{ name: string }>;
  const metricColNames = metricsColumns.map((c) => c.name);
  if (!metricColNames.includes('project_id')) {
    raw.exec(`ALTER TABLE usage_metrics ADD COLUMN project_id INTEGER`);
  }
  if (!metricColNames.includes('environment')) {
    raw.exec(`ALTER TABLE usage_metrics ADD COLUMN environment TEXT`);
  }

  return database;
}

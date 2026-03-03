import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';

export const usageSnapshots = sqliteTable('usage_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  providerId: text('provider_id').notNull(),
  model: text('model').notNull(),
  fetchedAt: text('fetched_at').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  requestCount: integer('request_count').notNull().default(0),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  cacheReadTokens: integer('cache_read_tokens'),
  cacheWriteTokens: integer('cache_write_tokens'),
  costUsd: real('cost_usd'),
  source: text('source', { enum: ['api', 'proxy', 'manual'] }).notNull().default('api'),
  rawData: text('raw_data'),
});

export const requestLogs = sqliteTable('request_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  providerId: text('provider_id').notNull(),
  model: text('model').notNull(),
  requestBody: text('request_body'),
  responseBody: text('response_body'),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  costUsd: real('cost_usd'),
  latencyMs: integer('latency_ms'),
  status: text('status', { enum: ['pending', 'streaming', 'success', 'error', 'aborted'] }).notNull().default('pending'),
  errorCode: text('error_code'),
  streamed: integer('streamed', { mode: 'boolean' }).notNull().default(false),
  sourceApp: text('source_app'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
});

export const errorRecords = sqliteTable('error_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestLogId: integer('request_log_id').references(() => requestLogs.id),
  providerId: text('provider_id').notNull(),
  model: text('model').notNull(),
  errorCode: text('error_code').notNull(),
  statusCode: integer('status_code'),
  message: text('message').notNull(),
  rawResponse: text('raw_response'),
  retryable: integer('retryable', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const usageMetrics = sqliteTable('usage_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  providerId: text('provider_id').notNull(),
  model: text('model').notNull(),
  bucketStart: text('bucket_start').notNull(),
  granularity: text('granularity', { enum: ['hour', 'day', 'week', 'month'] }).notNull(),
  requestCount: integer('request_count').notNull().default(0),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  totalCostUsd: real('total_cost_usd'),
  avgLatencyMs: real('avg_latency_ms'),
  p95LatencyMs: real('p95_latency_ms'),
  errorCount: integer('error_count').notNull().default(0),
  rateLimitHitCount: integer('rate_limit_hit_count').notNull().default(0),
});

export const providerConfigs = sqliteTable('provider_configs', {
  providerId: text('provider_id').primaryKey(),
  displayName: text('display_name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  authMethod: text('auth_method').notNull().default('api_key'),
  encryptedCredentials: text('encrypted_credentials'),
  baseUrl: text('base_url'),
  organizationId: text('organization_id'),
  usageFetchInterval: integer('usage_fetch_interval').notNull().default(5),
  lastUsageFetch: text('last_usage_fetch'),
  timeout: integer('timeout').notNull().default(30000),
  maxRetries: integer('max_retries').notNull().default(3),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const alertRules = sqliteTable('alert_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  providerId: text('provider_id'),
  model: text('model'),
  metric: text('metric', { enum: ['error_rate', 'latency_p95', 'cost_total', 'token_usage', 'rate_limit_hits'] }).notNull(),
  condition: text('condition', { enum: ['gt', 'lt', 'gte'] }).notNull(),
  threshold: real('threshold').notNull(),
  windowMinutes: integer('window_minutes').notNull().default(60),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(30),
  action: text('action').notNull(),
  lastTriggeredAt: text('last_triggered_at'),
  createdAt: text('created_at').notNull(),
});

export const alertEvents = sqliteTable('alert_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  alertRuleId: integer('alert_rule_id').notNull().references(() => alertRules.id),
  triggeredAt: text('triggered_at').notNull(),
  metricValue: real('metric_value').notNull(),
  threshold: real('threshold').notNull(),
  message: text('message').notNull(),
  acknowledged: integer('acknowledged', { mode: 'boolean' }).notNull().default(false),
});

export const vaultMetadata = sqliteTable('vault_metadata', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  salt: blob('salt', { mode: 'buffer' }).notNull(),
  kdfAlgorithm: text('kdf_algorithm').notNull().default('argon2id'),
  kdfTimeCost: integer('kdf_time_cost').notNull().default(3),
  kdfMemoryCost: integer('kdf_memory_cost').notNull().default(65536),
  kdfParallelism: integer('kdf_parallelism').notNull().default(1),
  verificationCiphertext: text('verification_ciphertext').notNull(),
  autoLockMinutes: integer('auto_lock_minutes').notNull().default(15),
});

export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  providerId: text('provider_id').notNull(),
  keyLabel: text('key_label').notNull().default('Default'),
  encryptedKey: text('encrypted_key').notNull(),
  keyPrefix: text('key_prefix'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastUsedAt: text('last_used_at'),
  lastRotatedAt: text('last_rotated_at'),
  lastVerifiedAt: text('last_verified_at'),
  expiresAt: text('expires_at'),
  serviceType: text('service_type'),
  generatedWhere: text('generated_where'),
  notes: text('notes'),
});

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  color: text('color').notNull().default('#6366f1'),
  gitRepoPath: text('git_repo_path'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectKeys = sqliteTable('project_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id),
  apiKeyId: integer('api_key_id').notNull().references(() => apiKeys.id),
  environment: text('environment', { enum: ['dev', 'staging', 'prod'] }).notNull().default('dev'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
});

export const keyRotationPolicies = sqliteTable('key_rotation_policies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id),
  providerId: text('provider_id').notNull(),
  rotationIntervalDays: integer('rotation_interval_days').notNull().default(90),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(14),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

export const modelPricing = sqliteTable('model_pricing', {
  providerId: text('provider_id').notNull(),
  modelId: text('model_id').notNull(),
  modelPattern: text('model_pattern'),
  inputPricePerMTok: real('input_price_per_m_tok').notNull(),
  outputPricePerMTok: real('output_price_per_m_tok').notNull(),
  cachedInputPricePerMTok: real('cached_input_price_per_m_tok'),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  source: text('source', { enum: ['manual', 'fetched'] }).notNull().default('manual'),
  updatedAt: text('updated_at').notNull(),
});


export const credentials = sqliteTable('credentials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  providerId: text('provider_id'),
  projectId: integer('project_id').references(() => projects.id),
  encryptedUsername: text('encrypted_username').notNull(),
  encryptedPassword: text('encrypted_password').notNull(),
  encryptedNotes: text('encrypted_notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

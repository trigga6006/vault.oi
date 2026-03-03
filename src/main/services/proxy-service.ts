import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { BrowserWindow } from 'electron';
import { requestLogRepo } from '../database/repositories/request-log.repo';
import { usageMetricsRepo } from '../database/repositories/usage-metrics.repo';
import { costService } from './cost-service';
import { keyVaultService } from './key-vault-service';
import { projectService } from './project-service';
import { vaultService } from './vault-service';
import type { ProxyStatus } from '../../shared/types/ipc.types';
import type { Environment } from '../../shared/types/project.types';

// ---------------------------------------------------------------------------
// Provider routing table — maps URL prefix to real API base
// ---------------------------------------------------------------------------
const PROVIDER_ROUTES: Record<string, { target: string; providerId: string }> = {
  '/anthropic/':  { target: 'https://api.anthropic.com/',                         providerId: 'anthropic' },
  '/openai/':     { target: 'https://api.openai.com/',                            providerId: 'openai' },
  '/fireworks/':  { target: 'https://api.fireworks.ai/inference/',                 providerId: 'fireworks' },
  '/google/':     { target: 'https://generativelanguage.googleapis.com/v1beta/',   providerId: 'google' },
  '/perplexity/': { target: 'https://api.perplexity.ai/',                          providerId: 'perplexity' },
  '/xai/':        { target: 'https://api.x.ai/',                                  providerId: 'xai' },
  '/mistral/':    { target: 'https://api.mistral.ai/',                             providerId: 'mistral' },
  '/together/':   { target: 'https://api.together.xyz/',                           providerId: 'together' },
  '/deepseek/':   { target: 'https://api.deepseek.com/',                           providerId: 'deepseek' },
  '/openrouter/': { target: 'https://openrouter.ai/api/',                          providerId: 'openrouter' },
  '/cohere/':     { target: 'https://api.cohere.com/compatibility/',               providerId: 'cohere' },
  '/qwen/':       { target: 'https://dashscope.aliyuncs.com/compatible-mode/',     providerId: 'qwen' },
  '/ollama/':     { target: 'http://localhost:11434/',                              providerId: 'ollama' },
  '/huggingface/':{ target: 'https://api-inference.huggingface.co/',               providerId: 'huggingface' },
  '/copilot/':    { target: 'https://api.githubcopilot.com/',                      providerId: 'copilot' },
  '/cursor/':     { target: 'https://api2.cursor.sh/',                             providerId: 'cursor' },
};

// Sorted by longest prefix first so matching is unambiguous
const ROUTE_PREFIXES = Object.keys(PROVIDER_ROUTES).sort((a, b) => b.length - a.length);

// ---------------------------------------------------------------------------
// Auth format per provider — how to inject keys for upstream requests
// ---------------------------------------------------------------------------
type AuthFormat = 'bearer' | 'x-api-key' | 'query-param';

const PROVIDER_AUTH_FORMAT: Record<string, AuthFormat> = {
  anthropic: 'x-api-key',
  google: 'query-param',
  // All others use Bearer token
};

// Headers to strip from client requests (we inject auth from vault)
const AUTH_HEADERS_TO_STRIP = [
  'authorization',
  'x-api-key',
  'anthropic-api-key',
];

// OmniView custom headers (stripped before forwarding upstream)
const OMNIVIEW_HEADERS = [
  'x-omniview-project',
  'x-omniview-environment',
  'x-omniview-branch',
];

// ---------------------------------------------------------------------------
// Source-app detection from User-Agent
// ---------------------------------------------------------------------------
function detectSourceApp(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes('claude-code') || ua.includes('claudecode')) return 'claude-code';
  if (ua.includes('cursor')) return 'cursor';
  if (ua.includes('copilot')) return 'copilot';
  if (ua.includes('python-requests') || ua.includes('python-httpx') || ua.includes('openai-python')) return 'python';
  if (ua.includes('node-fetch') || ua.includes('axios') || ua.includes('openai-node')) return 'node';
  if (ua.includes('curl')) return 'curl';
  return userAgent.slice(0, 64);
}

// ---------------------------------------------------------------------------
// Token extraction — provider-aware
// ---------------------------------------------------------------------------
interface ExtractedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  model: string;
}

function extractUsageFromBody(providerId: string, body: string): ExtractedUsage | null {
  try {
    const json = JSON.parse(body);
    return extractUsageFromJson(providerId, json);
  } catch {
    return null;
  }
}

function extractUsageFromJson(providerId: string, json: any): ExtractedUsage | null {
  if (!json) return null;

  const model: string = json.model ?? json.modelId ?? '';

  if (providerId === 'anthropic') {
    const u = json.usage;
    if (!u) return null;
    return {
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? u.cache_creation_input_tokens ?? undefined,
      model: json.model ?? model,
    };
  }

  if (providerId === 'google') {
    const u = json.usageMetadata;
    if (!u) return null;
    return {
      inputTokens: u.promptTokenCount ?? 0,
      outputTokens: u.candidatesTokenCount ?? 0,
      model,
    };
  }

  // OpenAI-compatible (openai, fireworks, xai, mistral, together, deepseek, openrouter, cohere, qwen, etc.)
  const u = json.usage;
  if (!u) return null;
  return {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    cacheReadTokens: u.prompt_tokens_details?.cached_tokens ?? undefined,
    model: json.model ?? model,
  };
}

// ---------------------------------------------------------------------------
// Streaming chunk accumulation & token extraction
// ---------------------------------------------------------------------------
function extractUsageFromSSEChunks(providerId: string, chunks: string[]): ExtractedUsage | null {
  // Walk chunks in reverse — usage is typically in the final events
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];

    // Anthropic streaming: message_delta has usage in the final event
    // message_start has input tokens
    try {
      const json = JSON.parse(chunk);

      if (providerId === 'anthropic') {
        // Final message_delta has usage.output_tokens
        if (json.type === 'message_delta' && json.usage) {
          // Collect input tokens from message_start
          let inputTokens = 0;
          for (const c of chunks) {
            try {
              const start = JSON.parse(c);
              if (start.type === 'message_start' && start.message?.usage) {
                inputTokens = start.message.usage.input_tokens ?? 0;
                break;
              }
            } catch { /* skip non-JSON */ }
          }
          return {
            inputTokens,
            outputTokens: json.usage.output_tokens ?? 0,
            model: '',
          };
        }
      }

      // OpenAI-compatible: final chunk or usage field in final data
      if (json.usage) {
        return {
          inputTokens: json.usage.prompt_tokens ?? 0,
          outputTokens: json.usage.completion_tokens ?? 0,
          model: json.model ?? '',
        };
      }

      // Google: usageMetadata in final chunk
      if (json.usageMetadata) {
        return {
          inputTokens: json.usageMetadata.promptTokenCount ?? 0,
          outputTokens: json.usageMetadata.candidatesTokenCount ?? 0,
          model: json.model ?? '',
        };
      }
    } catch { /* non-JSON line, skip */ }
  }
  return null;
}

function parseSSEDataChunks(raw: string): string[] {
  const chunks: string[] = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data && data !== '[DONE]') {
        chunks.push(data);
      }
    }
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------
function matchRoute(pathname: string): { route: typeof PROVIDER_ROUTES[string]; remainder: string } | null {
  for (const prefix of ROUTE_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return { route: PROVIDER_ROUTES[prefix], remainder: pathname.slice(prefix.length) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Emit events to all renderer windows
// ---------------------------------------------------------------------------
function emitToRenderer(channel: string, data: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

// ---------------------------------------------------------------------------
// Compute the hour-bucket start for a given date
// ---------------------------------------------------------------------------
function hourBucket(date: Date): string {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// ProxyService
// ---------------------------------------------------------------------------
export class ProxyService {
  private server: http.Server | null = null;
  private port: number | null = null;
  private requestCount = 0;
  private upSince: Date | null = null;

  getStatus(): ProxyStatus {
    return {
      running: this.server !== null && this.server.listening,
      port: this.port,
      requestCount: this.requestCount,
      upSince: this.upSince?.toISOString() ?? null,
    };
  }

  async start(port: number): Promise<{ success: boolean }> {
    if (this.server?.listening) {
      return { success: true };
    }

    return new Promise((resolve) => {
      const server = http.createServer((req, res) => this.handleRequest(req, res));

      server.on('error', (err: NodeJS.ErrnoException) => {
        console.error('[Proxy] Server error:', err.message);
        if (err.code === 'EADDRINUSE') {
          resolve({ success: false });
        }
      });

      server.listen(port, '127.0.0.1', () => {
        this.server = server;
        this.port = port;
        this.requestCount = 0;
        this.upSince = new Date();
        console.log(`[Proxy] Listening on http://127.0.0.1:${port}`);
        resolve({ success: true });
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server!.close(() => {
        console.log('[Proxy] Server stopped');
        this.server = null;
        this.port = null;
        this.upSince = null;
        resolve();
      });
    });
  }

  // -------------------------------------------------------------------------
  // Request handler
  // -------------------------------------------------------------------------
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    const pathname = req.url ?? '/';
    const match = matchRoute(pathname);

    if (!match) {
      // Health check endpoint
      if (pathname === '/' || pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', proxy: 'omniview', ...this.getStatus() }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown provider route', path: pathname }));
      return;
    }

    const { route, remainder } = match;
    this.requestCount++;

    // Collect request body
    const bodyChunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(bodyChunks).toString('utf-8');
      this.forwardRequest(req, res, route, remainder, body).catch((err) => {
        console.error('[Proxy] Forward error:', err);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'proxy_error', message: String(err) }));
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // Forward to upstream
  // -------------------------------------------------------------------------
  private async forwardRequest(
    clientReq: http.IncomingMessage,
    clientRes: http.ServerResponse,
    route: { target: string; providerId: string },
    pathRemainder: string,
    body: string,
  ) {
    const { target, providerId } = route;
    const startTime = Date.now();

    // Parse request to extract model and stream flag
    let model = 'unknown';
    let isStream = false;
    try {
      const parsed = JSON.parse(body);
      model = parsed.model ?? 'unknown';
      isStream = parsed.stream === true;
    } catch { /* not JSON, e.g. GET requests */ }

    const sourceApp = detectSourceApp(clientReq.headers['user-agent']);

    // Extract OmniView custom headers
    const omniviewProject = clientReq.headers['x-omniview-project'] as string | undefined;
    const omniviewEnvironment = clientReq.headers['x-omniview-environment'] as string | undefined;
    const omniviewBranch = clientReq.headers['x-omniview-branch'] as string | undefined;

    // Resolve project ID from header
    let projectId: number | undefined;
    let environment: Environment | undefined;
    if (omniviewProject) {
      try {
        const projects = await import('../database/repositories/project.repo').then(m => m.projectRepo.list());
        const project = projects.find(p => p.name === omniviewProject || p.id === Number(omniviewProject));
        if (project) projectId = project.id;
      } catch { /* ignore */ }
    }
    if (omniviewEnvironment && ['dev', 'staging', 'prod'].includes(omniviewEnvironment)) {
      environment = omniviewEnvironment as Environment;
    }

    // Create pending log entry
    let logId: number | null = null;
    try {
      const [entry] = await requestLogRepo.insert({
        providerId,
        model,
        requestBody: body || null,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        status: isStream ? 'streaming' : 'pending',
        streamed: isStream,
        sourceApp,
        createdAt: new Date().toISOString(),
      });
      logId = entry.id;
    } catch (err) {
      console.warn('[Proxy] Failed to create log entry:', err);
    }

    // Notify renderer
    emitToRenderer('proxy:request-started', {
      logId,
      providerId,
      model,
      isStream,
      sourceApp,
      createdAt: new Date().toISOString(),
    });

    // Build upstream URL
    const upstreamUrl = new URL(pathRemainder, target);
    // Preserve query string from original request
    const originalUrl = new URL(clientReq.url ?? '/', `http://127.0.0.1`);
    upstreamUrl.search = originalUrl.search;

    // Build upstream headers — forward all except host/connection/auth headers
    const upstreamHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(clientReq.headers)) {
      const lk = key.toLowerCase();
      if (lk === 'host' || lk === 'connection' || lk === 'content-length') continue;
      // Strip auth headers — we inject from vault
      if (AUTH_HEADERS_TO_STRIP.includes(lk)) continue;
      // Strip OmniView custom headers
      if (OMNIVIEW_HEADERS.includes(lk)) continue;
      if (value !== undefined) {
        upstreamHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }
    if (body) {
      upstreamHeaders['content-length'] = Buffer.byteLength(body, 'utf-8').toString();
    }

    // Inject API key from vault (project-aware resolution)
    if (vaultService.isUnlocked) {
      try {
        const keyData = projectId
          ? await projectService.getKeyForRequest(providerId, projectId, environment)
          : await keyVaultService.getDecryptedKey(providerId);
        if (keyData) {
          const authFormat = PROVIDER_AUTH_FORMAT[providerId] ?? 'bearer';
          if (authFormat === 'x-api-key') {
            upstreamHeaders['x-api-key'] = keyData.key;
          } else if (authFormat === 'query-param') {
            upstreamUrl.searchParams.set('key', keyData.key);
          } else {
            upstreamHeaders['authorization'] = `Bearer ${keyData.key}`;
          }
        } else {
          // No key configured — return 401 to client
          clientRes.writeHead(401, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          clientRes.end(
            JSON.stringify({
              error: 'no_key_configured',
              message: `No API key configured for provider: ${providerId}. Add a key in the Vault.`,
            }),
          );
          return;
        }
      } catch (err) {
        console.warn(`[Proxy] Key injection failed for ${providerId}:`, err);
        // Fall through — request will likely fail with auth error upstream
      }
    }

    const isHttps = upstreamUrl.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;

    const upstreamReq = requestFn(
      upstreamUrl,
      {
        method: clientReq.method,
        headers: upstreamHeaders,
      },
      (upstreamRes) => {
        if (isStream) {
          this.handleStreamResponse(clientRes, upstreamRes, providerId, model, logId, startTime, sourceApp);
        } else {
          this.handleNonStreamResponse(clientRes, upstreamRes, providerId, model, logId, startTime, sourceApp);
        }
      },
    );

    upstreamReq.on('error', (err) => {
      console.error('[Proxy] Upstream request error:', err.message);
      const latencyMs = Date.now() - startTime;

      if (logId) {
        requestLogRepo.updateResponse(logId, {
          status: 'error',
          errorCode: 'upstream_error',
          latencyMs,
          completedAt: new Date().toISOString(),
        }).catch((error: unknown) => {
          console.debug('[Proxy] Failed to persist upstream request error log', error);
        });
      }

      emitToRenderer('proxy:request-error', { logId, providerId, model, error: err.message });

      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ error: 'upstream_error', message: err.message }));
      }
    });

    if (body) {
      upstreamReq.write(body);
    }
    upstreamReq.end();
  }

  // -------------------------------------------------------------------------
  // Non-streaming response
  // -------------------------------------------------------------------------
  private handleNonStreamResponse(
    clientRes: http.ServerResponse,
    upstreamRes: http.IncomingMessage,
    providerId: string,
    model: string,
    logId: number | null,
    startTime: number,
    sourceApp: string | null,
  ) {
    const responseChunks: Buffer[] = [];

    upstreamRes.on('data', (chunk: Buffer) => responseChunks.push(chunk));
    upstreamRes.on('end', () => {
      const latencyMs = Date.now() - startTime;
      const responseBody = Buffer.concat(responseChunks).toString('utf-8');

      // Forward status and headers to client
      const headers = { ...upstreamRes.headers };
      headers['access-control-allow-origin'] = '*';
      clientRes.writeHead(upstreamRes.statusCode ?? 200, headers);
      clientRes.end(responseBody);

      // Extract usage and update log
      this.finalizeLog(providerId, model, logId, responseBody, latencyMs, upstreamRes.statusCode ?? 200, sourceApp, false);
    });

    upstreamRes.on('error', (err) => {
      console.error('[Proxy] Upstream response error:', err.message);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ error: 'upstream_response_error', message: err.message }));
      }
    });
  }

  // -------------------------------------------------------------------------
  // Streaming response — pipe through while accumulating
  // -------------------------------------------------------------------------
  private handleStreamResponse(
    clientRes: http.ServerResponse,
    upstreamRes: http.IncomingMessage,
    providerId: string,
    model: string,
    logId: number | null,
    startTime: number,
    sourceApp: string | null,
  ) {
    // Forward headers immediately for SSE
    const headers = { ...upstreamRes.headers };
    headers['access-control-allow-origin'] = '*';
    clientRes.writeHead(upstreamRes.statusCode ?? 200, headers);

    let accumulated = '';

    upstreamRes.on('data', (chunk: Buffer) => {
      const data = chunk.toString('utf-8');
      accumulated += data;
      // Pipe through to client in real-time
      clientRes.write(chunk);
    });

    upstreamRes.on('end', () => {
      const latencyMs = Date.now() - startTime;
      clientRes.end();

      // Parse accumulated SSE data for token usage
      this.finalizeLog(providerId, model, logId, accumulated, latencyMs, upstreamRes.statusCode ?? 200, sourceApp, true);
    });

    upstreamRes.on('error', (err) => {
      console.error('[Proxy] Stream error:', err.message);
      clientRes.end();
    });
  }

  // -------------------------------------------------------------------------
  // Finalize log entry with usage/cost data + metrics aggregation
  // -------------------------------------------------------------------------
  private async finalizeLog(
    providerId: string,
    requestModel: string,
    logId: number | null,
    responseBody: string,
    latencyMs: number,
    statusCode: number,
    sourceApp: string | null,
    streamed: boolean,
  ) {
    try {
      const isError = statusCode >= 400;
      let usage: ExtractedUsage | null = null;

      if (!isError) {
        if (streamed) {
          const chunks = parseSSEDataChunks(responseBody);
          usage = extractUsageFromSSEChunks(providerId, chunks);
        } else {
          usage = extractUsageFromBody(providerId, responseBody);
        }
      }

      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      const model = usage?.model || requestModel;

      // Calculate cost
      let costUsd: number | null = null;
      if (inputTokens > 0 || outputTokens > 0) {
        costUsd = costService.calculateFromTokens(
          providerId,
          model,
          inputTokens,
          outputTokens,
          usage?.cacheReadTokens,
        );
      }

      // Update request log
      if (logId) {
        await requestLogRepo.updateResponse(logId, {
          model,
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens,
          costUsd,
          latencyMs,
          status: isError ? 'error' : 'success',
          errorCode: isError ? `http_${statusCode}` : null,
          responseBody: streamed ? null : responseBody.slice(0, 10000),
          completedAt: new Date().toISOString(),
        });
      }

      // Aggregate into hourly metrics bucket
      if (!isError && totalTokens > 0) {
        try {
          await usageMetricsRepo.incrementBucket({
            providerId,
            model,
            bucketStart: hourBucket(new Date()),
            granularity: 'hour',
            requestCount: 1,
            inputTokens,
            outputTokens,
            totalCostUsd: costUsd ?? 0,
            latencyMs,
            isError: false,
          });
        } catch (err) {
          console.warn('[Proxy] Metrics aggregation error:', err);
        }
      }

      // Notify renderer
      emitToRenderer('proxy:request-completed', {
        logId,
        providerId,
        model,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs,
        status: isError ? 'error' : 'success',
        sourceApp,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Proxy] Finalize log error:', err);
    }
  }
}

export const proxyService = new ProxyService();

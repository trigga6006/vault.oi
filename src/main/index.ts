import { app, BrowserWindow, dialog, globalShortcut, ipcMain, nativeImage, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { extractCliArgs, runCli } from './cli/runner';
const CLI_ROOT_TOKENS = new Set([
  'help',
  'version',
  'vault',
  'profiles',
  'keys',
  'credentials',
  'projects',
  'secrets',
]);

function parseCliArgsFromEnv(): string[] | null {
  const raw = process.env.OMNIVIEW_CLI_ARGS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function parseCliArgsFromFallbackArgv(argv: string[]): string[] | null {
  for (let i = 0; i < argv.length; i += 1) {
    if (CLI_ROOT_TOKENS.has(argv[i])) {
      return argv.slice(i);
    }
  }
  return null;
}

const cliArgsFromFlag = extractCliArgs(process.argv);
const cliArgsFromEnv = parseCliArgsFromEnv();
const cliArgsFromFallback = parseCliArgsFromFallbackArgv(process.argv.slice(2));
const isCliMode = cliArgsFromFlag !== null
  || process.env.OMNIVIEW_CLI_MODE === '1'
  || cliArgsFromEnv !== null
  || cliArgsFromFallback !== null;
const cliArgs = cliArgsFromFlag ?? cliArgsFromEnv ?? cliArgsFromFallback ?? [];
const APP_USER_MODEL_ID = 'vault.oi';

function resolveAppIcon(): Electron.NativeImage {
  // nativeImage.createFromPath does NOT work with ASAR paths in packaged builds.
  // createFromBuffer(fs.readFileSync(...)) is reliable in both dev and packaged
  // modes because Electron patches fs to transparently read from inside the ASAR.
  //
  // Candidate paths tried in order:
  //   1. ASAR path — works in both dev (real path) and packaged (ASAR-patched fs)
  //   2. extraResource path — fallback if icon was copied outside ASAR via forge config
  const ext = process.platform === 'win32' ? 'ico' : 'png';
  const candidates: string[] = [
    path.join(app.getAppPath(), 'src', 'assets', 'app', `icon.${ext}`),
    path.join(process.resourcesPath, `icon.${ext}`),
  ];
  // Prefer PNG for createFromBuffer on Windows (reliable; ICO via buffer
  // is sometimes not decoded correctly). Append PNG fallback candidates.
  if (ext !== 'png') {
    candidates.push(
      path.join(app.getAppPath(), 'src', 'assets', 'app', 'icon.png'),
      path.join(process.resourcesPath, 'icon.png'),
    );
  }
  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(p);
      const img = nativeImage.createFromBuffer(buf);
      if (!img.isEmpty()) return img;
    } catch { /* path not found or unreadable — try next */ }
  }
  console.warn('[icon] Could not load app icon from any candidate path');
  return nativeImage.createEmpty();
}
const APP_ICON = resolveAppIcon();

function configureUserDataPathCompatibility(): void {
  const currentUserDataPath = app.getPath('userData');
  const legacyUserDataPath = path.join(app.getPath('appData'), 'OmniView');

  if (path.resolve(currentUserDataPath) === path.resolve(legacyUserDataPath)) {
    return;
  }

  if (fs.existsSync(legacyUserDataPath)) {
    app.setPath('userData', legacyUserDataPath);
    console.log(`[Main] Using legacy userData path: ${legacyUserDataPath}`);
  }
}

configureUserDataPathCompatibility();

if (started && !isCliMode) {
  app.quit();
}

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  if (!isCliMode) {
    dialog.showErrorBox('OmniView Error', error.stack ?? error.message);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

let mainWindow: BrowserWindow | null = null;

function getTitleBarSymbolColor(theme: 'dark' | 'light'): string {
  return theme === 'light' ? '#3F3A33' : '#FFFFFF';
}

function applyWindowTheme(window: BrowserWindow | null, theme: 'dark' | 'light'): void {
  if (!window || process.platform !== 'win32') {
    return;
  }

  window.setTitleBarOverlay({
    color: '#00000000',
    symbolColor: getTitleBarSymbolColor(theme),
    height: 40,
  });
}

function isTrustedNavigation(url: string): boolean {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }

  return url.startsWith('file://');
}

const hardenedWebPreferences: Electron.WebPreferences & { enableRemoteModule?: boolean } = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  webviewTag: false,
  enableRemoteModule: false,
};

function getPlatformWindowOptions(): Electron.BrowserWindowConstructorOptions {
  const base: Electron.BrowserWindowConstructorOptions = {
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: APP_ICON,
    webPreferences: hardenedWebPreferences,
  };

  if (process.platform === 'win32') {
    return {
      ...base,
      autoHideMenuBar: true,
      backgroundMaterial: 'mica',
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#FFFFFF',
        height: 40,
      },
    };
  }

  if (process.platform === 'darwin') {
    return {
      ...base,
      titleBarStyle: 'hiddenInset',
      vibrancy: 'sidebar',
      visualEffectState: 'active',
      trafficLightPosition: { x: 16, y: 16 },
    };
  }

  return {
    ...base,
    autoHideMenuBar: true,
  };
}

function createWindow(): void {
  const options = getPlatformWindowOptions();
  mainWindow = new BrowserWindow(options);
  mainWindow.setContentProtection(true);
  mainWindow.setIcon(APP_ICON);
  applyWindowTheme(mainWindow, 'dark');

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Main] Renderer failed to load:', errorCode, errorDescription);
  });

  if (process.env.NODE_ENV === 'development' || MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedNavigation(url)) {
      return { action: 'allow' };
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigation(url)) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('window:set-theme', (event, theme: 'dark' | 'light') => {
  const senderUrl = event.senderFrame?.url ?? '';
  if (!isTrustedNavigation(senderUrl)) {
    return;
  }

  if (theme !== 'dark' && theme !== 'light') {
    return;
  }

  applyWindowTheme(BrowserWindow.fromWebContents(event.sender), theme);
});

async function initializeBackendServices(): Promise<void> {
  try {
    const { profileService } = await import('./services/profile-service');
    const state = await profileService.initialize();
    console.log(`[Main] Active profile: ${state.activeProfileId}`);
  } catch (err) {
    console.error('[Main] Profile init failed:', err);
  }

  try {
    const { initializeDatabase } = await import('./database/connection');
    initializeDatabase();
    console.log('[Main] Database initialized');
  } catch (err) {
    console.error('[Main] Database init failed:', err);
  }

  try {
    const { registerAllHandlers } = await import('./ipc/register-all');
    registerAllHandlers();
    console.log('[Main] IPC handlers registered');
  } catch (err) {
    console.error('[Main] IPC registration failed:', err);
  }

  try {
    const { bootstrapProviders } = await import('../providers/bootstrap');
    bootstrapProviders();
    console.log('[Main] Providers bootstrapped');
  } catch (err) {
    console.error('[Main] Provider bootstrap failed:', err);
  }

  try {
    const { pricingRegistry } = await import('../providers/pricing/registry');
    await pricingRegistry.initialize();
    console.log('[Main] Pricing initialized');
  } catch (err) {
    console.error('[Main] Pricing init failed:', err);
  }

  try {
    const { completionPipeline } = await import('../providers/middleware/pipeline');
    const { errorMiddleware } = await import('../providers/middleware/error.middleware');
    const { loggingMiddleware } = await import('../providers/middleware/logging.middleware');
    const { metricsMiddleware } = await import('../providers/middleware/metrics.middleware');
    const { retryMiddleware } = await import('../providers/middleware/retry.middleware');

    completionPipeline
      .use(errorMiddleware)
      .use(loggingMiddleware)
      .use(metricsMiddleware)
      .use(retryMiddleware);
    console.log('[Main] Middleware pipeline configured');
  } catch (err) {
    console.error('[Main] Middleware setup failed:', err);
  }

  // Provider activation is deferred to vault:unlock / vault:initialize IPC handlers
  // so secrets can be decrypted with the master password.
  try {
    const { vaultService } = await import('./services/vault-service');
    await vaultService.checkInitialized();
    console.log(`[Main] Vault initialized: ${vaultService.isInitialized}`);
  } catch (err) {
    console.error('[Main] Vault check failed:', err);
  }

  // Start scheduled services (non-critical)
  try {
    const { usageFetcher } = await import('./services/usage-fetcher');
    usageFetcher.start();
  } catch (err) {
    console.error('[Main] Usage fetcher start failed:', err);
  }

  try {
    const { alertService } = await import('./services/alert-service');
    alertService.start();
  } catch (err) {
    console.error('[Main] Alert service start failed:', err);
  }

  try {
    const { keyRotationService } = await import('./services/key-rotation-service');
    keyRotationService.start();
  } catch (err) {
    console.error('[Main] Key rotation service start failed:', err);
  }

  try {
    const { pricingUpdateService } = await import('./services/pricing-update-service');
    pricingUpdateService.start();
  } catch (err) {
    console.error('[Main] Pricing update service start failed:', err);
  }
}

app.on('ready', async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  if (isCliMode) {
    const exitCode = await runCli(app, cliArgs ?? []);
    app.exit(exitCode);
    return;
  }

  // Enforce CSP via response headers (not HTML meta tag) so we can
  // loosen script-src in development for Vite's inline React-refresh preamble.
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https: ws: wss:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  await initializeBackendServices();
  createWindow();

  globalShortcut.register('F12', () => {
    mainWindow?.webContents.toggleDevTools();
  });

  console.log('[Main] Startup complete');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  if (isCliMode) {
    return;
  }

  try {
    const { proxyService } = await import('./services/proxy-service');
    const { usageFetcher } = await import('./services/usage-fetcher');
    const { alertService } = await import('./services/alert-service');
    const { providerRegistry } = await import('../providers/registry');
    const { closeDatabase } = await import('./database/connection');
    const { keyRotationService } = await import('./services/key-rotation-service');
    const { pricingUpdateService } = await import('./services/pricing-update-service');
    const { vaultService } = await import('./services/vault-service');
    await proxyService.stop();
    usageFetcher.stop();
    alertService.stop();
    keyRotationService.stop();
    pricingUpdateService.stop();
    vaultService.lock();
    await providerRegistry.disposeAll();
    closeDatabase();
  } catch (err) {
    console.error('[Main] Cleanup error:', err);
  }
});

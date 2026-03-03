import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

// Start Vite dev server for renderer using the correct config (with React + Tailwind plugins)
const vite = spawn('npx', ['vite', '--config', 'vite.renderer.config.ts', '--port', '5173'], {
  cwd: root,
  stdio: 'pipe',
  shell: true,
});

vite.stdout.on('data', (d) => process.stdout.write(d));
vite.stderr.on('data', (d) => process.stderr.write(d));

// Wait for Vite to be ready, then launch Electron
let launched = false;
vite.stdout.on('data', (data) => {
  if (!launched && stripAnsi(data.toString()).includes('Local:')) {
    launched = true;
    console.log('[dev] Vite ready, launching Electron...');

    const electronBin = process.platform === 'win32'
      ? path.join(root, 'node_modules/electron/dist/electron.exe')
      : path.join(root, 'node_modules/.bin/electron');

    const electron = spawn(electronBin, ['.'], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
    });

    electron.on('exit', (code) => {
      console.log(`[dev] Electron exited (${code})`);
      vite.kill();
      process.exit(code ?? 0);
    });
  }
});

process.on('SIGINT', () => {
  vite.kill();
  process.exit(0);
});

// Timeout safety
setTimeout(() => {
  if (!launched) {
    console.error('[dev] Vite did not start in time');
    vite.kill();
    process.exit(1);
  }
}, 30000);

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const forgeCli = path.join(
  root,
  'node_modules',
  '@electron-forge',
  'cli',
  'dist',
  'electron-forge.js',
);

const devServer = spawn(process.execPath, [forgeCli, 'start'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
});

devServer.on('exit', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  devServer.kill();
  process.exit(0);
});

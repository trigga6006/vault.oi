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

const cliArgs = process.argv.slice(2);

const child = spawn(
  process.execPath,
  [forgeCli, 'start'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      OMNIVIEW_CLI_MODE: '1',
      OMNIVIEW_CLI_ARGS: JSON.stringify(cliArgs),
    },
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  child.kill();
  process.exit(0);
});

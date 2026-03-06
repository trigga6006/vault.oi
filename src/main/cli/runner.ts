import type { App } from 'electron';
import readline from 'node:readline';
import { CLI_COMMANDS, printGlobalHelp } from './commands';
import type { CliCommand, CliContext } from './types';

const BRAND = 'vault.oi';
const ANSI = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  brightRed: '\x1b[91m',
  brightBlack: '\x1b[90m',
} as const;

export function extractCliArgs(argv: string[]): string[] | null {
  const cliIndex = argv.indexOf('--cli');
  if (cliIndex < 0) return null;
  return argv.slice(cliIndex + 1);
}

function findCommand(commands: readonly CliCommand[], args: string[]): {
  command: CliCommand | null;
  consumed: number;
} {
  let bestMatch: CliCommand | null = null;
  let bestLength = 0;

  commands.forEach((candidate) => {
    if (candidate.path.length > args.length) return;
    const matches = candidate.path.every((part, index) => args[index] === part);
    if (!matches) return;
    if (candidate.path.length > bestLength) {
      bestMatch = candidate;
      bestLength = candidate.path.length;
    }
  });

  return { command: bestMatch, consumed: bestLength };
}

async function createServices() {
  const { profileService } = await import('../services/profile-service');
  const { vaultService } = await import('../services/vault-service');
  const { keyVaultService } = await import('../services/key-vault-service');
  const { credentialsService } = await import('../services/credentials-service');
  const { projectService } = await import('../services/project-service');
  const { initializeDatabase } = await import('../database/connection');

  await profileService.initialize();
  initializeDatabase();
  await vaultService.checkInitialized();

  return {
    services: {
      getVaultStatus: async () => vaultService.getStatus(),
      initializeVault: async (password: string) => {
        await vaultService.initialize(password);
      },
      unlockVault: async (password: string) => vaultService.unlock(password),
      lockVault: async () => {
        vaultService.lock();
      },
      setVaultAutoLock: async (minutes: number) => {
        await vaultService.setAutoLock(minutes);
      },
      getProfileState: async () => profileService.getState(),
      createProfile: async (name: string) => {
        await profileService.createProfile(name);
      },
      switchProfile: async (profileId: string) => {
        await profileService.switchProfile(profileId);
      },
      listKeys: async () => keyVaultService.listKeys(),
      storeKey: async (input) => keyVaultService.storeKey(
        input.providerId,
        input.apiKey,
        input.label,
        input.notes,
        input.serviceType,
        input.generatedWhere,
        input.expiresAt,
      ),
      updateKey: async (id, data) => {
        await keyVaultService.updateKey(id, data);
      },
      markKeyVerified: async (id: number) => {
        await keyVaultService.markVerified(id);
      },
      rotateKey: async (id: number, newKey: string) => {
        await keyVaultService.rotateKey(id, newKey);
      },
      deleteKey: async (id: number) => {
        await keyVaultService.deleteKey(id);
      },
      revealKey: async (id: number) => keyVaultService.getPlaintextById(id),
      listCredentials: async () => credentialsService.list(),
      createCredential: async (input) => credentialsService.create(input),
      updateCredential: async (input) => credentialsService.update(input),
      deleteCredential: async (id: number) => {
        await credentialsService.delete(id);
      },
      revealCredentialPassword: async (id: number) => credentialsService.getPassword(id),
      generateCredentialPassword: (length?: number) => credentialsService.generatePassword(length),
      listProjects: async () => projectService.listProjects(),
      createProject: async (input) => projectService.createProject(input),
      updateProject: async (id, input) => {
        await projectService.updateProject(id, input);
      },
      deleteProject: async (id: number) => {
        await projectService.deleteProject(id);
      },
      listProjectAssignments: async (projectId: number) => projectService.getKeysForProject(projectId),
      assignProjectKey: async (projectId, apiKeyId, environment, isPrimary) => {
        await projectService.assignKey(projectId, apiKeyId, environment, isPrimary);
      },
      unassignProjectKey: async (projectId, apiKeyId, environment) => {
        await projectService.unassignKey(projectId, apiKeyId, environment);
      },
      importProjectEnv: async (input) => projectService.importEnvIntoProject(input),
    },
  };
}

function colorize(text: string, color: string): string {
  if (!process.stdout.isTTY) return text;
  return `${color}${text}${ANSI.reset}`;
}

function printBanner(print: (line?: string) => void): void {
  const art = [
    ' __   __   _   _ _   _____   ___ ___ ',
    ' \\ \\ / /__| | | | | |_   _| | _ \\_ _|',
    "  \\ V / _ \\ |_| | |   | |   | |_) | | ",
    '   |_|\\___/\\___/|_|   |_|   |___/___|',
  ];

  print(colorize(art[0], ANSI.brightRed));
  print(colorize(art[1], ANSI.red));
  print(colorize(art[2], ANSI.red));
  print(colorize(art[3], ANSI.brightBlack));
  print(colorize(` ${BRAND} cli`, ANSI.brightBlack));
  print('');
}

function promptLine(label: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(label, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptSecret(label: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const mutableRl = rl as readline.Interface & { stdoutMuted?: boolean; _writeToOutput?: (value: string) => void };
    mutableRl.stdoutMuted = true;
    const originalWriter = mutableRl._writeToOutput;
    mutableRl._writeToOutput = (value: string) => {
      if (mutableRl.stdoutMuted) {
        rl.output.write('*');
        return;
      }
      if (originalWriter) {
        originalWriter.call(rl, value);
      } else {
        rl.output.write(value);
      }
    };

    rl.question(label, (answer) => {
      mutableRl.stdoutMuted = false;
      rl.output.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

export async function runCli(app: App, cliArgs: string[]): Promise<number> {
  const { services } = await createServices();
  const context: CliContext = {
    argv: cliArgs,
    appVersion: app.getVersion(),
    commands: CLI_COMMANDS,
    services,
    print: (line = '') => {
      process.stdout.write(`${line}\n`);
    },
    error: (line) => {
      process.stderr.write(`${line}\n`);
    },
    promptLine,
    promptSecret,
  };

  try {
    printBanner(context.print);

    if (cliArgs.length === 0) {
      printGlobalHelp(context);
      return 0;
    }

    const { command, consumed } = findCommand(CLI_COMMANDS, cliArgs);
    if (!command) {
      context.error('Unknown command.');
      context.print('');
      printGlobalHelp(context);
      return 2;
    }

    return command.run(context, cliArgs.slice(consumed));
  } catch (error) {
    context.error('CLI command failed.');
    if (process.env.OMNIVIEW_CLI_DEBUG === '1') {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      context.error(message);
    }
    return 1;
  }
}

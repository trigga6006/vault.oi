import type { CliCommand, CliContext } from './types';
import type { Environment } from '../../shared/types/project.types';

const BRAND = 'vault.oi';

type ParsedArgs = {
  positionals: string[];
  flags: Map<string, string | true>;
};

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('--') || token.length <= 2) {
      positionals.push(token);
      continue;
    }

    const name = token.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, true);
    }
  }

  return { positionals, flags };
}

function formatColumns(rows: Array<Record<string, string>>, columns: string[]): string[] {
  const widths = columns.map((column) => Math.max(column.length, ...rows.map((row) => (row[column] ?? '').length)));
  const divider = widths.map((width) => '-'.repeat(width)).join('  ');
  const header = columns.map((column, index) => column.padEnd(widths[index])).join('  ');
  const body = rows.map((row) => columns.map((column, index) => (row[column] ?? '').padEnd(widths[index])).join('  '));
  return [header, divider, ...body];
}

function printUsage(context: CliContext, usage: string): void {
  context.print(`Usage: ${usage}`);
}

function ensureNoPositionals(context: CliContext, parsed: ParsedArgs, usage: string): boolean {
  if (parsed.positionals.length === 0) return true;
  context.error('Unexpected positional arguments.');
  printUsage(context, usage);
  return false;
}

function ensureOnlyAllowedFlags(
  context: CliContext,
  parsed: ParsedArgs,
  allowedFlags: readonly string[],
  usage: string,
): boolean {
  const allowed = new Set(allowedFlags);
  const unknown = Array.from(parsed.flags.keys()).filter((flag) => !allowed.has(flag));
  if (unknown.length === 0) return true;
  context.error(`Unknown flags: ${unknown.map((flag) => `--${flag}`).join(', ')}`);
  printUsage(context, usage);
  return false;
}

function getStringFlag(context: CliContext, parsed: ParsedArgs, name: string, usage: string): string | null {
  const raw = parsed.flags.get(name);
  if (raw === undefined) return null;
  if (raw === true) {
    context.error(`Flag --${name} requires a value.`);
    printUsage(context, usage);
    return null;
  }
  return raw;
}

function getRequiredStringFlag(context: CliContext, parsed: ParsedArgs, name: string, usage: string): string | null {
  const value = getStringFlag(context, parsed, name, usage);
  if (value === null) {
    if (!parsed.flags.has(name)) {
      context.error(`Missing required flag --${name}.`);
      printUsage(context, usage);
    }
    return null;
  }
  return value;
}

function getNumberFlag(context: CliContext, parsed: ParsedArgs, name: string, usage: string): number | null {
  const raw = getStringFlag(context, parsed, name, usage);
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    context.error(`Invalid numeric value for --${name}.`);
    printUsage(context, usage);
    return null;
  }
  return value;
}

function getBooleanFlag(context: CliContext, parsed: ParsedArgs, name: string, usage: string): boolean | null {
  const raw = getStringFlag(context, parsed, name, usage);
  if (raw === null) return null;
  const normalized = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  context.error(`Invalid boolean value for --${name}. Use true/false.`);
  printUsage(context, usage);
  return null;
}

function getRequiredPositiveIntFlag(
  context: CliContext,
  parsed: ParsedArgs,
  name: string,
  usage: string,
): number | null {
  const value = getNumberFlag(context, parsed, name, usage);
  if (value === null) {
    if (!parsed.flags.has(name)) {
      context.error(`Missing required flag --${name}.`);
      printUsage(context, usage);
    }
    return null;
  }

  if (!Number.isInteger(value) || value <= 0) {
    context.error(`Flag --${name} must be a positive integer.`);
    printUsage(context, usage);
    return null;
  }

  return value;
}

function parseEnvironmentFlag(
  context: CliContext,
  parsed: ParsedArgs,
  name: string,
  usage: string,
): Environment | null {
  const value = getRequiredStringFlag(context, parsed, name, usage);
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'dev' || normalized === 'staging' || normalized === 'prod') {
    return normalized;
  }
  context.error(`Invalid --${name} value. Use one of: dev, staging, prod.`);
  printUsage(context, usage);
  return null;
}

async function getSecretInput(
  context: CliContext,
  parsed: ParsedArgs,
  envFlagName: string,
  promptLabel: string,
  usage: string,
): Promise<string | null> {
  const envVarName = getStringFlag(context, parsed, envFlagName, usage);
  if (envVarName !== null) {
    const value = process.env[envVarName];
    if (!value) {
      context.error(`Environment variable ${envVarName} is empty or undefined.`);
      return null;
    }
    return value;
  }

  const prompted = await context.promptSecret(promptLabel);
  if (!prompted) {
    context.error('Input cannot be empty.');
    return null;
  }
  return prompted;
}

function renderCommandHelp(context: CliContext, path?: string[]): void {
  const commands = path && path.length > 0
    ? context.commands.filter((command) => command.path.length >= path.length && path.every((part, index) => command.path[index] === part))
    : context.commands;
  const title = path && path.length > 0 ? `${BRAND} CLI - ${path.join(' ')}` : `${BRAND} CLI`;
  context.print(title);
  context.print('');

  const rootDepth = path?.length ?? 0;
  const directCommands = commands
    .filter((command) => command.path.length === rootDepth + 1)
    .sort((a, b) => a.path.join(' ').localeCompare(b.path.join(' ')));

  if (directCommands.length > 0) {
    context.print('Commands:');
    directCommands.forEach((command) => {
      context.print(`  ${command.path.join(' ')}  ${command.summary}`);
    });
    context.print('');
  }

  if (!path || path.length === 0) {
    context.print('Run `--cli help <command>` for command-specific usage.');
    context.print(`Example: \`${BRAND}.exe --cli keys list\``);
  }
}

async function runAliasedCommand(context: CliContext, path: string[], args: string[]): Promise<number> {
  const key = path.join('\u0000');
  const target = context.commands.find((command) => command.path.join('\u0000') === key);
  if (!target) {
    context.error(`Internal error: command alias target not found (${path.join(' ')})`);
    return 1;
  }
  return target.run(context, args);
}

const helpCommand: CliCommand = {
  path: ['help'],
  summary: 'Show command help',
  usage: 'help [command-group]',
  examples: ['help', 'help keys'],
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureOnlyAllowedFlags(context, parsed, [], helpCommand.usage)) return 2;
    renderCommandHelp(context, parsed.positionals.length > 0 ? parsed.positionals : undefined);
    return 0;
  },
};

const versionCommand: CliCommand = {
  path: ['version'],
  summary: 'Print app version',
  usage: 'version',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, versionCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, [], versionCommand.usage)) return 2;
    context.print(context.appVersion);
    return 0;
  },
};

const vaultGroupCommand: CliCommand = {
  path: ['vault'],
  summary: 'Vault commands',
  usage: 'vault <subcommand>',
  run: async (context) => {
    renderCommandHelp(context, ['vault']);
    return 0;
  },
};

const vaultStatusCommand: CliCommand = {
  path: ['vault', 'status'],
  summary: 'Print vault lock/initialization status',
  usage: 'vault status',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, vaultStatusCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, [], vaultStatusCommand.usage)) return 2;
    const status = await context.services.getVaultStatus();
    context.print(`initialized: ${status.initialized}`);
    context.print(`unlocked: ${status.unlocked}`);
    context.print(`autoLockMinutes: ${status.autoLockMinutes}`);
    return 0;
  },
};

const vaultInitCommand: CliCommand = {
  path: ['vault', 'init'],
  summary: 'Initialize vault with a new master password',
  usage: 'vault init [--password-env ENV_VAR]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, vaultInitCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['password-env'], vaultInitCommand.usage)) return 2;

    const password = await getSecretInput(context, parsed, 'password-env', 'Master password: ', vaultInitCommand.usage);
    if (!password) return 2;

    if (!parsed.flags.has('password-env')) {
      const confirm = await context.promptSecret('Confirm password: ');
      if (password !== confirm) {
        context.error('Passwords do not match.');
        return 2;
      }
    }

    await context.services.initializeVault(password);
    context.print('Vault initialized.');
    return 0;
  },
};

const vaultUnlockCommand: CliCommand = {
  path: ['vault', 'unlock'],
  summary: 'Unlock vault for this CLI session',
  usage: 'vault unlock [--password-env ENV_VAR]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, vaultUnlockCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['password-env'], vaultUnlockCommand.usage)) return 2;

    const password = await getSecretInput(context, parsed, 'password-env', 'Master password: ', vaultUnlockCommand.usage);
    if (!password) return 2;

    const success = await context.services.unlockVault(password);
    if (!success) {
      context.error('Unlock failed.');
      return 1;
    }

    context.print('Vault unlocked.');
    return 0;
  },
};

const vaultLockCommand: CliCommand = {
  path: ['vault', 'lock'],
  summary: 'Lock vault for current process',
  usage: 'vault lock',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, vaultLockCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, [], vaultLockCommand.usage)) return 2;
    await context.services.lockVault();
    context.print('Vault locked.');
    return 0;
  },
};

const vaultAutoLockCommand: CliCommand = {
  path: ['vault', 'set-auto-lock'],
  summary: 'Set vault auto-lock timeout in minutes',
  usage: 'vault set-auto-lock --minutes <number>',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, vaultAutoLockCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['minutes'], vaultAutoLockCommand.usage)) return 2;

    const minutes = getNumberFlag(context, parsed, 'minutes', vaultAutoLockCommand.usage);
    if (minutes === null) return 2;
    if (minutes < 0 || !Number.isInteger(minutes)) {
      context.error('--minutes must be a non-negative integer.');
      return 2;
    }

    await context.services.setVaultAutoLock(minutes);
    context.print(`autoLockMinutes: ${minutes}`);
    return 0;
  },
};

const profilesGroupCommand: CliCommand = {
  path: ['profiles'],
  summary: 'Profile commands',
  usage: 'profiles <subcommand>',
  run: async (context) => {
    renderCommandHelp(context, ['profiles']);
    return 0;
  },
};

const profilesListCommand: CliCommand = {
  path: ['profiles', 'list'],
  summary: 'List available vault profiles',
  usage: 'profiles list',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, profilesListCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, [], profilesListCommand.usage)) return 2;
    const state = await context.services.getProfileState();
    const rows = state.profiles.map((profile) => ({
      active: profile.id === state.activeProfileId ? '*' : '',
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt,
    }));

    if (rows.length === 0) {
      context.print('No profiles found.');
      return 0;
    }

    formatColumns(rows, ['active', 'id', 'name', 'createdAt']).forEach((line) => context.print(line));
    return 0;
  },
};

const profilesCreateCommand: CliCommand = {
  path: ['profiles', 'create'],
  summary: 'Create a new profile',
  usage: 'profiles create --name "<display-name>"',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, profilesCreateCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['name'], profilesCreateCommand.usage)) return 2;

    const name = getRequiredStringFlag(context, parsed, 'name', profilesCreateCommand.usage);
    if (!name) return 2;
    await context.services.createProfile(name);
    context.print('Profile created.');
    return 0;
  },
};

const profilesUseCommand: CliCommand = {
  path: ['profiles', 'use'],
  summary: 'Switch active profile',
  usage: 'profiles use --id <profile-id>',
  examples: ['profiles use --id personal'],
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, profilesUseCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id'], profilesUseCommand.usage)) return 2;
    const profileId = getRequiredStringFlag(context, parsed, 'id', profilesUseCommand.usage);
    if (!profileId) return 2;

    await context.services.switchProfile(profileId);
    const state = await context.services.getProfileState();
    context.print(`activeProfileId: ${state.activeProfileId}`);
    return 0;
  },
};

const keysGroupCommand: CliCommand = {
  path: ['keys'],
  summary: 'Key/secret commands',
  usage: 'keys <subcommand>',
  run: async (context) => {
    renderCommandHelp(context, ['keys']);
    return 0;
  },
};

const keysListCommand: CliCommand = {
  path: ['keys', 'list'],
  summary: 'List stored key metadata (no plaintext)',
  usage: 'keys list',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, keysListCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, [], keysListCommand.usage)) return 2;

    const keys = await context.services.listKeys();
    if (keys.length === 0) {
      context.print('No keys found.');
      return 0;
    }

    const rows = keys.map((key) => ({
      id: String(key.id),
      provider: key.providerId,
      label: key.keyLabel,
      active: key.isActive ? 'yes' : 'no',
      verified: key.lastVerifiedAt ? 'yes' : 'no',
      prefix: key.keyPrefix ?? 'masked',
    }));

    formatColumns(rows, ['id', 'provider', 'label', 'active', 'verified', 'prefix']).forEach((line) => context.print(line));
    return 0;
  },
};

const keysCreateCommand: CliCommand = {
  path: ['keys', 'create'],
  summary: 'Create and store an encrypted key',
  usage: 'keys create --provider <id> [--label <name>] [--key-env ENV_VAR] [--notes <text>] [--service-type <text>] [--generated-where <text>] [--expires-at <iso-date>]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, keysCreateCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['provider', 'label', 'key-env', 'notes', 'service-type', 'generated-where', 'expires-at'], keysCreateCommand.usage)) return 2;

    const providerId = getRequiredStringFlag(context, parsed, 'provider', keysCreateCommand.usage);
    if (!providerId) return 2;

    const apiKey = await getSecretInput(context, parsed, 'key-env', 'API key: ', keysCreateCommand.usage);
    if (!apiKey) return 2;

    const result = await context.services.storeKey({
      providerId,
      apiKey,
      label: getStringFlag(context, parsed, 'label', keysCreateCommand.usage) ?? undefined,
      notes: getStringFlag(context, parsed, 'notes', keysCreateCommand.usage) ?? undefined,
      serviceType: getStringFlag(context, parsed, 'service-type', keysCreateCommand.usage) ?? undefined,
      generatedWhere: getStringFlag(context, parsed, 'generated-where', keysCreateCommand.usage) ?? undefined,
      expiresAt: getStringFlag(context, parsed, 'expires-at', keysCreateCommand.usage) ?? undefined,
    });

    context.print(`id: ${result.id}`);
    context.print(`provider: ${result.providerId}`);
    context.print(`label: ${result.keyLabel}`);
    context.print('stored: yes');
    return 0;
  },
};

const keysUpdateCommand: CliCommand = {
  path: ['keys', 'update'],
  summary: 'Update key metadata/state',
  usage: 'keys update --id <number> [--label <name>] [--notes <text>] [--service-type <text>] [--generated-where <text>] [--expires-at <iso-date|none>] [--active <true|false>]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, keysUpdateCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id', 'label', 'notes', 'service-type', 'generated-where', 'expires-at', 'active'], keysUpdateCommand.usage)) return 2;

    const id = getNumberFlag(context, parsed, 'id', keysUpdateCommand.usage);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      context.error('Flag --id must be a positive integer.');
      return 2;
    }

    const label = getStringFlag(context, parsed, 'label', keysUpdateCommand.usage);
    const notes = getStringFlag(context, parsed, 'notes', keysUpdateCommand.usage);
    const serviceType = getStringFlag(context, parsed, 'service-type', keysUpdateCommand.usage);
    const generatedWhere = getStringFlag(context, parsed, 'generated-where', keysUpdateCommand.usage);
    const expiresAtInput = getStringFlag(context, parsed, 'expires-at', keysUpdateCommand.usage);
    const active = getBooleanFlag(context, parsed, 'active', keysUpdateCommand.usage);

    const expiresAt = expiresAtInput
      ? (['none', 'null', 'clear'].includes(expiresAtInput.toLowerCase()) ? null : expiresAtInput)
      : undefined;

    if (label === null && notes === null && serviceType === null && generatedWhere === null && expiresAt === undefined && active === null) {
      context.error('No update fields provided.');
      printUsage(context, keysUpdateCommand.usage);
      return 2;
    }

    await context.services.updateKey(id, {
      label: label ?? undefined,
      notes: notes ?? undefined,
      serviceType: serviceType ?? undefined,
      generatedWhere: generatedWhere ?? undefined,
      expiresAt,
      isActive: active ?? undefined,
    });

    context.print('Key updated.');
    return 0;
  },
};

const keysVerifyCommand: CliCommand = {
  path: ['keys', 'verify'],
  summary: 'Mark key as manually verified',
  usage: 'keys verify --id <number>',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, keysVerifyCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id'], keysVerifyCommand.usage)) return 2;
    const id = getNumberFlag(context, parsed, 'id', keysVerifyCommand.usage);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      context.error('Flag --id must be a positive integer.');
      return 2;
    }

    await context.services.markKeyVerified(id);
    context.print('Key marked as verified.');
    return 0;
  },
};

const keysRotateCommand: CliCommand = {
  path: ['keys', 'rotate'],
  summary: 'Rotate key value',
  usage: 'keys rotate --id <number> [--key-env ENV_VAR]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, keysRotateCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id', 'key-env'], keysRotateCommand.usage)) return 2;
    const id = getNumberFlag(context, parsed, 'id', keysRotateCommand.usage);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      context.error('Flag --id must be a positive integer.');
      return 2;
    }

    const newKey = await getSecretInput(context, parsed, 'key-env', 'New API key: ', keysRotateCommand.usage);
    if (!newKey) return 2;

    await context.services.rotateKey(id, newKey);
    context.print('Key rotated.');
    return 0;
  },
};

const keysDeleteCommand: CliCommand = {
  path: ['keys', 'delete'],
  summary: 'Delete key metadata and encrypted value',
  usage: 'keys delete --id <number> --yes true',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, keysDeleteCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id', 'yes'], keysDeleteCommand.usage)) return 2;
    const id = getNumberFlag(context, parsed, 'id', keysDeleteCommand.usage);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      context.error('Flag --id must be a positive integer.');
      return 2;
    }

    const yes = getBooleanFlag(context, parsed, 'yes', keysDeleteCommand.usage);
    if (yes !== true) {
      context.error('Deletion requires --yes true.');
      return 2;
    }

    await context.services.deleteKey(id);
    context.print('Key deleted.');
    return 0;
  },
};

const keysRevealCommand: CliCommand = {
  path: ['keys', 'reveal'],
  summary: 'Reveal plaintext key (explicit confirmation required)',
  usage: 'keys reveal --id <number> --yes true',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, keysRevealCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id', 'yes'], keysRevealCommand.usage)) return 2;

    const id = getRequiredPositiveIntFlag(context, parsed, 'id', keysRevealCommand.usage);
    if (id === null) return 2;

    const yes = getBooleanFlag(context, parsed, 'yes', keysRevealCommand.usage);
    if (yes !== true) {
      context.error('Reveal requires --yes true.');
      return 2;
    }

    const secret = await context.services.revealKey(id);
    context.print(secret);
    return 0;
  },
};

const credentialsGroupCommand: CliCommand = {
  path: ['credentials'],
  summary: 'Credential commands',
  usage: 'credentials <subcommand>',
  run: async (context) => {
    renderCommandHelp(context, ['credentials']);
    return 0;
  },
};

const credentialsListCommand: CliCommand = {
  path: ['credentials', 'list'],
  summary: 'List credentials (passwords excluded)',
  usage: 'credentials list',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, credentialsListCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, [], credentialsListCommand.usage)) return 2;

    const credentials = await context.services.listCredentials();
    if (credentials.length === 0) {
      context.print('No credentials found.');
      return 0;
    }

    const rows = credentials.map((credential) => ({
      id: String(credential.id),
      title: credential.title,
      provider: credential.providerId ?? '',
      projectId: credential.projectId ? String(credential.projectId) : '',
      username: credential.username,
    }));

    formatColumns(rows, ['id', 'title', 'provider', 'projectId', 'username']).forEach((line) => context.print(line));
    return 0;
  },
};

const credentialsCreateCommand: CliCommand = {
  path: ['credentials', 'create'],
  summary: 'Create a credential entry',
  usage: 'credentials create --title <title> --username <value> [--password-env ENV_VAR] [--provider <id>] [--project-id <number>] [--notes <text>]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, credentialsCreateCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['title', 'username', 'password-env', 'provider', 'project-id', 'notes'], credentialsCreateCommand.usage)) return 2;

    const title = getRequiredStringFlag(context, parsed, 'title', credentialsCreateCommand.usage);
    if (!title) return 2;
    const username = getRequiredStringFlag(context, parsed, 'username', credentialsCreateCommand.usage);
    if (!username) return 2;

    const password = await getSecretInput(context, parsed, 'password-env', 'Credential password: ', credentialsCreateCommand.usage);
    if (!password) return 2;

    const projectId = getNumberFlag(context, parsed, 'project-id', credentialsCreateCommand.usage);
    if (projectId !== null && (!Number.isInteger(projectId) || projectId <= 0)) {
      context.error('--project-id must be a positive integer.');
      return 2;
    }

    const created = await context.services.createCredential({
      title,
      username,
      password,
      providerId: getStringFlag(context, parsed, 'provider', credentialsCreateCommand.usage),
      projectId: projectId ?? undefined,
      notes: getStringFlag(context, parsed, 'notes', credentialsCreateCommand.usage) ?? undefined,
    });

    context.print(`id: ${created.id}`);
    context.print(`title: ${created.title}`);
    context.print('created: yes');
    return 0;
  },
};

const credentialsUpdateCommand: CliCommand = {
  path: ['credentials', 'update'],
  summary: 'Update credential fields',
  usage: 'credentials update --id <number> [--title <title>] [--username <value>] [--password-env ENV_VAR] [--provider <id|none>] [--project-id <number|none>] [--notes <text|none>]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, credentialsUpdateCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id', 'title', 'username', 'password-env', 'provider', 'project-id', 'notes'], credentialsUpdateCommand.usage)) return 2;

    const id = getNumberFlag(context, parsed, 'id', credentialsUpdateCommand.usage);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      context.error('--id must be a positive integer.');
      return 2;
    }

    const title = getStringFlag(context, parsed, 'title', credentialsUpdateCommand.usage);
    const username = getStringFlag(context, parsed, 'username', credentialsUpdateCommand.usage);
    const providerInput = getStringFlag(context, parsed, 'provider', credentialsUpdateCommand.usage);
    const projectInput = getStringFlag(context, parsed, 'project-id', credentialsUpdateCommand.usage);
    const notesInput = getStringFlag(context, parsed, 'notes', credentialsUpdateCommand.usage);

    let password: string | undefined;
    if (parsed.flags.has('password-env')) {
      const resolved = await getSecretInput(context, parsed, 'password-env', 'New credential password: ', credentialsUpdateCommand.usage);
      if (!resolved) return 2;
      password = resolved;
    }

    let projectId: number | null | undefined;
    if (projectInput !== null) {
      if (['none', 'null', 'clear'].includes(projectInput.toLowerCase())) {
        projectId = null;
      } else {
        const parsedProject = Number(projectInput);
        if (!Number.isFinite(parsedProject) || !Number.isInteger(parsedProject) || parsedProject <= 0) {
          context.error('--project-id must be a positive integer or one of: none/null/clear.');
          return 2;
        }
        projectId = parsedProject;
      }
    }

    const providerId = providerInput === null
      ? undefined
      : (['none', 'null', 'clear'].includes(providerInput.toLowerCase()) ? null : providerInput);

    const notes = notesInput === null
      ? undefined
      : (['none', 'null', 'clear'].includes(notesInput.toLowerCase()) ? '' : notesInput);

    if (title === null && username === null && password === undefined && providerId === undefined && projectId === undefined && notes === undefined) {
      context.error('No update fields provided.');
      printUsage(context, credentialsUpdateCommand.usage);
      return 2;
    }

    await context.services.updateCredential({
      id,
      title: title ?? undefined,
      username: username ?? undefined,
      password,
      providerId,
      projectId,
      notes: notes ?? undefined,
    });

    context.print('Credential updated.');
    return 0;
  },
};

const credentialsDeleteCommand: CliCommand = {
  path: ['credentials', 'delete'],
  summary: 'Delete credential',
  usage: 'credentials delete --id <number> --yes true',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, credentialsDeleteCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id', 'yes'], credentialsDeleteCommand.usage)) return 2;
    const id = getNumberFlag(context, parsed, 'id', credentialsDeleteCommand.usage);
    if (id === null || !Number.isInteger(id) || id <= 0) {
      context.error('--id must be a positive integer.');
      return 2;
    }

    const yes = getBooleanFlag(context, parsed, 'yes', credentialsDeleteCommand.usage);
    if (yes !== true) {
      context.error('Deletion requires --yes true.');
      return 2;
    }

    await context.services.deleteCredential(id);
    context.print('Credential deleted.');
    return 0;
  },
};

const credentialsRevealPasswordCommand: CliCommand = {
  path: ['credentials', 'reveal-password'],
  summary: 'Reveal credential password (explicit confirmation required)',
  usage: 'credentials reveal-password --id <number> --yes true',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, credentialsRevealPasswordCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id', 'yes'], credentialsRevealPasswordCommand.usage)) return 2;

    const id = getRequiredPositiveIntFlag(context, parsed, 'id', credentialsRevealPasswordCommand.usage);
    if (id === null) return 2;

    const yes = getBooleanFlag(context, parsed, 'yes', credentialsRevealPasswordCommand.usage);
    if (yes !== true) {
      context.error('Reveal requires --yes true.');
      return 2;
    }

    const password = await context.services.revealCredentialPassword(id);
    context.print(password);
    return 0;
  },
};

const credentialsGeneratePasswordCommand: CliCommand = {
  path: ['credentials', 'generate-password'],
  summary: 'Generate a strong password locally',
  usage: 'credentials generate-password [--length <16-128>]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, credentialsGeneratePasswordCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['length'], credentialsGeneratePasswordCommand.usage)) return 2;

    const length = getNumberFlag(context, parsed, 'length', credentialsGeneratePasswordCommand.usage);
    if (length !== null && (!Number.isInteger(length) || length < 16 || length > 128)) {
      context.error('--length must be an integer between 16 and 128.');
      return 2;
    }

    const password = context.services.generateCredentialPassword(length ?? undefined);
    context.print(password);
    return 0;
  },
};

const projectsGroupCommand: CliCommand = {
  path: ['projects'],
  summary: 'Workspace/project commands',
  usage: 'projects <subcommand>',
  run: async (context) => {
    renderCommandHelp(context, ['projects']);
    return 0;
  },
};

const projectsListCommand: CliCommand = {
  path: ['projects', 'list'],
  summary: 'List projects',
  usage: 'projects list',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, projectsListCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, [], projectsListCommand.usage)) return 2;

    const projects = await context.services.listProjects();
    if (projects.length === 0) {
      context.print('No projects found.');
      return 0;
    }

    const rows = projects.map((project) => ({
      id: String(project.id),
      name: project.name,
      default: project.isDefault ? 'yes' : 'no',
      color: project.color,
      repoPath: project.gitRepoPath ?? '',
    }));

    formatColumns(rows, ['id', 'name', 'default', 'color', 'repoPath']).forEach((line) => context.print(line));
    return 0;
  },
};

const projectsCreateCommand: CliCommand = {
  path: ['projects', 'create'],
  summary: 'Create a project/workspace',
  usage: 'projects create --name <name> [--description <text>] [--color <hex>] [--repo-path <path>] [--is-default <true|false>]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, projectsCreateCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['name', 'description', 'color', 'repo-path', 'is-default'], projectsCreateCommand.usage)) return 2;

    const name = getRequiredStringFlag(context, parsed, 'name', projectsCreateCommand.usage);
    if (!name) return 2;

    const isDefault = getBooleanFlag(context, parsed, 'is-default', projectsCreateCommand.usage);
    if (parsed.flags.has('is-default') && isDefault === null) return 2;

    const created = await context.services.createProject({
      name,
      description: getStringFlag(context, parsed, 'description', projectsCreateCommand.usage) ?? undefined,
      color: getStringFlag(context, parsed, 'color', projectsCreateCommand.usage) ?? undefined,
      gitRepoPath: getStringFlag(context, parsed, 'repo-path', projectsCreateCommand.usage) ?? undefined,
      isDefault: isDefault ?? undefined,
    });

    context.print(`id: ${created.id}`);
    context.print(`name: ${created.name}`);
    context.print('created: yes');
    return 0;
  },
};

const projectsUpdateCommand: CliCommand = {
  path: ['projects', 'update'],
  summary: 'Update project metadata',
  usage: 'projects update --id <number> [--name <name>] [--description <text|none>] [--color <hex>] [--repo-path <path|none>] [--is-default <true|false>]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, projectsUpdateCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id', 'name', 'description', 'color', 'repo-path', 'is-default'], projectsUpdateCommand.usage)) return 2;

    const id = getRequiredPositiveIntFlag(context, parsed, 'id', projectsUpdateCommand.usage);
    if (id === null) return 2;

    const name = getStringFlag(context, parsed, 'name', projectsUpdateCommand.usage);
    const color = getStringFlag(context, parsed, 'color', projectsUpdateCommand.usage);

    const descriptionInput = getStringFlag(context, parsed, 'description', projectsUpdateCommand.usage);
    const description = descriptionInput === null
      ? undefined
      : (['none', 'null', 'clear'].includes(descriptionInput.toLowerCase()) ? null : descriptionInput);

    const repoPathInput = getStringFlag(context, parsed, 'repo-path', projectsUpdateCommand.usage);
    const gitRepoPath = repoPathInput === null
      ? undefined
      : (['none', 'null', 'clear'].includes(repoPathInput.toLowerCase()) ? null : repoPathInput);

    const isDefault = getBooleanFlag(context, parsed, 'is-default', projectsUpdateCommand.usage);
    if (parsed.flags.has('is-default') && isDefault === null) return 2;

    if (
      name === null
      && description === undefined
      && color === null
      && gitRepoPath === undefined
      && isDefault === null
    ) {
      context.error('No update fields provided.');
      printUsage(context, projectsUpdateCommand.usage);
      return 2;
    }

    await context.services.updateProject(id, {
      name: name ?? undefined,
      description,
      color: color ?? undefined,
      gitRepoPath,
      isDefault: isDefault ?? undefined,
    });
    context.print('Project updated.');
    return 0;
  },
};

const projectsDeleteCommand: CliCommand = {
  path: ['projects', 'delete'],
  summary: 'Delete a project/workspace',
  usage: 'projects delete --id <number> --yes true',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, projectsDeleteCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['id', 'yes'], projectsDeleteCommand.usage)) return 2;

    const id = getRequiredPositiveIntFlag(context, parsed, 'id', projectsDeleteCommand.usage);
    if (id === null) return 2;

    const yes = getBooleanFlag(context, parsed, 'yes', projectsDeleteCommand.usage);
    if (yes !== true) {
      context.error('Deletion requires --yes true.');
      return 2;
    }

    await context.services.deleteProject(id);
    context.print('Project deleted.');
    return 0;
  },
};

const projectsKeysCommand: CliCommand = {
  path: ['projects', 'keys'],
  summary: 'List key assignments for a project',
  usage: 'projects keys --project-id <number>',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, projectsKeysCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['project-id'], projectsKeysCommand.usage)) return 2;

    const projectId = getRequiredPositiveIntFlag(context, parsed, 'project-id', projectsKeysCommand.usage);
    if (projectId === null) return 2;

    const assignments = await context.services.listProjectAssignments(projectId);
    if (assignments.length === 0) {
      context.print('No key assignments found.');
      return 0;
    }

    const keys = await context.services.listKeys();
    const keyById = new Map(keys.map((key) => [key.id, key]));

    const rows = assignments.map((assignment) => {
      const key = keyById.get(assignment.apiKeyId);
      return {
        assignmentId: String(assignment.id),
        keyId: String(assignment.apiKeyId),
        environment: assignment.environment,
        primary: assignment.isPrimary ? 'yes' : 'no',
        provider: key?.providerId ?? '',
        label: key?.keyLabel ?? '',
      };
    });

    formatColumns(rows, ['assignmentId', 'keyId', 'environment', 'primary', 'provider', 'label']).forEach((line) => context.print(line));
    return 0;
  },
};

const projectsAssignKeyCommand: CliCommand = {
  path: ['projects', 'assign-key'],
  summary: 'Assign a key to a project environment',
  usage: 'projects assign-key --project-id <number> --key-id <number> --environment <dev|staging|prod> [--primary <true|false>]',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, projectsAssignKeyCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['project-id', 'key-id', 'environment', 'primary'], projectsAssignKeyCommand.usage)) return 2;

    const projectId = getRequiredPositiveIntFlag(context, parsed, 'project-id', projectsAssignKeyCommand.usage);
    if (projectId === null) return 2;
    const keyId = getRequiredPositiveIntFlag(context, parsed, 'key-id', projectsAssignKeyCommand.usage);
    if (keyId === null) return 2;
    const environment = parseEnvironmentFlag(context, parsed, 'environment', projectsAssignKeyCommand.usage);
    if (!environment) return 2;

    const primary = getBooleanFlag(context, parsed, 'primary', projectsAssignKeyCommand.usage);
    if (parsed.flags.has('primary') && primary === null) return 2;

    await context.services.assignProjectKey(projectId, keyId, environment, primary ?? undefined);
    context.print('Key assigned to project.');
    return 0;
  },
};

const projectsUnassignKeyCommand: CliCommand = {
  path: ['projects', 'unassign-key'],
  summary: 'Remove a key assignment from a project environment',
  usage: 'projects unassign-key --project-id <number> --key-id <number> --environment <dev|staging|prod>',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, projectsUnassignKeyCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['project-id', 'key-id', 'environment'], projectsUnassignKeyCommand.usage)) return 2;

    const projectId = getRequiredPositiveIntFlag(context, parsed, 'project-id', projectsUnassignKeyCommand.usage);
    if (projectId === null) return 2;
    const keyId = getRequiredPositiveIntFlag(context, parsed, 'key-id', projectsUnassignKeyCommand.usage);
    if (keyId === null) return 2;
    const environment = parseEnvironmentFlag(context, parsed, 'environment', projectsUnassignKeyCommand.usage);
    if (!environment) return 2;

    await context.services.unassignProjectKey(projectId, keyId, environment);
    context.print('Key unassigned from project.');
    return 0;
  },
};

const projectsImportEnvCommand: CliCommand = {
  path: ['projects', 'import-env'],
  summary: 'Import an .env file into an existing project',
  usage: 'projects import-env --project-id <number> --env-file <path> --environment <dev|staging|prod>',
  run: async (context, args) => {
    const parsed = parseArgs(args);
    if (!ensureNoPositionals(context, parsed, projectsImportEnvCommand.usage)) return 2;
    if (!ensureOnlyAllowedFlags(context, parsed, ['project-id', 'env-file', 'environment'], projectsImportEnvCommand.usage)) return 2;

    const projectId = getRequiredPositiveIntFlag(context, parsed, 'project-id', projectsImportEnvCommand.usage);
    if (projectId === null) return 2;
    const envFilePath = getRequiredStringFlag(context, parsed, 'env-file', projectsImportEnvCommand.usage);
    if (!envFilePath) return 2;
    const environment = parseEnvironmentFlag(context, parsed, 'environment', projectsImportEnvCommand.usage);
    if (!environment) return 2;

    const result = await context.services.importProjectEnv({
      projectId,
      envFilePath,
      environment,
    });

    context.print(`projectId: ${result.projectId}`);
    context.print(`environment: ${result.environment}`);
    context.print(`sourcePath: ${result.sourcePath}`);
    context.print(`imported: ${result.imported}`);
    context.print(`updated: ${result.updated}`);
    context.print(`assigned: ${result.assigned}`);
    context.print(`unchanged: ${result.unchanged}`);
    context.print(`skipped: ${result.skipped}`);
    return 0;
  },
};

const secretsGroupCommand: CliCommand = {
  path: ['secrets'],
  summary: 'Alias for key commands',
  usage: 'secrets <subcommand>',
  run: async (context) => {
    renderCommandHelp(context, ['secrets']);
    return 0;
  },
};

const secretsListCommand: CliCommand = {
  path: ['secrets', 'list'],
  summary: 'Alias for `keys list`',
  usage: 'secrets list',
  run: async (context, args) => runAliasedCommand(context, ['keys', 'list'], args),
};

const secretsCreateCommand: CliCommand = {
  path: ['secrets', 'create'],
  summary: 'Alias for `keys create`',
  usage: 'secrets create --provider <id> [--label <name>] [--key-env ENV_VAR]',
  run: async (context, args) => runAliasedCommand(context, ['keys', 'create'], args),
};

const secretsUpdateCommand: CliCommand = {
  path: ['secrets', 'update'],
  summary: 'Alias for `keys update`',
  usage: 'secrets update --id <number> [fields]',
  run: async (context, args) => runAliasedCommand(context, ['keys', 'update'], args),
};

const secretsVerifyCommand: CliCommand = {
  path: ['secrets', 'verify'],
  summary: 'Alias for `keys verify`',
  usage: 'secrets verify --id <number>',
  run: async (context, args) => runAliasedCommand(context, ['keys', 'verify'], args),
};

const secretsRotateCommand: CliCommand = {
  path: ['secrets', 'rotate'],
  summary: 'Alias for `keys rotate`',
  usage: 'secrets rotate --id <number> [--key-env ENV_VAR]',
  run: async (context, args) => runAliasedCommand(context, ['keys', 'rotate'], args),
};

const secretsDeleteCommand: CliCommand = {
  path: ['secrets', 'delete'],
  summary: 'Alias for `keys delete`',
  usage: 'secrets delete --id <number> --yes true',
  run: async (context, args) => runAliasedCommand(context, ['keys', 'delete'], args),
};

const secretsRevealCommand: CliCommand = {
  path: ['secrets', 'reveal'],
  summary: 'Alias for `keys reveal`',
  usage: 'secrets reveal --id <number> --yes true',
  run: async (context, args) => runAliasedCommand(context, ['keys', 'reveal'], args),
};

export const CLI_COMMANDS: readonly CliCommand[] = [
  helpCommand,
  versionCommand,

  vaultGroupCommand,
  vaultStatusCommand,
  vaultInitCommand,
  vaultUnlockCommand,
  vaultLockCommand,
  vaultAutoLockCommand,

  profilesGroupCommand,
  profilesListCommand,
  profilesCreateCommand,
  profilesUseCommand,

  keysGroupCommand,
  keysListCommand,
  keysCreateCommand,
  keysUpdateCommand,
  keysVerifyCommand,
  keysRotateCommand,
  keysDeleteCommand,
  keysRevealCommand,

  credentialsGroupCommand,
  credentialsListCommand,
  credentialsCreateCommand,
  credentialsUpdateCommand,
  credentialsDeleteCommand,
  credentialsRevealPasswordCommand,
  credentialsGeneratePasswordCommand,

  projectsGroupCommand,
  projectsListCommand,
  projectsCreateCommand,
  projectsUpdateCommand,
  projectsDeleteCommand,
  projectsKeysCommand,
  projectsAssignKeyCommand,
  projectsUnassignKeyCommand,
  projectsImportEnvCommand,

  secretsGroupCommand,
  secretsListCommand,
  secretsCreateCommand,
  secretsUpdateCommand,
  secretsVerifyCommand,
  secretsRotateCommand,
  secretsDeleteCommand,
  secretsRevealCommand,
];

export function printGlobalHelp(context: CliContext): void {
  renderCommandHelp(context);
}

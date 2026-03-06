# vault.oi CLI Foundation

This repository now includes a built-in CLI mode in the same app binary.

## Invocation model

- Packaged app: `vault.oi.exe --cli <command>`
- Dev mode: `npm run cli -- <command>`

Examples:

- `vault.oi.exe --cli help`
- `vault.oi.exe --cli vault status`
- `vault.oi.exe --cli profiles list`
- `vault.oi.exe --cli profiles use --id personal`
- `vault.oi.exe --cli keys list`
- `vault.oi.exe --cli secrets create --provider openai --label "Team Key"`
- `vault.oi.exe --cli credentials create --title "Admin" --username "ops" --password-env ADMIN_PASSWORD`
- `vault.oi.exe --cli projects create --name "Workspace A" --repo-path "C:\code\workspace-a"`

## Why this approach

- No second installer is required.
- CLI and GUI share the same local profile, vault, and database context.
- Adding commands is centralized through a typed command registry.

## Command architecture

- Entry point: `src/main/cli/runner.ts`
- Command registry: `src/main/cli/commands.ts`
- Types: `src/main/cli/types.ts`

Each command defines:

- `path` (tokenized command name, e.g. `['keys', 'list']`)
- `summary`
- `usage`
- optional `examples`
- `run(context, args)`

## Adding a new command

1. Add a new `CliCommand` in `src/main/cli/commands.ts`.
2. Register it in `CLI_COMMANDS`.
3. Use `context.services` to call existing application services.
4. Keep outputs script-friendly (plain text rows / one value per line when possible).

## Next milestones

- Add structured output mode (`--json`).
- Add non-interactive vault export/import path-based commands for automation.
- Mirror remaining settings/provider controls in CLI.

## Security baseline (implemented)

- Plaintext reveal commands exist but require explicit `--yes true`.
- Unknown commands do not echo raw user arguments.
- Command failures return generic errors by default.
- Full error stacks require explicit opt-in: `OMNIVIEW_CLI_DEBUG=1`.
- Commands enforce strict argument counts to avoid silently accepting extra tokens.
- Secret inputs are prompted interactively (masked) or passed via environment variables.
- Destructive operations require explicit confirmation flags.

## Current command groups

- `vault`: `status`, `init`, `unlock`, `lock`, `set-auto-lock`
- `profiles`: `list`, `create`, `use`
- `keys`: `list`, `create`, `update`, `verify`, `rotate`, `delete`, `reveal`
- `secrets`: alias group for `keys` commands
- `credentials`: `list`, `create`, `update`, `delete`, `reveal-password`, `generate-password`
- `projects`: `list`, `create`, `update`, `delete`, `keys`, `assign-key`, `unassign-key`, `import-env`

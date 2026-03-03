# DevVault — Local-First Developer Secrets Vault (MVP v1)

## 1) Product Overview
- **Working name:** DevVault
- **Category:** Local-first encrypted desktop application
- **Target users:** Solo developers, indie hackers, and small teams (1–5 devs)
- **Primary use cases:** API keys, service credentials, environment variables, SSH keys, and other development secrets

### Non-Goals (v1)
- No cloud sync
- No team collaboration
- No browser autofill
- No crypto wallet or seed phrase storage
- No telemetry

## 2) Core Value Proposition
A lightweight, local-first encrypted secrets manager designed specifically for developers.

### Differentiators
- Project-scoped secret organization
- Secure `.env` export generation
- Local Git repository scanning (future enhancement)
- Zero cloud storage
- Zero remote transmission of secret material

## 3) Explicit Threat Model

### Defended Against
- Disk theft / copied hard drive
- Unauthorized access to vault file
- Casual local user access
- Clipboard persistence leakage

### Not Defended Against
- Fully compromised OS
- Keyloggers
- Privileged malware
- Hardware-level compromise

## 4) Architecture Overview

### Platform
- Preferred direction: **Tauri** (Rust backend + Web frontend)
- Current implementation: Electron (Node backend)

### Encryption Model
1. User creates vault with master password.
2. Master password is processed via **Argon2id** KDF into a 256-bit key.
3. Vault payload is encrypted with an AEAD mode.
   - Current implementation: **AES-256-GCM**
   - Optional future upgrade: XChaCha20-Poly1305
4. Vault metadata and encrypted payload are persisted locally on disk.

Optional roadmap item:
- OS keychain integration for convenience unlock.

## 5) Data Model (v1)

```ts
interface Vault {
  id: string; // UUID
  created_at: number;
  version: number;
  entries: Entry[];
  projects: Project[];
}
```

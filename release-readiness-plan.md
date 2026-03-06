# OmniView Release + Auto-Update Plan

Last updated: 2026-03-04
Status: Parked (not actively releasing yet)

## Goal
Prepare OmniView to be safely posted, hosted, downloaded, and auto-updated by external users.

## Scope for first public release
- Target: Windows first (expand to macOS/Linux later).
- Channel: stable only for v1.
- Hosting: GitHub Releases for installer artifacts and update feed.

## Implementation plan
1. Distribution decisions
- Confirm OS scope for v1 (Windows-only recommended first).
- Confirm release channel strategy (stable now, beta later).
- Confirm hosting destination (GitHub Releases).

2. App identity and trust
- Keep app identity stable (`name`, `productName`, app ID).
- Add production app icons (`.ico`, `.icns` when macOS is added).
- Configure Windows code signing for installer and executable.
- Add signing secrets/certs to CI securely.

3. Build and release pipeline
- Add CI workflow triggered by version tag (e.g., `v0.2.0`).
- Run `npm ci`, lint/tests, `npm run make`.
- Upload artifacts to GitHub Release.
- Publish checksums and release notes.

4. Auto-update implementation
- Add updater service in Electron main process.
- Check for updates on startup (delayed) and on interval.
- Download updates in background when available.
- Prompt user to restart to install downloaded update.
- Add "Check for updates" action in Settings UI.
- Display current app version and update status in Settings.

5. Data safety and migrations
- Keep `app.getPath('userData')` storage path stable.
- Move to explicit schema versioning + migration runner.
- Test upgrade path across multiple versions.
- Validate vault unlock and encrypted data after updates.

6. QA and release readiness
- Fresh install test.
- Update test from previous installer to new installer.
- Offline startup + network-failure update behavior.
- Verify no data loss in vault/projects/usage history.

7. Launch assets and documentation
- Create a simple download page or release docs.
- Add install instructions and update behavior docs.
- Add known limitations and support contact path.

## Day-to-day workflow after setup
Feature development flow remains mostly the same:
1. Build features locally (`npm run dev`).
2. Commit and push to repo.
3. Merge to main.
4. Bump version (`package.json`).
5. Create/push tag (e.g., `v0.2.0`).
6. CI builds/signs/publishes artifacts.
7. Installed users receive update prompt and restart to apply.

## Complexity impact
- One-time setup cost: moderate.
- Ongoing release overhead: low once pipeline is stable.
- Main ongoing discipline: versioning, migration compatibility, release checklist.

## Ordered execution when resuming
1. Implement updater service + Settings UI.
2. Add GitHub Releases publish pipeline.
3. Add robust versioned DB migrations.
4. Add release checklist and public install/update docs.

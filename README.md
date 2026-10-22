# Luo Chat

Black-and-gold chat PWA using Supabase and Vercel.

Live app: https://luo-chat-luokai25.vercel.app/

See [HARDENING_REPORT.md](HARDENING_REPORT.md), [STAGING.md](STAGING.md), [BACKUP_RESTORE.md](BACKUP_RESTORE.md) and [INTEGRATIONS.md](INTEGRATIONS.md) for checked controls, connected services and open operational gates.

See [CURRENT_RELEASE.md](CURRENT_RELEASE.md) for the current auth/navigation and call-quality fixes, verification evidence and remaining limits. Historical version notes below describe their original releases.

This release adds the 15 requested feature areas: calls, server-backed Web Push, albums, private folders, sticker/voice tools, encrypted text snapshots, dashboard, reading bookmarks, shared drawing, occasions, private imports, accessibility, diagnostics and storage tools. See `RELEASE_15.md` for exact behavior and limits, `PROJECT_CHECKLIST.md` for engineering gates, and `src/feature-status.js` for the in-app capability ledger. Optional TURN relay configuration and real-device call/push acceptance remain open.

The supplied icon and current 50 Luo Family stickers are preserved. No browser-warning clearance is implied.

## Build and verify

Use Node 24 (`.nvmrc` records the locally tested patch version). Vercel uses the managed 24.x runtime, whose patch may change.

```sh
npm ci --ignore-scripts
npm run release:check
npm run release:reproduce
npm run audit:production
```

`release:check` checks package/lockfile identity, runs the application checks and builds/verifies assets, release identity and PWA references. `release:reproduce` installs from the lockfile in a fresh temporary folder without dependency install hooks, runs the release checks there and compares every production file byte-for-byte. Neither command restores or tests a fresh backend. The production audit requires access to the package advisory service; a failed lookup is not a clean result.

## Configuration

`src/config.js` contains browser-safe project configuration. Only a Supabase publishable key or legacy anon key belongs in the browser. Build checks reject privileged keys and a backend origin inconsistent with `vercel.json`. Update both together when intentionally changing projects. Server secrets belong only in protected server settings/private storage; do not put them in source, chat or source archives.

The Vercel build command is `npm run release:check`; the tested install command is `npm ci --ignore-scripts`, with runtime 24.x and output `dist`. The build gate does not apply database migrations. See `OPERATIONS.md` for deployment, rollback, incident handling and manual verification gates.

## Backend and privacy

`supabase/migrations` contains incremental changes for the existing project. The complete starting schema and a fresh database restore are still unverified. Never apply all migrations to a blank project while assuming that the archive is a full database backup.

Database authorization is enforced with RLS and checked RPCs. `tests/*.sql` contains rolled-back fixtures for permissions, isolation and attack regressions; run only against an authorized project. Storage tests use metadata fixtures and are not a full file-transfer test. Account exports/downloaded copies, browser drafts and previously issued media URLs have separate retention limits. End-to-end encryption is not implemented.

## Release gates

The reported Google phishing warning has no confirmed clearance. Real recovery-email delivery, Google OAuth activation, hosted leaked-password protection, complete database restoration and physical-device acceptance tests remain open. Passing tests or serving HTTP 200 does not clear Google's warning. Do not bypass browser security warnings.

See `READINESS.md`, `ADVERSARIAL_REVIEW.md`, `SECURITY_REVIEW.md` and `GOOGLE_SIGN_IN.md`. Prior documentation is retained in `docs/previous-readme.md`; release history is in `RELEASE.md`.


## New server components

`api/call-config.js` validates the signed-in user before returning optional TURN configuration. `supabase/functions/luo-web-push/index.ts` authenticates its private worker bearer and uses server-only config/queue RPCs. Its gateway JWT verification is intentionally off because authentication is performed inside the function; unauthenticated requests return401. The frontend never receives VAPID private material or a service-role key.

Apply the reviewed hosted migrations in order for the suite schema. The incremental migration set is still not a verified complete backend baseline. For a fresh push setup see `scripts/provision-web-push.mjs`; do not publish any `.env*` outputs. The current hosted project is already configured.

## 15.0.1 reliability fixes

Fixed board-switch synchronization, stale archive previews, server-side dashboard filtering, and notification enable/disable/account-transition races. See `RELEASE_15_0_1.md`.

## 15.0.2 call handling

Call controls, late signaling and media operations are bound to the call that started them. Call dialogs identify the known conversation. See `RELEASE_15_0_2.md`.

## 15.1.0 design and reliability review

Responsive settings and menus, modal feedback, dialog names, keyboard focus, safer contact lookup and settings transitions. See `AUDIT_15_1.md`. Browser checks use actual frontend modules/CSS with a synthetic backend and do not exercise hosted account actions.

## 15.1.1 tools reliability

Serialized same-device folder edits, submitted-password backup snapshots, mutually exclusive export/restore, and stale tools feedback/status guards. See `RELEASE_15_1_1.md` and `verification/v15.1.1-release.json` for evidence and remaining limits.

## 15.2.0 Storage & data

Account-scoped recent text caching, explicit temporary/kept file copies, offline reopening, retention/budget controls and signout cleanup. See `STORAGE_DATA.md` for defaults, privacy limits, phone-download behavior and verification.

## 15.3.0 performance

Coalesced account/room refreshes, inactive-screen polling guards, changed-record-only device cache writes and 17 hosted foreign-key indexes. See `PERFORMANCE_15_3.md` for measurements and capacity limits.

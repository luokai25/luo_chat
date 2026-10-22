# Historical notes — superseded by the root README

Retained for reference; version counts and older instructions below are historical.

# Luo Chat 14.1.3

Attacker-oriented follow-up: checked attachment writes, stored MIME consistency and authorized recall. See `ADVERSARIAL_REVIEW.md`.

Previous security follow-up: vault metadata is immutable to clients except collection/note; story contact/circle responses are bound to their original session. There are 115 application checks plus rolled-back live database isolation suites. See `SECURITY_REVIEW.md` and `verification/v14.1.2-security.json` for the final validation status.

Google sign-in integration is built and checks provider availability before enabling the button. The live Google provider is currently disabled, so activation and real sign-in remain pending. Read `GOOGLE_SIGN_IN.md` for the exact owner configuration and validation steps. Never send client secrets or Google passwords through chat or frontend code.

Run `npm ci`, `npm test`, and `npm run build`. Read `READINESS.md` for unresolved release gates; adding Google sign-in does not clear the Safe Browsing warning.

## Previous release details

# Luo Chat 14.0.3

Security/reliability patches include stale-account response guards, missed-recall reconciliation, deadline-bound new media links, password-field cleanup, and build configuration validation. The release version is shown in Settings → Help & app.

Run `npm ci`, `npm test`, and `npm run build`. There are 99 automated checks. Builds reject privileged browser keys and Supabase origins that disagree with `vercel.json`. This validates configuration shape and policy consistency, not key authenticity or the absence of compromise.

Read `READINESS.md` and `FEATURES.md` before release claims. Google's phishing warning is unresolved; real recovery email delivery, physical-device behavior and a clean backend restore remain unverified.

## Previous release details

# Luo Chat 14

Live app: https://luo-chat-luokai25.vercel.app/

Phone-friendly touch interactions: swipe to reply; hold or tap More for actions; drag the sheet down to dismiss; pinch/drag images with accessible zoom controls. Black/gold and the supplied app icon are preserved. Customize gestures in Settings → Chats → Touch and movement.

Build: npm ci, npm test, npm run build (Node 22). Read RELEASE.md and FEATURES.md for validation scope and unfinished capabilities.

## Previous release details

# Luo Chat 13

Live app: https://luo-chat-luokai25.vercel.app/

Uses the supplied gold L icon, fixes inbox profile photos and adds reviewed reminder time suggestions and manual app update checks. Run npm ci, npm test, npm run build. Node 22, pinned dependencies and the existing Supabase backend are required. See RELEASE.md and FEATURES.md for exact scope and remaining release gates.

## Previous release details

# Luo Chat 12

Live app: https://luo-chat-luokai25.vercel.app/

Black-and-gold chat PWA using Supabase and Vercel. This release adds conversation tools, private retained vault snapshots/file copies, filtered search, private stories/circles/reactions, group tasks/events/permissions/bots/recaps, consent-based friendship memories, local media editing/stickers, audio tools, device-local offline text sending, translation capability checks, QR profile links and a password screen lock. The circular gold wordmark is preserved.

Open **Settings → Help & app → Feature checklist** for the complete capability ledger, or read FEATURES.md. Many tools are under the conversation menu and each message's actions. Translation requires explicit language-pair preparation in conversation personalization. Native translation, offline recognition and video capture differ by browser. They have no hidden cloud fallback.

## Validation and limits

49 automated checks (46 frontend/tool checks and 3 cleanup-worker checks) and the production asset build pass. Two live Supabase SQL suites pass inside rolled-back transactions with disposable fixtures: conversation security and social/group/retention permissions. These are not a substitute for authenticated physical-device tests. Hosted recovery email delivery remains unverified. End-to-end encryption, biometrics, individual linked-device inventory/revocation, topic channels and synchronized playlists are not built. Read RELEASE.md for severity-ranked gates.

## Reproduce the frontend

Use Node 22, run npm ci, npm test and npm run build. Deploy dist to the existing Vercel project. vercel.json gates deployments on tests. Dependencies are pinned in package-lock.json; icons are reproducibly rasterized from the vector logo during the build. The public Supabase project URL and publishable key are bundled in src/config.js; no service-role key is part of the frontend.

The supplied SQL migrations extend the existing live schema. A clean-room backend restore has not been demonstrated; do not assume this archive is a complete baseline migration history. Supabase cron, buckets, auth settings and Edge Function environment secrets must also be provisioned independently.

## Local private data

The service worker caches static app assets only. Separately, the browser stores the Supabase session, text drafts, pending-send fingerprints, the account-scoped text outbox, a minimal profile/conversation index, private appearance preferences and device-local sticker packs. They are not encrypted by the screen lock. Signing out clears visible content and the offline index/preferences; queued messages and drafts remain account-scoped on that device. The local draft-clearing control does not clear the outbox or stickers. Cancel queued messages explicitly from Outbox.

Server-held vault copies deliberately survive source-message expiry. Account deletion removes the account's original uploaded files; another recipient's independent saved copies remain that recipient's data. Downloaded copies and screenshots cannot be recalled.

## Prior release notes


Live application: https://luo-chat-luokai25.vercel.app/

A deployable browser chat application using the existing `luo-chat` Supabase project and Vercel. No GitHub integration is required.

## Version 11: full settings hub

Open **Settings** from the main navigation. The new searchable categories are Profile, Privacy, Chats, Notifications, Storage & data, Account, and Help & app. The black-and-gold identity and circular wordmark are preserved.

- Profile: name, username, editable About with presets and character count, change/view/remove photo, copy username and profile link.
- Privacy: existing server-backed receipt/presence controls, text size/reduced motion, blocked-person management. Profiles remain visible to signed-in users; no unsupported visibility promise is made.
- Chats: synced wallpaper (dots/plain/grid), bubble shape, automatic image previews, and focus mode. Enter-to-send is explicitly a device-local, account-scoped choice.
- Notifications: independent direct/group alerts, quiet hours in a saved IANA time zone, and device-local private preview controls. Previews are off by default. Browser permission is still opt-in and notifications require an open app tab; background push is not implemented.
- Storage & data: paginated usage totals for the user's accessible attachment metadata; account-specific local draft clearing with confirmation. Sent media are not bulk deleted.
- Account: email change request with confirmation, password recovery/update, local sign-out, revoke other refresh sessions, existing account deletion. Existing access tokens may remain valid until expiry after session revocation.
- Help & app: searchable usage help, installation/update guidance, shortcuts, and existing mark-all-read.

Appearance and notification preferences use existing owner-protected Supabase settings rows and RPCs. No new database migration is required for version 11. Cross-device changes load on the next sign-in; live settings synchronization is not implemented. Email change and recovery delivery still depend on the unresolved hosted email configuration.

Validation: 35 frontend tests; production build and static asset checks; rolled-back live SQL tests for appearance saving, notification RPCs, avatar removal RPC, and cross-user read/write isolation. Authenticated browser and physical mobile-device testing remain incomplete. No private user data were used as test fixtures.

## Version 10.1: black and gold, smoother interaction

The default appearance is restored to charcoal black and gold. Existing green/light redesign preferences do not override this release's black default; the theme switch remains optional. The app icon is a circular gold ring and outlined-font “Luo Chat” lettering on black, with 180, 192, 512 and 1024 px exports. No external font is required to render the logo.

Added private synced contacts, shared file browsing with filename/type filters and pagination, shared pinned-message controls (members pin; pin authors unpin), copy-message actions, safe external text links, shareable profile links, keyboard shortcuts, unread totals, and a jump-to-latest control. These extend the existing messaging features below.

Touch improvements include press feedback, visible keyboard focus, larger menu hit targets, outside-tap menu/dialog dismissal, a growing composer with character count, and clearer sign-in/create-account modes with matching-password validation. Browser-supported installation and explicit app-update controls are in Settings. Installed launcher icons may update later than web content because the operating system controls refresh timing.

The manifest URL stays stable, its icons use content-hashed filenames, and manifest/service-worker responses require revalidation. This fixes the observed old-icon caching problem without clearing private drafts. The app service worker still caches only static assets.

Validation: 20 frontend tests and production asset/syntax checks passed. The new contacts SQL test passed against the live database inside a rolled-back transaction (save, duplicate retries, exact lookup, self/unknown rejection, owner-only reads/removal). Additional pin-policy SQL assertions are provided but their last execution was interrupted, so they are not claimed as passed. Authenticated browser and real-device launcher update testing remain open. Hosted email configuration and actual recovery-email delivery remain release gates.

## Included

- Email/password sign-in, signup, confirmation resend, password recovery and password updates.
- Profiles, exact username lookup, profile pictures, direct conversations and groups.
- Realtime text messages with reconnect reconciliation; read markers and unread counts.
- Reply, edit and recall, older history, conversation/message search, loaded-history text export.
- Private image, audio, video, PDF and text attachments up to 50 MB; avatar uploads up to 5 MB.
- Group creation, rename, add/remove members, admin/member roles, ownership transfer and leaving.
- Device-local drafts, stable retry operation IDs, per-conversation mute, optional open-tab browser notifications.
- Password-confirmed permanent account deletion and media cleanup; other participants' conversations survive creator deletion.
- Light/dark themes, labelled controls, keyboard-accessible inbox buttons and responsive layouts.

## New in version 9

- Reactions and private saved messages, with access checked on the server.
- Single-choice polls with changeable votes and live result refresh.
- Server-side scheduled text sending, cancellation, and per-message failure isolation.
- Pinned/archived chats and inbox/unread/archive filters.
- Direct-message blocking in both directions, with group access unchanged.
- Private unread markers; turning off read receipts removes shared receipts and keeps your unread counts working.
- Typing controls, synced text sizing and reduced motion, and a multiline composer.
- Atomic attachment finalization with stable retry IDs and file-metadata checks.
- Installable mobile web app metadata and a cached offline app shell. The service worker caches only static assets, never Supabase responses or messages. Messaging and account access require a connection.
- Content-hashed JS/CSS and build verification for complete referenced assets.

Twenty version-9 core checks passed; eight extended checks then verified polls, blocking, actual background cron delivery and fixture cleanup. Evidence is in `verification/v9-core-checks.json` and `verification/extended-integration.json`. The initial scheduler fixture used an unrealistically short lead time; its replacement completed successfully. Nine frontend tests and build-asset consistency checks also pass.

## Build and deploy

Requires Node.js 22+.

```sh
npm ci
npm test
npm run build
npx vercel --prod
```

`vercel.json` specifies the build and security headers. Only `dist/` is public. The SDK is bundled locally, with exact dependency versions and a lockfile. No runtime CDN import is needed.

Optional build variables: `LUO_SUPABASE_URL` and `LUO_SUPABASE_KEY`. These must be a project URL and **publishable** key. Never put service-role keys in this frontend. For a different backend, also update the project hostname in the CSP and the avatar URL RPC.

## Backend

This release targets the existing project `byjixqwpjvsgmqilmzbm`. The incremental SQL migrations and two new Edge Functions are included under `supabase/`. These migrations have already been applied to that project. Do not re-run them blindly against production.

`supabase/schema-reference.json` is a schema-only metadata snapshot of the existing backend, including tables, constraints, functions, policies, indexes, triggers and grants. It contains no user data. It is a reference snapshot, not a tested clean-project bootstrap. The earlier project migrations predate this source package.

`luo-auth` is public at the gateway and validates origin, input and rate limits itself. `luo-delete-account` requires a valid session at the gateway and independently validates the user and password. Service keys stay inside Supabase's function environment.

## Email configuration

In Supabase Authentication → URL Configuration, set the Site URL to:

`https://luo-chat-luokai25.vercel.app`

Allow these exact redirects:

- `https://luo-chat-luokai25.vercel.app/?auth=recovery`
- `https://luo-chat-luokai25.vercel.app/?auth=confirmed`

The application handles the recovery session and one-time-link errors. Email delivery, SMTP provider settings, redirect allowlisting and receipt of real confirmation/recovery emails require separate verification. The connected database interface does not expose hosted Auth settings.

## Verification

Nine frontend tests in `npm test` exercise frontend startup, escaping hostile display names, recovery routing, cache clearing on sign-out, and retaining the same operation ID after a failed send.

The baseline fourteen live integration checks passed against three disposable accounts: sign-in, username assignment, contact lookup, idempotent send, nonmember restrictions, unread/read markers, edit, previews, group permissions, ownership transfer/exit, private storage, permanent deletion, preservation of shared conversations and fixture cleanup. Evidence: `verification/integration.json`.

`tests/integration.mjs` requires externally prepared disposable `@example.invalid` identities via `LUO_TEST_CREDENTIALS`; it intentionally deletes those test accounts. It is not part of `npm test`.

The live login screen and theme control were inspected in a cloud browser. Authenticated UI flows have frontend logic coverage and real backend integration coverage; they have not been driven end-to-end through a browser with user credentials. Automated local Chromium could not start in the build environment. For a normal machine, `npx playwright install chromium` followed by `node tests/smoke.mjs` runs the public-screen smoke checks.

## Current limits

Voice/video calls, end-to-end encryption and OS background push are not implemented. Notifications require the page to remain open. Exports contain loaded messages only. Attachments upload before their message and metadata are committed atomically. An abandoned upload can leave an unreferenced storage object; no message is published until finalization succeeds. Deletion removes uploaded media before deleting the account; if the final deletion fails, some files may already be removed and deletion must be retried. Mobile-specific layout and real email delivery need device/provider validation before a broad public launch.

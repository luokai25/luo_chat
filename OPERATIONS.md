# Luo Chat operations

Current evidence and remaining gates: [HARDENING_REPORT.md](HARDENING_REPORT.md), [STAGING.md](STAGING.md), [BACKUP_RESTORE.md](BACKUP_RESTORE.md). Run the read-only owner checks in `scripts/check-runtime-health.sql` without printing cron commands or private payloads.

## Before a release

Use Node 24. Install with `npm ci --ignore-scripts`, then run `npm run release:check`. For build-input or dependency changes, run `npm run release:reproduce` and retain its result. Run `npm run audit:production`; if the advisory service is inaccessible, record the result as unknown. Never use a stale successful result to excuse a failed current check.

The Vercel project is `prj_Ee0CVpn9S6AWrCgnYDdzXd5KlXv6` in team `team_EASiZssNiEACSbkUWxyk0W9x`. Its existing production host is `luo-chat-luokai25.vercel.app`. Use runtime 24.x, install `npm ci --ignore-scripts`, build `npm run release:check`, output `dist`. Preserve domain/security settings unless changing them is explicitly part of the task.

For database changes, first use reviewed, temporary, rolled-back fixture tests. Review RLS, column grants, privileged-function ownership/authentication, indexes and advisor output. Preserve a migration matching hosted history. Re-run affected tests after application. A passing frontend build never proves that a database migration was applied.

## Verify deployment

Require Vercel READY and a successful remote test/build log. Compare live HTML, JavaScript and service-worker bytes to the tested build. Confirm release identity and intended security headers. Test only public metadata or controlled accounts; do not inspect real users' messages to prove a deployment works.

Keep manual gates in `READINESS.md` visible: hosted email/recovery/deletion, OAuth activation/return, physical devices and fresh database restoration are separate from the automated build.

## Roll back

Use the exact last verified production deployment from `verification/v*-security.json` and promote/roll back that deployment within the same team/project. Verify READY, aliases, content hashes and headers again. Check whether the old frontend remains compatible with current database changes before promotion. Do not run a reverse migration or delete user data merely because the frontend regressed.

The 14.1.4 send fix is frontend-only and remains compatible with the 14.1.3 checked attachment/recall APIs. The vault and attachment permission restrictions should not be loosened to make an older unreviewed client work.

## Backup and restore gate — still open

Through authorized owner access, verify the provider's backup coverage, retention, last success and recovery procedure. Establish whether Storage file bytes, Auth configuration, function secrets and database schema/data need separate recovery steps. Do not assume a source ZIP or database-only backup includes all of them.

Restore into an isolated environment, not over production. Confirm the baseline, migrations, grants, RLS, extensions, functions, cron jobs and private bucket configuration. Use controlled accounts to test sign-in, recovery, messages, attachments, privacy rules and deletion. Retain timestamps and results without including secrets or private message contents in the report. No such full drill has been completed in this session.

## Incident response

For suspected unauthorized access, retain non-sensitive timestamps, affected feature/version and request IDs where available. Keep passwords, tokens, message bodies and signed media URLs out of shared logs. Identify the actual affected system before changing keys or accounts. Never publish a speculative root cause as fact.

Use the relevant provider's supported containment tools. Key rotation, session revocation and rollback each have different effects: revoking refresh sessions does not guarantee immediate invalidation of every existing access token; previously signed URLs and downloaded copies have their own lifetimes. Verify the intended containment rather than treating a successful API response as complete recovery.

For Google's reported phishing warning, use owner Security Issues findings and the existing submitted review. Do not bypass browser warnings, submit duplicate reviews, or switch domains to present the incident as cleared. Only supported official host-specific clearance evidence can establish that status, and it still does not certify application security.

## Monitoring limits

A short recent Vercel runtime query returned no error/fatal entries; this static frontend's browser failures and Supabase behavior are not covered by that query. Browser rejection logging is deliberately generic in 14.1.4. A comprehensive remote error/alert system, retention policy, incident owner and cost thresholds still need configuration. Do not collect message bodies or credentials to make monitoring convenient.

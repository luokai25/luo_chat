# Staging and release checks

The Vercel project provides protected preview deployments, and production builds run the complete automated release suite. GitHub Actions now defines an independent build/test, credential scan, production dependency audit, reproducibility check and synthetic two-peer browser call check. CI runs the browser fixtures in the runner-provided Chrome (local fixtures default to Playwright Chromium). CI uses read-only repository permissions, pinned action commits, no deployment credentials, and no hosted production test accounts.

An isolated Supabase staging backend is NOT provisioned. A branch request on 2026-10-22 returned `PaymentRequiredException: Branching is supported only on the Pro plan or above`. No plan upgrade or additional project was purchased. A protected frontend preview still points at the current configured backend; it must not be treated as an isolated database.

## Synthetic SQL lab

Neon project `luo-chat-reliability-lab` now has a separate `synthetic-lab` branch with an owner-only `reliability_lab.release_checks` table. It stores synthetic release evidence only. It does not contain Supabase Auth, Storage, Realtime, extensions, application tables or production data, and does not close the full backend-staging gate. See `integrations/neon-lab.sql` and `INTEGRATIONS.md`.

## Finish isolation

Provision a separate approved project or enable a paid development branch with agreed costs. Restore a reviewed full schema baseline, then apply and compare migrations. Use only synthetic accounts and fixtures. Disable real email/push recipients and production cron/worker credentials in staging. Give staging separate keys, bucket contents and server variables. Keep preview deployment protection enabled. Configure matching frontend/backend origins, CSP, auth redirect allowlists and function origin rules; never silently fall back to production credentials for a staging test.

## Release procedure

1. Push reviewed changes to a feature branch and require the Web reliability checks job. Browser fixtures are deliberately isolated; they do not prove hosted email or physical-device behavior.
2. Run affected rolled-back SQL tests on the authorized test backend. For additive production migrations, first run an owner-authorized transactional rollback trial, then apply the migration and repeat affected tests. Never run live-user destructive tests.
3. Verify protected preview build, changed endpoints and signed-out/signed-in navigation. Check account boundaries and retry behavior. Retain test evidence without passwords, tokens, private messages or signed URLs.
4. Release the reviewed commit. Vercel's production build must pass the full suite. Check READY, domain mapping, live HTML/assets and endpoint statuses. Keep the previous compatible deployment available for rollback.
5. Review `scripts/check-runtime-health.sql`; inspect actual worker HTTP outcomes as well as cron SQL success. A cron request enqueue succeeding does not prove an Edge Function delivered successfully.

Repository branch protection and mandatory CI enforcement depend on owner/platform configuration; the workflow file alone does not establish them. Full backend staging, provider backup verification and a restore drill remain release-readiness gaps.

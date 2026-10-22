# Connected services — 2026-10-23

Production remains on Supabase and Vercel. Connector access does not mean every provider is an active application dependency. No production messages, accounts, files or recordings were migrated into a new database.

| Service | Configuration | Verification / limit |
| --- | --- | --- |
| PostHog | First-party `/api/telemetry` forwards only fixed diagnostic codes and release metadata. | Fixed shared diagnostic identity; no person profiles, raw errors, stack traces, URLs, messages, user IDs, session replay, autocapture or browser SDK. This measures sampled reports, not users or a complete error rate. |
| Upstash Redis | `luochatreliability`, free plan, automatic upgrades disabled; server-only REST credentials in Vercel Production. | One atomic Lua command enforces 20 reports per derived IP/window and 1,000 accepted reports/day globally. Keys expire. This quota protects diagnostics only; existing database auth/message/call limits remain separate. Provider command quotas can disable diagnostics under abuse; they do not block chat. |
| Cloudflare | `luo-chat-uptime` Worker, five-minute schedule, dedicated KV namespace and bounded 288-sample history. | Checks production HTML identity and `/api/health`, which probes Supabase Auth with a 3-second deadline. Status is unknown after 15 minutes without fresh data. Does not prove message delivery, database queries, TURN/media quality, email delivery or cron workers. |
| Linear | Luo Chat web reliability project. | Tracks concrete operational follow-up; no automatic issue spam or assignments to other people. |
| Context7 | Live documentation used during implementation. | Development aid, not an application runtime dependency. |
| Resend | Draft `luo-chat-security-notice` template. | No domains verified. No real messages sent. Current authentication mail configuration is preserved. Requires a verified domain and delivery tests before use. |
| Neon | `luo-chat-reliability-lab`, `synthetic-lab` branch, `luo_lab` database, synthetic release-check table. | Owner-only evidence lab, not a Supabase staging clone or backup. No production credentials are configured in the app for this lab. |
| Amplitude | Account and empty source project verified. | Analysis connector does not expose an ingestion key. Not installed into browser alongside PostHog. Define a separate use and configure a secure key before enabling product analytics. |
| MongoDB Atlas | Account/project access verified; no clusters. | Available for future document-specific needs. Not provisioned merely to duplicate the working relational chat database. |
| Render | Workspace access verified. Public static status page prepared in `integrations/status`. | Deployment blocked by automatic approval review: publishing an auto-deploying site would grant Render repository access and requires explicit approval. No site was created. |

## Public status

`https://luo-chat-uptime.luo-chat-ops.workers.dev/status.json` returns public service availability only. It never performs arbitrary user-selected requests. CORS is public because the response contains only service names, timestamps, status and latency. Raw user traffic is not logged by the monitor. Cloudflare invocation logging is disabled; explicit degraded-check codes are retained by the platform.

The Render page reads this endpoint and clearly labels unknown/stale data. Review its source before approving publication. Worker configuration is reproducible from `integrations/cloudflare/wrangler.jsonc`; deploying requires the matching authorized Cloudflare account.

## Diagnostics configuration

Set server-only Vercel Production secrets: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `LUO_TELEMETRY_SALT`, and `LUO_POSTHOG_KEY`. Never expose Redis credentials or the HMAC salt in frontend configuration. Missing credentials disable diagnostic submission. Redis failures stop event forwarding and return a generic error; browser reporting catches failure and never blocks sign-in, chat or calls.

The browser reports each of two generic error classes at most once/page lifecycle, with an additional overall ceiling. Global Privacy Control and Do Not Track disable these reports. No persistent tracking storage is created. IPs are used only as input to a daily HMAC rate-limit key; raw IPs are not sent to PostHog, and platform IP enrichment is suppressed in event properties.

POST `/api/telemetry` accepts only the production Origin, JSON, a bounded one-field payload and an allowlisted code. `INTEGRATION_SELF_TEST` is separated into the `luo_integration_check` event so checks do not inflate actual client-error counts. Origin checking is an abuse filter, not authentication; non-browser clients can spoof it. Global ingestion and provider quotas remain necessary.

## Remaining operational gates

No external paging/email alert recipient is enabled. Fixed-code reports deliberately limit debugging detail. Provider usage, retention, command limits and free plan rules still apply; adding a resource does not guarantee free operation at every traffic level. Full Supabase staging, Storage backups, database recovery coverage and a restore drill remain open as described in `STAGING.md` and `BACKUP_RESTORE.md`.

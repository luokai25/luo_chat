# Luo Chat 15.3.0 — performance and backend capacity

Checked 21 October 2026. This release reduces confirmed repeated work and adds missing database indexes. It does not certify unlimited users or a particular requests-per-second rate.

## Confirmed improvements

| Area | Before | Implemented change and evidence |
| --- | --- | --- |
| Inbox event bursts | Each event could start a new membership query; subsequent events invalidated earlier responses after those requests had already reached the backend. | `src/refresh-gate.js`, `src/app.js`: one active refresh per account generation with a dirty flag for a fresh trailing read; each group is bounded to two passes so continuous traffic cannot keep callers waiting indefinitely. A fixture using actual app realtime handlers issued 21 initial membership requests before this patch and 2 after it. Trailing refreshes can do additional complete work; this is not a universal reduction percentage for every backend request. |
| Read receipts | Multiple events could issue simultaneous mark-read requests. | The same account/room gate serializes requests and uses the latest queued target. The server's greatest-read-through behavior remains intact. |
| Inactive-screen polling | Message reconciliation could continue while Settings was shown inside the home screen. | `src/app.js`: skip message/inbox polling outside the Chats tab. Existing realtime handling remains active. `src/workspace.js`: skip card polling while offline, hidden, or outside the active conversation screen. |
| Device storage | Every cache read/update deleted and reinserted every record for that account, including unrelated file records. | `src/device-cache.js`: only delete removed IDs and write changed row objects. Real Chromium/IndexedDB instrumentation verifies zero unrelated file-record writes while saving text. This does not prove that the browser performs zero disk reads or zero memory work; current store transactions still read the account's entries. |
| Database relationship indexes | Supabase's performance advisor reported 17 unindexed foreign keys. | Hosted migration `20261021081306_chat_scaling_foreign_key_indexes.sql`: 17 covering B-tree indexes, all confirmed valid and ready. Follow-up advisor reported zero unindexed-foreign-key findings. This improves available access paths, not a measured latency multiplier. |

## Backend migration

New indexes cover creator/owner/user/source relationships in bot rules, contacts, event attendance, file library, friendship milestones, digests, assigned tasks, living messages, story reactions, games, timeline consents, vault items and voice transcripts.

The migration uses a 3-second lock timeout and 20-second statement timeout. It completed on this small database. For a future large deployment, plan index creation with maintenance windows or a supported concurrent-index workflow. This migration does not alter RLS, grants, business data or Auth settings.

No index was dropped merely because its current usage counter was zero. The workload sample is very small; unused counters are not proof that an index is unnecessary. The follow-up performance advisor lists 55 unused indexes, including the new ones.

[Supabase foreign-key index guidance and advisor remediation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)

## Verification

- The refresh-gate unit fixture sends 200 overlapping refresh signals during an in-flight request; it performs 2 serial reads, with maximum concurrency 1. Same-turn callers share the initial read. Changes arriving during the second pass may wait for a subsequent event or the normal reconciliation timer. Account transitions cancel trailing old work; failures release the gate for retry.
- Two actual-app regression checks cover inactive Settings polling and the 21-event inbox burst. Both fail against the saved 15.2.0 application source and pass with the patch.
- Browser acceptance uses actual frontend code, real IndexedDB and a synthetic backend. It checks changed-record writes, saved Blob bytes, account isolation, temporary cleanup, signout cleanup, reload persistence, offline text/file reopening and 320/390 px layouts. It is not a hosted multi-user load test or physical-phone acceptance test.
- Release test counts, clean-build comparison, live hashes and deployment state are recorded in `verification/v15.3.0-release.json`. Browser details are in `verification/v15.3.0-browser.json`.

## Remaining capacity work

1. **No maximum concurrency is established.** The hosted message tables contain only a small sample. An isolated staging project, representative rooms/messages, several account roles and controlled load are needed to measure p50/p95 latency, errors, realtime delivery delay and database saturation. No stress traffic was sent to production.
2. **Large inbox/member pagination remains open.** `loadChatsOnce()` still uses broad membership/conversation/profile queries; response row limits and large membership lists need server-side paginated inbox/group APIs before claiming large-account/group support. Message history itself is already fetched in bounded pages.
3. **Recurring costs remain.** Active Chats still reconciles every 15 seconds and interactive cards every 10 seconds. Realtime Postgres Changes, authorization checks, unread counting and media egress consume provider resources. This release does not replace them with a complete scalable fan-out architecture.
4. **Measure database plans at representative size.** Existing message/member indexes were inspected. Full unread aggregation and authorization-heavy functions need realistic EXPLAIN/latency measurements before additional caching or summary-table changes. Shared server caches must never mix user authorization scopes.
5. **Provider quotas and infrastructure determine ceilings.** Vercel and Supabase remain the existing stack. No paid compute, replicas, external server, plan upgrade or new connector was enabled. New free servers would not automatically share this database's load.
6. **Operational visibility remains partial.** Persistent browser/Supabase monitoring, capacity alerts, backend baseline/restore, hosted recovery/deletion, strict session revocation, TURN/physical-device push/calls and official Safe Browsing clearance retain their previous open status. Existing security-advisor notices about intentional RLS-deny tables, authenticated schema/function exposure and disabled breached-password protection remain; index creation does not resolve those items.

## Rollback and compatibility

Previous production deployments remain recorded in release evidence. A frontend rollback does not require dropping the new indexes. Preserve them unless measured write/storage costs justify a reviewed rollback. The black-and-gold theme, supplied icon, cache retention choices and feature set are preserved.

### Additional advisor references

- [Unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Breached-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Production result

- Existing URL: https://luo-chat-luokai25.vercel.app/ (release metadata, not Safe Browsing clearance).
- Target production; READY; deployment `dpl_AN3mvoLh42kJAb5iRFixsdMbkfyj`; vanilla JavaScript PWA; approximately 50 seconds to ready. Source upload without Git.
- 215 tests pass locally, after a clean install and in Vercel. All 213 clean frontend outputs match. Live HTML, JavaScript, CSS and service worker match the frozen verified build by SHA-256.
- Deployment-scoped 15-minute function/daemon error/fatal log query returned zero groups. Browser/Supabase monitoring and drain configuration are not newly established.

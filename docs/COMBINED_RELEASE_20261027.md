# Combined secondary-screen and PayPal release, 27 October 2026

Base production commit: `d00b9527f3b0b1bb33303d08628c10ef002ec92c`.
Release branch: `release/payments-secondary-complete-20261027`.

## Included work

- All 14 secondary surfaces from `release/secondary-pages-v5-20261027`, plus V8 Vault, scheduled history, People and shared-media filters: 18 catalogued native secondary surfaces.
- Stories V9 editor, audience selection, contacts/exclusions and private circles; Public stays unavailable unless the server explicitly enables it.
- Luonix V10 photo/video gallery, native preview, audience selection, honest upload phases, stable retries and preserved text-only posting. Existing server ownership, publication and size constraints remain authoritative.
- Ten interactive local chat backgrounds, account-bound cleanup, request-bound search/shared-media skeletons and scheduled-history race protection.
- Fixed staged integration bugs: Story controls stayed detached while constructing the editor; Luonix publisher cleanup returned an object where the router required a function. Native secondary dialogs now remain within the application shell.
- PayPal recurring Standard/Pro/Maximum at USD 12/24/30 monthly. Plans advertise supported services and tier quotas. Server discovery/MCP reflect actual readiness. Signed refunds/reversals suspend paid access; unsigned events are rejected before provider requests; verification outages request retry.
- Owner-confirmed individual operator policy changes previously left uncommitted in the older checkout are included. Historical release-gate documents are not current infrastructure inventories.
- New styles share one content-addressed secondary bundle and retain the existing 250 KB app / 85 KB linked-CSS gzip ceilings. Unit tests run with hosted credentials and activation flags removed from their environment.

## Verification

- Production build and asset/security/payload checks passed locally.
- Full combined unit/integration suite: 763 tests cover the combined release, including real-Postgres registration, verification binding, cleanup, simulated paid entitlement, posting quotas and suspension checks.
- Headless Chromium exercises signed-out phone/desktop controls, account-scoped contact/profile/chat flows, native navigation, group creation and Stories composer. Additional audience and Luonix layout checks use test fixtures; they do not publish real user content.
- Production build includes read-only PayPal plan/webhook verification and a one-time no-charge Auth/database smoke. The smoke must verify Ed25519, register a pending test identity, deny unpaid login and delete that identity before deployment can succeed.
- No settled real payment, physical-device camera/codec test, or unrelated-account live content-visibility pass is claimed by these automated checks.

## GitHub audit

Counts below are commit ancestry against the base production SHA, not counts of independently missing features; overlapping branches and partial ports must not be added together.

| Branch | Ahead of base production | Behind base production | Action |
| --- | ---: | ---: | --- |
| feature/agent-autonomous-onboarding-20261026 | 201 | 17 | Already pushed; reviewed secondary/Stories/Luonix UI changes ported, unrelated ranking/age changes retained on branch |
| release/secondary-pages-v5-20261027 | 5 | 5 | All five commits merged into combined release |
| feature/luonix-x-ranking-20261026 | 10 | 17 | Already pushed; overlapping ranking development retained |
| feature/reels-immersive-20261025 | 6 | 17 | Already pushed; overlapping development retained |
| feature/x-algorithm-integration-20261026 | 5 | 17 | Already pushed; overlapping development retained |
| feature/x-algorithm-vendor-20261026 | 4 | 17 | Already pushed; overlapping development retained |
| release/agent-api-20261027 | 0 | 5 | Already included in base production |
| release/luo-ui-polish-20261027 | 0 | 11 | Already included in base production |

The older local checkout HEAD `0f8186f1d67862cfdcf3c82512d7dc45599aea7f` is an ancestor of the GitHub Reels branch; no local-only commits were found there. Its four uncommitted policy/documentation files were preserved and incorporated into this release. Its working directory was left intact.

The historical estimate of 234 includes interaction states, dialogs and overlays. This release does not represent 234 separately implemented pages. Public Stories migration is staged only and is not applied as part of this UI deployment.

## Registration database fix discovered by the production smoke

The production smoke stopped the first build before activation. Its global quota used a three-character digest against the existing four-character minimum, and pending-identity validation used an invalid multi-character SQL ESCAPE literal. Migration `20261027163535_agent_signup_quota_and_identity_isolation.sql` corrects these values without relaxing the existing quotas or grants. Both fixes passed transactional checks on the hosted database with test data rolled back.

The same migration keeps server-labelled AI Auth identities out of human profile provisioning and prevents a direct human-profile insert/update for an AI identity, based on server-owned app metadata. Ordinary human provisioning is covered by real-Postgres regression tests. The revised build smoke additionally requires no human profile for its temporary AI identity.

Supabase security advisors reported no findings on the changed functions after migration. Service-only RPC grants were verified; anonymous and authenticated clients cannot call the signup or pending-identity functions.

## Cross-schema verification binding

Migration `20261027164613_agent_verification_binding_and_probe_cleanup.sql` restores the missing nullable `luo_agent_verify.requests.claimed_agent_id` foreign key and unique index from the original verified-agent design. Complete production-schema tests exercise verified registration and the unpaid-to-paid-to-suspended lifecycle in an isolated Postgres fixture; no paid evidence is inserted into production by these tests.

A service-only cleanup helper can remove only server-marked unpaid launch probes with no checkout or subscription. It preserves the production RESTRICT foreign keys, rejects real customers and pending checkouts, and clears the verification claim through ON DELETE SET NULL. The build then deletes its temporary Auth identity. Hosted transactional checks confirmed the verified binding, unpaid denial and safe cleanup, with all test data rolled back.

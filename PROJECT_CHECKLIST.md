# Luo Chat engineering checklist — 15.1.0

Reviewed 2026-10-21. This is a practical checklist of commonly missed application work, applied to Luo Chat; it is not a claim that every possible defect can be enumerated. **Pass** means the stated check passed, not the entire category is certified. **Open** and **Partial** items must not be advertised as complete.

## Build, configuration and delivery

| Often forgotten | Luo Chat status and evidence | Remaining action |
| --- | --- | --- |
| Supported runtime | Fixed: Node 24 required by `scripts/check-release.mjs`; package engines and `.nvmrc` document it. | Vercel manages its patch level; update the recorded tested patch deliberately. |
| Exact dependency versions and lockfile | Pass: pinned packages and `package-lock.json`; release command checks version agreement. | Review dependency updates and repeat checks. |
| Dependency installation hooks | Pass: clean install works with `--ignore-scripts`; use that tested command on Vercel. | Do not enable new lifecycle scripts without review. |
| Build reproducibility | Pass: `release:reproduce` compares every production output after a clean lockfile install. | This proves the checked frontend build, not every OS/runtime or backend restoration. |
| Production release gate | Fixed: `npm run release:check` runs version/runtime checks, tests and build validation; Vercel uses it. | Keep backend/device gates separate; do not treat this as a public-launch approval. |
| Environment consistency | Pass: `scripts/public-config.mjs` rejects privileged frontend keys and CSP/backend-origin mismatches. | Hosted Auth/provider settings still require owner configuration. |
| Secret separation | Pass in reviewed source: public browser key only; server functions read hosted secrets. | Rotation history and all external account permissions are not fully audited. |
| Asset versioning and PWA updates | Pass: hashed assets/icons, stable manifest identity and service-worker references are checked. | Installed icon/update behavior still needs physical-device testing. |
| Rollback | Documented in `OPERATIONS.md`; prior deployment IDs retained in release evidence. | Rehearse rollback in an isolated environment; do not blindly reverse data migrations. |
| Backend starting schema | Open, P1: incremental migrations do not represent a verified complete baseline. | Capture/review a baseline and prove a fresh isolated restore before claiming backend reproducibility. |

## Authentication, authorization and privacy

| Often forgotten | Luo Chat status and evidence | Remaining action |
| --- | --- | --- |
| Server authorization instead of hidden buttons | Pass in targeted SQL suites: RLS and checked RPCs enforce membership/ownership. | Continue testing new tables, operations and account transitions. |
| Cross-user ID access | Pass in fixture tests: private vaults, transcripts, settings, stories, search and attachments reject outsiders. | Authenticated HTTP end-to-end tests with controlled accounts remain incomplete. |
| Privileged function permissions | Pass: targeted functions deny anonymous execution; recall has explicit sender/membership checks. | Authenticated callable privileged functions remain an audit surface. |
| Direct API bypasses | Fixed previously: attachment metadata writes require checked RPCs; vault metadata updates are narrowed to note/collection. | Do not reopen table-wide grants for UI convenience. |
| Upload ownership and metadata | Pass: path, owner, size, checksum and stored MIME metadata checked. | Metadata validation is not file-content scanning or malware detection. |
| Stale async account work | Fixed in this release: send preparation, dispatch, responses, error paths and controls are bound to the original account generation. Four new regressions reproduce/cover the race. | An already dispatched server mutation cannot be cancelled by clearing UI state. |
| Recovery and email verification | Partial: validated recovery-state and stale-form guards tested. | Real email delivery, redirects, expired/one-use links and hosted SMTP remain P1 manual gates. |
| Google sign-in | Integration built, provider disabled. | Owner OAuth configuration and real consent/PWA return testing required. |
| Breached passwords and MFA | Open: leaked-password protection disabled; MFA not implemented in the app. | Review/enable hosted protection and design/test MFA before claiming it. |
| Logout and session revocation | Partial: UI/session cleanup and other-refresh-session revocation exist. | Valid access tokens can survive until expiry; instant revocation across all paths is not implemented. |
| Account deletion | Partial: confirmation, reauthentication and media cleanup paths exist. | Real end-to-end deletion, concurrent activity and recovery from partial cleanup need controlled-account testing. |
| Media URL lifetime | Partial: new links are bounded; recall blocks fresh access in tests. | Previously issued bearer URLs last until expiry; downloaded copies remain with recipients. |
| Local device data | Account-scoped drafts/outbox/preferences are documented. | They are not encrypted; screen lock is not a cryptographic boundary. |
| Encryption claims | Honest status: no end-to-end encryption. | Do not advertise E2EE; its protocol, key lifecycle and multi-device recovery need a separate design and review. |
| Notifications | Private previews default off; notification preferences and ownership tested. | Physical-device delivery, permission denial and OS behavior require acceptance checks. |
| Sensitive logs | Fixed: unhandled rejection objects are no longer dumped to console; generic diagnostic codes are used. | No comprehensive browser exception monitoring or log-redaction audit of every provider is established. |
| Public profile scope | Usernames/display names/bios/avatars are intentionally public to the configured audience. | A public profile is different from private chats; document this accurately. |

## Functional correctness and user experience

| Often forgotten | Luo Chat status and evidence | Remaining action |
| --- | --- | --- |
| Duplicate submissions and retries | Pass in targeted tests: stable operation IDs, retry behavior, poll/game version controls. | Real transport-loss tests and every feature's concurrency behavior are not fully covered. |
| Loading, empty, error and retry states | Present and tested for core flows. | Not every optional feature has full browser/network acceptance coverage. |
| Offline queue | Explicit text sends are queued and account-scoped; failed work is retained. | Browser storage is plaintext; this is not guaranteed background delivery while closed. |
| Search and recalled/expired content | Pass in recent regressions: stale results cancelled, originals revalidated, missed recalls reconciled. | Screenshots and independent vault/download copies cannot be recalled. |
| Time zones and timestamps | UTC instants/local display, calendar validation and DST quiet-hour tests exist. | Test additional locale/device combinations; an English UI is not full internationalization. |
| Accessibility basics | New tests check all static control/button names, duplicate IDs and ARIA references. | Screen readers, focus behavior, contrast, touch targets and reduced motion need real-browser/device review. |
| Arabic/RTL and localization | Message content supports direction handling; translation is browser-dependent. | Full localized UI/RTL acceptance is incomplete. |
| Media budgets | Size/type limits and bounded audio/text analysis exist. | Real codecs, malformed files, video trimming and memory pressure need device testing. |
| PWA install, updates and stale caches | Automated asset/offline-shell checks pass. | OS-installed icons and account-specific offline behavior need physical devices. |
| Performance | Current app bundle is approximately 454 KB before transport compression. | No established performance budget or measured low-end-device startup baseline. |
| Features honestly labelled | `FEATURES.md` separates complete, partial and missing capabilities. | Do not replace missing functionality with enabled-looking controls or success messages. |

## Operations and release responsibility

| Often forgotten | Luo Chat status and evidence | Remaining action |
| --- | --- | --- |
| Backups and restore drills | Open, P1: no successful full backup/restore drill is evidenced. | Owner must verify backup coverage/retention and rehearse restoration in isolation. |
| Monitoring and alerts | A recent 15-minute Vercel error/fatal runtime query returned no entries. | Static hosting logs do not cover browser or Supabase errors; persistent alerts and useful retention are not established. |
| Rate limits, bots and denial of service | Auth wrapper limits and group bot limits exist. | Direct Auth limits, CAPTCHA configuration and trusted-IP provenance remain unverified; no load attack was run. |
| Cleanup and retention | Scheduled cleanup implementation and fixture tests exist. | Audit abandoned/uncommitted uploads, queue age and physical deletion operationally. |
| Privacy notice, terms and support | Technical data behavior is documented in source. | Owner-reviewed public policies, controller/support details and applicable requirements are not established here. |
| Costs, quotas and failure budgets | Upload/analysis caps exist. | Owner should set provider spend/usage alerts and incident contacts; no paid service was enabled. |
| Dependency advisories | Production dependency audit previously returned zero known vulnerabilities; repeat with `audit:production`. | Advisory lookup failure is unknown, not clean. |
| Security incident response | `OPERATIONS.md` defines evidence, containment and recovery steps. | Google's phishing warning remains P0 until officially cleared and checked in Chrome. |
| Release evidence | Version, test results, clean-build comparison and live asset checks are retained in `verification`. | Evidence expires as code, settings and dependencies change. |

## Priority order for the remaining work

1. P0: resolve the reported phishing warning using official owner findings and supported clearance evidence.
2. P1: verify hosted account recovery/deletion, enable available breached-password protection, and demonstrate a backend backup/restore.
3. P1: controlled-account HTTP/device acceptance, session-revocation design and accurate public privacy/support information.
4. P2: comprehensive monitoring, direct-API abuse controls, abandoned-upload cleanup, performance budgets and broader accessibility/localization checks.
5. Separate major security projects: E2EE and malware scanning. These cannot be truthfully marked complete by small UI patches.

## Verified 14.1.4 release

Production deployment `dpl_BSYSuX5RorpXFRnT7q9H5CExZxNg` is READY. All 122 checks passed locally, after a clean dependency install and in the Vercel build. All 13 clean production outputs matched the working build; live HTML, JavaScript and service worker matched the tested build by SHA-256. See `verification/v14.1.4-release.json`. The open gates above remain open.

## Verified 14.2.0 sticker release

Production deployment `dpl_FQLGRS734MMWce1284S4PPTa2nr5` is READY. All 127 tests passed locally, after a clean lockfile install, and during Vercel deployment. All 213 production files match byte for byte after the clean install. Live HTML, JavaScript, service worker, and every one of the 200 sticker PNGs matched the tested build (203 live hash checks). See `verification/v14.2.0-stickers.json` and `STICKERS.md`.

Added original Luo Family artwork (200 transparent stickers, 20 moods), a mobile tray, search, favorites, recents, preview, personal photo creation shortcut, explicit sticker staging and transparent chat display. No new backend grants or schema changes. `luochat.mooo.com` remains blocked by the missing FreeDNS TXT ownership challenge. This release is not evidence that Google's phishing warning is cleared. Physical phone acceptance and an actual two-account hosted sticker send are still unverified. All previously open gates remain open.

## Verified 14.3.1 device access release

Production deployment `dpl_8PYfGsrFSuMXX3rfRKJ3DAGymiY2` is READY. All 138 tests passed locally, after a clean install, and in Vercel. All 213 clean production outputs matched byte for byte. Live HTML, app JavaScript, CSS and service worker match the tested build. The live policy is `camera=(self), microphone=(self), geolocation=()`. See `DEVICE_ACCESS.md` and `verification/v14.3.1-device-access.json`.

Added Device access settings, action-triggered permission explanations, camera photo capture, microphone voice-note recording/review, blocked-permission recovery help and selected-file guidance. Access stays optional; text chat does not require it. Capture stops on close, signout and backgrounding, and late grants cannot restore an old session. Captured attachments still require Add to message and Send. Mobile notifications now prefer the service worker, with account/session checks and signout cleanup. No closed-app push or native APK permission manifest was added. Real-device OS prompt/media acceptance and real hosted two-account capture sends remain unverified. The existing domain and Safe Browsing gates remain open.

## 15.0.0 feature implementation and validation

The 15 requested areas are implemented with the limits in `RELEASE_15.md`. The frontend clean-install build is reproducible. Hosted rollback-fixture suites cover owner document/subscription isolation, worker secret privilege denial, endpoint SSRF rejection, board member/block/announcement/archive rules, call participant checks and signaling cleanup, album checked upload/idempotency/order/hijack rejection, push message/call enqueue, mute filtering and unsubscribe cascade. No real user content was read for these tests and no real push notification was sent.

All new public tables have RLS, public anonymous SECURITY DEFINER execution remains0, and worker config/claim/ack routines are service-role-only. Existing GraphQL/authenticated function exposure notices and leaked-password protection configuration remain reviewed/open as before. Call TURN provisioning, physical-device/assistive-technology acceptance, actual closed-app push and two-device media acceptance remain open. The selected-chat encrypted text snapshot is separate from a full database/media disaster-recovery backup; that previous P1 gate remains open. Browser Safe Browsing clearance and custom-domain ownership are unchanged.


## Verified 15.0.0 production release

Production deployment `dpl_2G34jFELaQezEBbSUu3ozXLNAump` is READY. All 159 checks passed locally, after a clean lockfile install, and in Vercel. All 213 production outputs matched after the clean install; live HTML, app JavaScript, CSS, and service worker hashes matched the tested build. See `verification/v15.0.0-release.json` and `RELEASE_15.md`.

The 15 feature areas are implemented with their limits documented in the release guide. Hosted rollback fixture suites passed for suite ownership/access, album authorization and retry, push queue permissions, and attachment hardening. No real user content was read and no real push was sent in those fixtures. Production dependency audits reported zero known vulnerabilities in the frontend production packages and pinned push-function package fixture. This does not certify the full Deno runtime or imply no unknown vulnerabilities.

Still open: TURN relay and two-device/physical-device acceptance for calls; real closed-app push delivery; complete screen-reader/device accessibility review; full database/media backup and restore; hosted auth-provider and recovery acceptance; Google Safe Browsing clearance; and the existing session revocation, account deletion and leaked-password-protection gates.


## Verified 15.0.1 reliability patch

Production `dpl_4eEWDsrjo3Nga7maspZfQRRaaMza` is READY. All 170 tests pass locally, after a clean lockfile install and in Vercel; all 213 frontend production outputs match after a clean install. Live HTML/app/CSS/SW hashes match. Nine regression checks fail against the saved 15.0.0 source and pass with these fixes. See `RELEASE_15_0_1.md` and `verification/v15.0.1-release.json`.

Fixed drawing-board loading/save races, stale import previews, dashboard filtering before query limits and Web Push subscription transitions. No schema, account/provider, domain, relay or worker configuration changed; existing acceptance/security gates remain open.


## Verified 15.0.2 call handling patch

Production `dpl_9kFUxVinHaUjJzik4i7e32n8FTWr` is READY. All 177 tests pass locally, after a clean install and in Vercel; all 213 clean frontend outputs match byte for byte. Seven new call lifecycle/recipient tests fail against the previous source and pass here. See `RELEASE_15_0_2.md` and `verification/v15.0.2-release.json`. External TURN, two-device/physical-device acceptance and previously open security gates remain open.


## 15.1.0 bug and design review

189 local/clean application tests pass, and 213 clean frontend outputs match. Browser review covers 42 views across four widths with a synthetic backend; final runs report no page errors or unintended clipping. Axe checks on three surfaces report zero selected WCAG/best-practice findings. Production dependency audit reports zero known vulnerabilities. See `AUDIT_15_1.md`; hosted accounts, physical devices, complete accessibility and previous security/restore gates remain open.

## 15.1.1 tools reliability

Six new regression tests cover same-device folder write ordering, queued-write cancellation on signout, backup password capture, export/restore exclusion, delayed notification status and stale tools errors. Multi-device folder conflict resolution and partial restore recovery remain open. See `RELEASE_15_1_1.md`.

## 15.2.0 device storage

Added account-scoped IndexedDB caching, user-controlled text retention and byte budgets, explicit temporary/kept media copies, offline text/file reopening, signout cleanup and browser persistence request. Local copies are readable device data and remote access changes cannot be learned while offline. Browser evidence uses real IndexedDB plus a synthetic backend; physical phone/PWA acceptance remains open. See `STORAGE_DATA.md`.

## 15.3.0 capacity work

Added account/room refresh coalescing, active-screen polling guards, selective IndexedDB writes and 17 hosted FK indexes (all valid/ready, zero remaining unindexed-FK advisor findings). No production load test or maximum user capacity is established. Large inbox/member pagination and provider/monitoring/restore gates remain open. See `PERFORMANCE_15_3.md`.

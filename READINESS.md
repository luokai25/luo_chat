# Luo Chat release readiness — 14.1.4

Status: **not cleared for a general public release** while Chrome's phishing warning and the verification items below remain unresolved.

## Confirmed defects fixed in this release

| Severity | Reproduction / defect | Fix and files |
|---|---|---|
| High | Delay a sign-in profile response, sign out, then release the response: the old account UI reappeared. | Account generations and request guards in `src/app.js`; delayed-response tests in `tests/ui.test.mjs`. |
| High | Miss a recall event, then reconnect: server access rules hide the recalled row, so the old reconciliation never removed its DOM copy. | Batched revalidation of loaded IDs and quote/reply sources in `src/app.js`; regression tests cover unavailable messages and retained older history. |
| Medium | Sign out with private search results/account labels still in hidden views. | Central account teardown and identity/avatar cleanup in `src/app.js`; signout regression. |
| Medium | Issue a 600-second media link for a message that disappears sooner; viewer remains open at expiry. | Deadline-bound new links, viewer expiry and reconciliation checks in `src/media.js` and preview path in `src/app.js`; `tests/media-privacy.test.mjs`. Previously issued links remain bounded by their original lifetime. |
| Low | Move past the swipe threshold, return to the start before lifting: Reply was still selected. | Use final pointer coordinates in `src/interactions.js`; regression in `tests/interactions.test.mjs`. |

14.0.1 separately fixed unvalidated recovery URL entry, stale password-change forms and hidden password-field retention. Neither release establishes the cause of Google's phishing classification.

## Open release blockers and verification gaps

| Priority | Status | Required next step |
|---|---|---|
| P0 | Chrome reports phishing on the main domain; cause unconfirmed. Google's public review form accepted the report. Public status recheck was inaccessible. | Obtain Search Console Security issues findings through owner access, fix any listed issue, then verify official clearance and Chrome behavior. Do not bypass the warning or resubmit duplicate reviews. |
| P1 | Hosted recovery email delivery/redirects not tested end-to-end. | On a controlled account, test request, email receipt, one-use link, password update and expired-link rejection. Current automated tests mock the auth service. |
| P1 | Physical phone/native capability validation not completed. | Test installed PWA update, touch cancellation/scrolling, keyboard/screen reader, camera/external QR, codec and browser-dependent translation/transcription on actual devices. |
| P1 | A clean-room database restore from this source archive has not been demonstrated; the existing project's baseline schema is not fully represented by the release migrations. | Capture a reviewed baseline schema and verify a fresh restore plus all migrations before claiming deployment reproducibility for another project. |
| P1 | Earlier Supabase advisory reported leaked-password protection disabled. | Review availability and enable it in hosted Auth settings where supported; confirm configuration. The available connector does not expose Auth configuration updates. |
| P2 | Configuration mismatch is now a build error; switching projects still requires coordinated configuration. | Update `src/config.js`/build variables and `vercel.json` origins together. Build guards reject privileged keys and mismatched origins before producing assets; live credentials still require runtime verification. |

## Requested capabilities still incomplete

See `FEATURES.md` for exact scopes. End-to-end encryption, biometrics, individual-device inventory/revocation, true topic channels and synchronized playlists are not built. Other tools are explicitly partial or browser dependent. No release claim should imply that every requested feature or all possible bugs are finished.

## Current validation

14.1.4 passes 122 automated application checks. The clean lockfile installation and build produced 13 byte-identical production files. `PROJECT_CHECKLIST.md` separates these verified checks from hosted Auth, database restore and real-device gates. Final deployment evidence is in `verification/v14.1.4-release.json`.

## Historical validation

14.1.0 passed all 107 checks locally and in the Vercel production build. On 2026-10-21, live HTML, service worker and application JavaScript matched the local production build by SHA-256. Public Supabase settings still reported Google disabled; actual Google consent and sign-in remain unverified. See `verification/v14.1.0-release.json`. Tests cover the stated behaviors and do not prove absence of compromise. No credentials or account contents are included in this report.

14.0.3 adds `scripts/public-config.mjs` and `tests/public-config.test.mjs` to prevent invalid or privileged public build inputs. Release identity is embedded in HTML and the Help panel.

## Google sign-in activation blocker

Live provider settings report Google disabled. The application integration is built; Google Cloud OAuth client registration, Supabase provider secrets/redirect configuration and actual consent/return flows are not verified. See `GOOGLE_SIGN_IN.md`. No Google passwords belong in Luo Chat fields.

## 14.1.1 security follow-up

Fixed delayed unified-search responses surviving panel close or a signout/signin cycle, and cached results restoring unavailable original messages. Six regression checks were added (113 total). See `SECURITY_REVIEW.md` for evidence and limits.

14.1.2 adds vault column privileges and story session guards; the applied migration and rolled-back access checks are described in `SECURITY_REVIEW.md`.

14.1.3 closes the direct attachment metadata path, validates stored MIME and fixes authorized recall. `ADVERSARIAL_REVIEW.md` distinguishes tests passed from remaining token, file-content and Auth configuration risks.

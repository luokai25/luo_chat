# 15.3.0 — performance and backend capacity

See `PERFORMANCE_15_3.md` and `verification/v15.3.0-release.json` for event-burst coalescing, device storage writes and backend index evidence.

# 15.2.0 — Storage & data

Recent text caching, temporary/kept file choices, offline views and device cleanup controls. Includes 15.1.1 reliability fixes. See `STORAGE_DATA.md` and `verification/v15.2.0-release.json`.

# 15.1.1 — tools reliability

See `RELEASE_15_1_1.md` for folder write ordering, backup password/operation fixes and stale feedback guards. Deployment evidence: `verification/v15.1.1-release.json`. Previous launch/security gates remain open.

# 15.1.0 — responsive design and session-safe settings

Fixes mobile settings/menu clipping, modal feedback/names, settings snapshots/session races, contact lookup races and stale realtime status. Adds a repeatable synthetic-backend browser audit. See `AUDIT_15_1.md`.

# 15.0.2 — call lifecycle and recipient clarity

Fixes incoming error controls, delayed decline, interrupted camera switching, stale signaling and SDP work, screen-lock cleanup and conversation-bound Start. All 177 local and clean-install tests pass; 213 frontend outputs match after a clean install. See `RELEASE_15_0_2.md`.

# 15.0.1 — drawing, import, dashboard and push reliability

Fixed four confirmed defect areas with regression checks. All 170 tests pass locally and after a clean install; all 213 frontend outputs match. See `RELEASE_15_0_1.md` and `verification/v15.0.1-release.json`. No database schema or service configuration changed.

# 14.1.4 — release discipline and session-bound sends

Fixed send preparation continuing after signout/account change; completion/error/finally paths no longer change another session's state. Added four regressions. Generic rejection diagnostics no longer dump arbitrary error objects. Added static accessibility/ID checks and a label for the hidden attachment picker (122 application checks total).

Added a Node-24 release gate and clean-install reproducibility command; all 13 production files matched byte-for-byte in the clean install. Dependency install hooks were disabled in the verified clean workflow. `PROJECT_CHECKLIST.md` and `OPERATIONS.md` record remaining release gates, backup/restore, incident and rollback procedures. No database or Auth configuration was changed by this release.

# 14.1.3 — checked attachments and working authorized recall

Client attachment metadata writes now require the checked upload RPC, which also validates stored MIME metadata. Fixed the server recall operation while preserving sender/membership authorization and denying peer/outsider recall. New rolled-back adversarial SQL tests pass alongside the existing access suites and 115 application checks. See `ADVERSARIAL_REVIEW.md`.

# 14.1.2 — vault integrity and story session privacy

Restricts client vault updates to collection/note, retaining server-checked creation and owner-only access. Stops delayed story contact/circle data and composer continuations across session changes. Two new regression tests bring the suite to 115; live rolled-back vault isolation and existing social access suites pass. See `SECURITY_REVIEW.md` for scope and unresolved risks.

# 14.1.1 — search privacy hardening

- Search responses and errors are invalidated when search closes or a session ends, including signing back into the same account.
- Opening a cached search/vault/map result now fetches the original message under current server permissions, checks recall/expiry and uses current text. Context loading is bound to the active account and room request.
- Removed the obsolete search implementation that the unified search handler replaced.
- Added `Cross-Origin-Opener-Policy: same-origin` and disabled speculative DNS prefetch. Google sign-in remains a full-page redirect; a real provider return remains unverified because Google is disabled.
- All 113 automated checks and production build pass locally. Production verification is recorded separately.
- Existing SQL access suites passed in rolled-back live transactions. No persistent database changes or new security products were installed.
- Google Safe Browsing clearance, leaked-password protection and Google OAuth activation remain open.

# 14.1.0 — Google sign-in integration (2026-10-21)

- Add Continue with Google to sign-in and account-creation screens, preserving the black-and-gold theme.
- Read the provider's public availability; leave the button disabled while Google is disabled, with a retry path for failed availability checks.
- Start the existing Supabase browser OAuth flow with only identity scopes, an account chooser and a fixed same-origin return path. Validate the Supabase authorization URL before navigation.
- Clear local password inputs before leaving; restore controls after cancellation/back navigation; ignore stale OAuth responses after session reset. Callback errors use generic text and are removed from the URL.
- Explain Luo Chat password requirements for screen locking and deletion to Google-only users.
- Seven focused OAuth tests plus one application integration test added (107 total). A rolled-back live database test confirmed profile/default-settings creation for Google metadata. This does not verify Google's actual consent/token exchange.
- Activation blocked: live Supabase reports Google disabled. Google Cloud client registration and Supabase provider/redirect configuration require owner setup; see GOOGLE_SIGN_IN.md. No provider secrets were read or changed. No account passwords or schema changed.
- The Safe Browsing phishing warning remains unresolved and is not fixed by adding Google sign-in.

# 14.0.3 — release configuration safeguards (2026-10-21)

- Stop the build before overwriting valid assets if the public Supabase URL is invalid or disagrees with the HTTPS/realtime/media/frame origins in the deployed CSP.
- Accept publishable keys and legacy anon keys; reject secret, service-role and user-session keys before bundling. The check classifies key types; the backend still validates key authenticity at runtime. Error messages do not echo keys.
- Add the release version to Settings → Help & app and HTML metadata, verified during production asset checks.
- Seven configuration regressions added (99 tests total), including subprocess checks that the actual build rejects invalid input without replacing a prior asset build.
- No database changes, account password changes, or icon/theme changes. This is not a confirmed fix for Google's phishing flag, which remains an open release blocker.

# 14.0.2 — account isolation and disappearing media (2026-10-20)

- Invalidate pending account loads, inbox queries and room queries on signout/account switch. Old responses cannot restore the previous account UI.
- Centralize signout cleanup, remove realtime subscriptions, clear search results, private identity labels and avatar references.
- Revalidate loaded message IDs and reply sources against server access rules after reconnect. Remove recalled/inaccessible rows even if their realtime update was missed; clear unavailable reply targets.
- Preserve fetched ordering when reconciling and mark read through the newest message. Revalidate older loaded messages by ID rather than assuming everything absent from the newest page was recalled.
- Cap newly issued media URLs by the known message deadline. Close media at expiry or after reconciliation detects recall; retained vault copies remain independent. Previously issued links and external copies cannot be retrospectively revoked by this UI patch.
- Cancel swipe-to-reply when the pointer returns to its start before release.
- 12 regression tests added since 14.0.1 (92 total). Auth tests use controlled mocks; physical devices and hosted recovery emails remain unverified.
- No schema changes or account password changes. Google Safe Browsing phishing classification remains unresolved; these code fixes are not a confirmed root-cause remediation for that flag.

# 14.0.1 — authentication hardening (2026-10-20)

- Ignore unvalidated `?auth=recovery` and `#type=recovery` hints. Open recovery only after a Supabase `PASSWORD_RECOVERY` event with a session, or an explicit action in account settings.
- Verify the current account before submitting a password change. Reject stale forms after cancellation, signout, or account switching.
- Clear password inputs after successful sign-in/sign-up, completed password changes, cancellation, and signout. Restore masked input display.
- Clarify that Luo Chat asks for its own account password, never a Google/email-account password. Tell visitors to respect browser security warnings.
- Six new regression tests reproduced the defects against 14.0.0; all 80 tests pass with this patch. These are UI/auth-flow defects, not proof of unauthorized password changes or account compromise.
- No database or Edge Function changes. No existing account passwords changed.
- Google Safe Browsing report was submitted successfully. Its phishing classification remains unresolved. These fixes are not an identified root-cause fix for that classification. Hosted recovery email delivery and physical-device flows remain unverified.

# Luo Chat 14 — touch and movement

Released October 21, 2026. Keeps the black/gold theme and supplied gold L icon.

- Swipe a message sideways at least 64 px to select Reply. It never sends a message. Vertical movement, short movement, scrolling, pointer cancellation and a second finger cancel a pending hold.
- Hold for 450 ms, tap More, right-click a message or use Shift+F10 to open an accessible action sheet. The sheet forwards actions to existing handlers rather than duplicating mutations. Choosing a reaction, save, recall, quote, vault or other action remains explicit. Recall retains its existing confirmation.
- Larger reaction targets, a message preview, a drag-down dismissal handle and less clutter on small screens. Select text in the sheet retains browser selection/copy and sentence quote workflows. Links, image elements, media controls and editable fields are excluded from message gestures.
- Settings → Chats → Touch and movement controls account-scoped device preferences. Gesture input defaults on; vibration defaults off and works only where supported. Reduced-motion preferences suppress transitions. Ordinary message scrolling and page pinch zoom outside the image frame remain browser-native.
- Media viewer images support two-finger zoom up to 5×, one-finger/mouse panning, double-click zoom, Fit image, Zoom in/out and keyboard +/-/0/arrows. Pan bounds keep the image in its frame. Pointer capture and pinch handling are contained within the image frame.

Files: src/interactions.js, src/image-gestures.js, src/app.js, src/media.js and public/style.css. No database migration, new privilege or server credential was needed. Existing server authorization remains authoritative. The action sheet clears on close, signout, room changes, source removal and backgrounding; expired or account-switched actions are rejected before forwarding.

Validation: 74 automated checks and the production asset build pass. New tests cover deliberate reply swipes, cancelled/short/vertical gestures, hold/tap/keyboard menus, private content cleanup, stale or expired actions, account-scoped preferences, selecting text, action-sheet integration with real reply/save handlers, pinch/pan bounds, zoom buttons and keyboard input. Tests simulate pointer events in JSDOM, not a physical touchscreen. Authenticated real-device scrolling, native text selection/callout timing, modal focus behavior and OS gesture interference still require device testing. Full WCAG conformance is not claimed.

## Previous release notes

# Luo Chat 13 — supplied icon, consistent profiles and reminder suggestions

Released October 21, 2026. Uses the user's supplied gold L artwork rather than the previous circular wordmark. The source artwork is embedded unchanged inside the icon SVG; standard icons use tighter framing, while the separate maskable icon retains safe black padding. Generated sizes are 32, 180, 192, 512 and 1024, plus maskable 512. Favicon, Apple home-screen, app manifest, header, login screen and installation preview use this artwork.

The manifest identity and URL remain stable so existing installations keep the same identity. Asset URLs change with their contents. Browser/OS restrictions mean existing launcher icons cannot be forced to change universally. Settings → Help & app now includes Check for updates and explicit icon-refresh guidance. This checks service-worker code updates, not a privileged OS launcher operation. Reinstalling may clear device-local queues/drafts/stickers; do not suggest it before the user has preserved them. References: https://web.dev/articles/manifest-updates and https://web.dev/learn/pwa/update.

Confirmed defect fixed: src/app.js fetched avatar_url/profile_frame but the inbox render always wrote initials. New src/avatars.js renders the same trusted photo/frame in the inbox and room header, falls back to initials on image failure, respects private custom chat icons, and prevents group identities from borrowing a member's photo. Current room identity refreshes during the existing 15-second visible-page reconciliation. Tests reproduce the original inbox failure and photo removal.

New feature: src/reminder-time.js suggests reviewed local reminder dates from English phrases such as in 30 minutes, tomorrow at 9am, Friday at 3pm and future ISO dates. Added local-time quick choices. Invalid dates, expired times, unsupported compound relative phrases and skipped daylight-saving clock times fall back to the calendar. A typed phrase must be applied/reviewed before saving; there is no automatic unconfirmed reminder creation. Other languages/general natural-language interpretation remain unsupported.

Validation: 59 automated checks pass, including avatar trust/fallback/group identity, inbox/room photo integration and removal, time suggestions, DST gaps, reviewed reminder submission and unsupported update checks. Production build verifies all hashed assets, separate standard/maskable icons, stable manifest and favicon/Apple links. No schema migration or live user data change was required. Actual installed-device launcher refresh and complete authenticated mobile flows remain unverified. Prior release limitations in FEATURES.md remain applicable; no E2EE, biometrics or device inventory is claimed.

## Earlier release readiness findings

# Luo Chat 12 — release readiness

Decision: suitable for continued preview testing; not ready to claim the entire requested feature list is complete, or market encrypted/private-device guarantees.

## Confirmed release gaps, in priority order

| Severity | Finding | File-level action |
|---|---|---|
| P1 | End-to-end encryption and biometric protection do not exist. Password screen lock does not encrypt the session, drafts or outbox. | Design an independently reviewed device-key, identity verification, recovery and attachment encryption protocol before modifying src/app.js, src/outbox.js and media/storage flows. Keep src/privacy-lock.js and src/feature-status.js explicit about current limits. |
| P1 | Backend cannot yet be certified reproducible from this archive alone. Migrations extend an existing schema. | Supply and restore a reviewed baseline plus all migrations in supabase/migrations to a disposable project, provision cron/buckets/functions/auth configuration, then run the live suites. |
| P2 | Topic channels, synchronized playlists and individual-device inventory/revocation are not built. | Implement genuine membership/history and provider/session integrations rather than placeholder toggles in src/workspace.js and src/settings.js. |
| P2 | Search does not index document contents or image OCR; map/threads use loaded history; timeline returns first 100 accessible messages; recaps are counts/excerpts. | Extend src/search.js and search_chat_everything with explicit indexing/pagination; src/workspace.js for paginated map/thread/timeline views. Add semantic processing only with explicit data handling and provider configuration. |
| P2 | Notifications/reminders have no background push; offline queue runs while app is open; custom uploaded sounds and sent synthesized audio are absent. | Add authenticated push subscription/delivery, audio-file synthesis and validated per-contact sound storage; update src/outbox.js and src/media.js with platform tests. |
| P3 | Natural-language reminder dates, inline booking integration and integrated camera QR scanning are not built. | Extend src/workspace.js with confirmed parsed dates and scoped provider integrations. Current dated reminders and external-camera profile QR links are functional. |

## Unverified risks and release tests still required

- P1: actual signup confirmation, recovery email delivery and hosted redirect configuration. Test luo-auth and src/app.js end to end with a controlled mailbox; delivery must not be inferred from a successful API response.
- P1: authenticated browser flows and physical iOS/Android/desktop behavior after this feature expansion. No complete authenticated-browser run was obtained.
- P2: real file transfers and physical deletion for the new story/vault/library flows. SQL retention tests verify metadata, permissions and queueing, not blob transfer.
- P2: local video trimming/animated sticker rendering, canvas editing, PDF viewing, native offline SpeechRecognition and Translator language support need target-device tests. src/video-editor.js, src/image-editor.js, src/media.js and src/translation.js gate capability errors; Egyptian Arabic availability is not guaranteed.
- P2: full accessibility audit with screen readers, keyboard-only dialog interactions, touch targets and 200% zoom. Tests cover named controls, accessible states, safe text rendering and selected keyboard flows, not WCAG conformance.
- P2: multi-device reconnect and adversarial concurrency under load. Server idempotency/version checks and existing reconciliation are present; no load or penetration test is claimed.

## Verification completed

- 49 automated checks passed (46 frontend/tool checks and 3 cleanup-worker checks), including existing auth/profile/settings UI, search parser calendar validation, silence detection, WAV framing, explicit translation preparation, outbox retry/account separation/cancellation/corrupt storage, exact sentence quotes, feature-status dialog and screen lock/signout reset.
- npm run build passed: hashed assets, generated circular icons, stable manifest and static-only service worker references.
- tests/v12-access.sql passed live in a rolled-back transaction: quotes, TTL retry stability, expiry/search RLS, private transcript/vault isolation, checklist versions, legal game turns, quiz feedback gating, announcement/reply/file permission checks and outsiders.
- tests/v12-social-access.sql passed live in a rolled-back transaction: story audiences and private reactions, private circles and vault snapshots, NULL-assignee task permission denial, moderation and bot rate limiting, mutual timeline consent/revocation, selected presence, retained library/snapshot deletion behavior, digest worker and temporary-group posting denial.
- Account deletion Edge Function version 2 includes luo-stories and luo-vault in cleanup, alongside chat-media and avatars. Account deletion itself was not executed against a real account in this release.
- Live cron exists for scheduled sending, message expiry, reminders, stories, temporary-group archive and group recaps. Storage cleanup is now scheduled every five minutes using a server-generated scoped credential held in Vault; no credential value was exposed to the browser or source.

## Corrections during verification

Fixed a generic form bug that assigned the read-only textarea type property, preventing sentence quotes, annotations and other multiline tools from opening. Added a regression test. Corrupt outbox storage now reports an error without an unhandled background rejection; pending rows remain intact. Signout clears selected attachments, reply state and composer text. Read aloud uses only a local voice. Attachment default expiry is explicitly rejected before sending, with instructions to set message expiry afterward; it is not silently ignored.

Cleanup verification: the first run exposed an old incorrect Storage delete route (HTTP 400). Updated the worker to use the batch removal endpoint with prefixes. The next authenticated invocation processed and removed both queued jobs with zero failures; the queue was empty afterward. An invalid worker credential returned HTTP 403. Unit checks cover anonymous rejection, the deletion request contract, retained-library protection and failure isolation. A physical existing-object retention test for each new media bucket is still required. The deployed cleanup function is version 3, with explicit scoped-token authentication inside the handler; gateway JWT verification is disabled for the scoped scheduler. Deployment configuration records that choice in supabase/config.toml.

Production frontend deployment: dpl_Dnpvh8V6Z24XnvBS7ctX5eGtRanR, READY. Remote build includes all 49 frontend/tool and cleanup-worker checks. Public browser loaded the matching app-L67T7QM6.js bundle, with no application-origin console errors observed and no viewport overflow. Authenticated browser and mobile claims remain unverified.

For every requested capability, use FEATURES.md or src/feature-status.js as the exact status ledger. No GitHub repository was used or modified for this release.


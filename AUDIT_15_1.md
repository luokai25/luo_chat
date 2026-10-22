# Luo Chat 15.1.0 — bug and design review

Checked 21 October 2026. This release preserves the black-and-gold identity, supplied app icon, 200 Luo Family stickers and existing features. The review found and fixed concrete frontend defects; it does not certify that the entire application is bug-free or ready for an unrestricted public launch.

## Confirmed defects fixed

| Priority | Defect and evidence | Change and exact files |
|---|---|---|
| P1 | Mobile settings could render about 1,160 px of content inside a 390 px viewport. The outer page hid overflow, so a root-page overflow check missed the inaccessible content. | Constrain screen/flex/grid minimum widths, use a zero-minimum settings column, contain the horizontal category rail, and stack narrow forms. `public/style.css`. |
| P1 | The long conversation menu extended below the viewport: its bottom reached about 1,074 px in an 844 px screen, without an internal height limit. | Bounded scrollable menu, reachable buttons, close after selecting an action, Escape with restored focus. `public/style.css`, `src/experience.js`. |
| P1 | Delayed frame/settings results could change a later account/session's controls or profile state. Older finally blocks could unlock a newer pending save. | Bind settings operations to the initiating account generation; discard stale successes/errors/finally work and reset controls on session transitions. `src/settings.js`. This prevents UI contamination; an already dispatched server mutation can still complete. |
| P2 | Frame and notification saves could display choices edited during the pending request rather than the values actually submitted. | Capture submitted values and render the confirmed snapshot. `src/settings.js`. |
| P2 | Delayed contact lookup could repopulate a cleared screen after signout or display a result for a username the user had already edited. | Validate usernames, bind responses to account/request/input, invalidate on edits and signout. `src/app.js`. No backend data exposure was demonstrated by this UI defect. |
| P2 | A callback from an old realtime channel could replace the current connection indicator. | Check the active account and room request before applying channel status. `src/app.js`. |
| P2 | General status/error feedback appeared outside modal dialogs, behind the browser's modal layer. | Render an announced status inside the active dialog and bring it into view; suppress the duplicate outside toast. Clear old-session notifications. `src/app.js`, `public/style.css`. |
| P2 | Several dialogs lacked a programmatic name; settings landmarks were nested ambiguously. | Link static and dynamic dialogs to their live headings; preserve one labelled settings navigation landmark. `public/index.html`, `src/calls.js`, `src/suite.js`, `src/drawing.js`, `src/albums.js`, `src/device-access.js`, `src/image-editor.js`, `src/video-editor.js`, `src/sticker-tray.js`. |

## Design changes

- Settings fit the visible panel on narrow phones. Category hints use ellipsis within their own buttons, and the rail scrolls inside its allotted width.
- The conversation menu scrolls inside the viewport; lower actions remain reachable.
- Dialog headings and close controls remain available while scrolling. At 320 px, tool cards use one readable column.
- On small phones, Schedule this message moves into the conversation menu, freeing composer space; the underlying scheduling flow is unchanged.
- Modal feedback is visible and announced within that modal. Touch-only messages keep their actions under More instead of exposing hover-only Reply controls.
- No new app icon, theme palette, paid provider or account setting was introduced.

## What was verified

| Check | Evidence and limits |
|---|---|
| Application tests | 189 tests pass locally and after a clean lockfile install. Twelve new checks cover settings snapshots/session transitions, contact lookup, old realtime state, named dialogs, modal feedback and menu keyboard behavior. |
| Clean frontend build | 213 production outputs match byte for byte after a clean install with dependency install hooks disabled. This does not prove backend restoration or Edge Function bundle reproducibility. |
| Browser layout and interactions | Chromium 141, 42 inspected views at 320, 390, 768 and 1,440 px widths. Checked authentication layouts, inbox, chat, long menu, tools pages, settings categories and modal feedback. No page errors or unintended root/modal/settings/menu overflow in the final run. Intentional scrolling and text ellipsis remain. |
| Automated accessibility | Axe 4.10.2 scans on settings, chat and tools returned zero findings for the selected WCAG 2 A/AA, WCAG 2.1 A/AA and best-practice rules. This is not a full accessibility certification, screen-reader review, or physical-device acceptance test. |
| Dependencies | Frontend production dependency audit returned zero known vulnerabilities. This does not cover every development/tooling dependency, runtime, external provider or unknown vulnerability. |
| Fixture isolation | Browser checks compile actual frontend modules and serve actual CSS with a synthetic backend. No real user accounts/content are used. The release gate verifies that this synthetic backend is absent from the production app bundle. |

Browser evidence is retained in `verification/v15.1.0-browser.json`; release/deployment evidence is in `verification/v15.1.0-release.json`. Screenshots were used internally for review, not packaged as deliverables.

## What this run did not establish

The browser uses synthetic database/auth responses. It cannot prove hosted email delivery, Google OAuth consent/return, database RLS behavior, deletion cleanup, real cross-device calls, push-provider delivery, OS permission prompts, installed-app updates, virtual-keyboard behavior or real device accessibility. Existing backend rollback fixture results remain in the source; those suites were not rerun for this frontend-only release. No schema, Auth/provider configuration, accounts, domain, TURN service or push worker was changed.

## Remaining priorities

| Priority | Open gate | Concrete next work |
|---|---|---|
| P0 | Reported Chrome phishing warning has no supported clearance evidence in this run. | Use official host-specific owner findings/review evidence and verify the warning is gone in Chrome before signing in. Do not bypass it or treat deployment success as clearance. |
| P1 | Hosted recovery, Google provider activation and account deletion acceptance remain incomplete. | Owner configuration plus controlled-account tests for one-use/expired links, redirects, consent, deletion and partial-cleanup recovery. See `GOOGLE_SIGN_IN.md`, `PROJECT_CHECKLIST.md`. |
| P1 | Strict session revocation and breached-password configuration remain open. | Review hosted Auth protection and an explicit server session-check design. Existing access tokens may survive refresh-session revocation until expiry. |
| P1 | Full database/media backup and restoration are unverified. | Review baseline coverage and rehearse an isolated full restore. The selected-chat encrypted text snapshot is not that backup. |
| P1 | Restrictive-network calls and closed-app push lack physical-device acceptance. | Configure TURN and test two consenting controlled devices; check actual installed Android/iOS notification delivery and unsubscribe behavior. |
| P2 | Full assistive-technology, locale/RTL, keyboard, reduced-motion/contrast combinations and low-end-device performance remain open. | Run physical-device and screen-reader sessions, including large fonts, the OS keyboard and installed-PWA updates. Establish browser/Supabase error monitoring and measured performance budgets. |

End-to-end encryption, content malware scanning and a complete fresh backend baseline remain separate substantial projects. Existing limited/unsupported capabilities remain accurately labelled in `FEATURES.md` and `RELEASE_15.md`.

## Repeating the browser review

`tests/browser/audit.mjs` starts a loopback-only fixture server, builds the actual frontend against `tests/browser/fixture.mjs`, blocks external HTTP requests and writes its evidence into `LUO_AUDIT_OUTPUT` (default `test-results/browser`). It exits unsuccessfully for collected page errors, relevant unintended clipping or accessibility findings. Use an installed Chromium through `CHROME_PATH`. The isolated audit tooling used Playwright 1.56.1, Chromium package 141.0.0 and Axe Playwright 4.10.2, with install hooks disabled; none is added to the product's production dependencies. For accessibility scans, `BROWSER_TOOL_ROOT` points to an isolated installation of the Chromium/Axe tooling. Use a supported system font configuration for that browser. The browser test is a frontend acceptance fixture, not a substitute for controlled hosted-account testing.

## Production result

- URL: https://luo-chat-luokai25.vercel.app/ (the reported browser warning remains unverified; this URL is release metadata, not clearance).
- Target: production; status: READY.
- Deployment: `dpl_8PVeVyZM59nNTtirSxJfQ8Jf8Nrr`; framework: vanilla JavaScript PWA; source upload, no Git commit.
- Hosted build: 44 seconds, 189 tests passed, zero failed.
- Live HTML, JavaScript, CSS and service-worker hashes match the verified local build.
- Call configuration returns 401 without authentication and 405 for unsupported methods.
- A deployment-scoped 15-minute Vercel error/fatal runtime-log query returned no groups. This does not cover browser or Supabase failures. Monitoring/drain configuration was not changed or newly certified.

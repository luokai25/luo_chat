# Luo Chat 15.0.2 — safer call handling

Release date: 21 October 2026. This patch preserves the black-and-gold interface, app icon, stickers and the 15 feature areas already delivered.

## Fixed call behavior

| Area | Change |
|---|---|
| Incoming permission/configuration failures | Keep the incoming Accept / Decline controls for a failure before answering. Never turn an incoming retry into an outgoing Start action. If signaling has already begun and fails, end that attempt rather than offering an ambiguous retry. |
| Delayed Decline | Close and clean up the current incoming dialog immediately; its eventual server response cannot close a newer call. |
| Camera switch | Reset the switch button on call cleanup; release a camera granted after the old call ended. The next call can switch cameras normally. |
| Signaling refresh | Give each pending refresh its own token, clear stale work on reset and prevent an old completion from clearing a new operation. An unanswered network request from an old call cannot block a new call's polling. |
| Offer / answer creation | Recheck the originating call after creating an SDP offer or answer and before applying it. Late SDP cannot be applied to a newer peer connection. |
| Privacy lock | The call module also stops its own dialog/media when the screen lock activates. This reinforces the existing lock's dialog cleanup. |
| Intended recipient | Bind Start to the direct conversation selected when opening the call dialog. Known conversation names appear in outgoing and incoming dialogs/banners. Names are rendered as text. |
| Network failures | Handle rejected ICE-candidate and end-call network requests without unhandled promise failures. Ending is best effort; the server's expiry/cleanup remains the fallback if offline. |

## Scope

This changes frontend call handling only. No database schema, account settings, OAuth provider, domain, TURN relay or push-worker configuration is changed. No real user messages or calls are needed for the tests.

## Remaining acceptance gates

TURN is not configured, so restrictive networks may prevent call connectivity. Two-device real audio/video, physical phone closed-app notifications and broader screen-reader acceptance remain unverified. This patch does not implement end-to-end encryption, cryptographic local storage, full database/media restore or guaranteed immediate session revocation.

Google's reported phishing warning has no supported clearance evidence here. Do not bypass a browser warning; deployment success and asset checks do not establish clearance.

See `RELEASE_15.md`, `RELEASE_15_0_1.md` and `PROJECT_CHECKLIST.md` for the wider feature limits and release gates.

## Production verification

- Target: production; status: READY.
- Deployment: `dpl_9kFUxVinHaUjJzik4i7e32n8FTWr`.
- Framework: vanilla JavaScript PWA; source upload, no Git commit.
- Hosted build completed in 38 seconds, with 177 passing tests and zero failures.
- Local and clean-install runs also pass 177 tests; all 213 production outputs match after the clean install.
- Seven new call checks pass with this patch and fail against saved 15.0.1 source. These include a new independent screen-lock safeguard and conversation-label behavior, not seven separate proven security vulnerabilities.
- A deployment-scoped 15-minute Vercel error/fatal runtime-log query returned no groups. This only covers available function/daemon logs, not browser or Supabase monitoring. No monitoring/drain configuration was changed.
- Live asset hashes and API boundary checks are recorded in `verification/v15.0.2-release.json`.

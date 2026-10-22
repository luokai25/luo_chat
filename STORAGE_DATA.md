# Luo Chat 15.2.0 — storage and data on your device

Implemented 21 October 2026. Preserves the black-and-gold theme and supplied icon. Includes the 15.1.1 reliability fixes described in `RELEASE_15_1_1.md`.

## User controls

Open **Settings → Storage & data → Storage & data**, or **Luo tools → Storage & data**.

| Data | Default behavior | User choice |
| --- | --- | --- |
| Recent chat text | Recent online-loaded message text is cached in account-scoped IndexedDB for 7 days. Up to 200 messages per cached room; normal room loading currently fetches 100. | Turn text caching off, or use 1/7/30-day retention. Turning off removes cached text. |
| Shared files | No automatic file caching. | In the media viewer choose Save temporarily or Keep offline. Each offline file is capped at 20 MB. |
| Temporary copies | Expire after the selected retention time and are removed under the selected byte limit, oldest first. Cleanup runs on storage access, not while the app is closed. | Clear temporary copies without deleting kept files or shared messages. |
| Kept files | Excluded from temporary cleanup; count toward the same storage limit. | Open or remove each device copy; remove all offline copies; choose a 25/50/100/250 MB budget. Lowering the limit never silently deletes kept files. Maximum 200 kept files; at most 500 cache entries overall. |
| Signout | Clears account-scoped cached text/files, including kept files, and the existing offline inbox index. | Explicitly choose to retain readable copies on a trusted device after a confirmation. |
| Drafts and queued sends | Remain separate from disposable cache. | Existing draft removal and per-item queue cancellation remain available. Cache clearing never cancels an intended message send. |
| Personal stickers | Remain in their separate account-scoped sticker store. | Existing personal-sticker removal remains available. |
| Browser origin storage | The storage manager displays the browser estimate, including app shell and other stores. | Explicitly request persistent storage; the UI reports denial or unsupported behavior accurately. |
| Phone Downloads / exported files | Independent files outside the app's cache. | Manage with the phone's Files app. Clearing cache or recalling a message cannot erase them. |

## Offline behavior and privacy

- A signed-in local session plus the existing offline inbox index can open previously cached chats without requesting hosted history. Offline text uses a separate read-only rendering path and is labelled as a device copy; no receipt is fabricated.
- Media opens cached bytes offline. Supported raster images, audio, video and small plain-text files can preview; other saved formats can be downloaded for another app. Cached files can be listed and removed in Storage & data.
- Online media use still checks access to the source before reusing cached bytes. Known recall/deletion/expiry clears the related cached file; a lost conversation membership clears that room's text/files. Current-room reconnection refreshes the recent cached text and reconciles attachment access for queried messages.
- Offline copies cannot detect a remote recall, edit, membership change or revocation while disconnected. Cached files belonging to conversations that are not reopened can retain stale bytes until access is rechecked, their retention expires or the user clears them. This is not instant remote erasure.
- Disappearing-message text and media are excluded from offline caching. Independent vault/library copies have their own retention/access semantics.
- Cache records store file bytes and bounded metadata, never signed URLs, tokens or sessions. Cache reads/writes are guarded by account generation and the app lock; local storage is not encrypted and does not protect against an attacker controlling the browser profile, same-origin script, or an unlocked device.
- The service worker continues caching only the public app shell. Private messages and file responses are not put into its public Cache Storage.
- Browser data eviction, clearing site data or uninstalling can remove app storage. Persistent-storage permission reduces some eviction risk; it is not a backup guarantee.

## Implementation

- `src/device-cache.js`: IndexedDB store, owner isolation, retention/byte-budget cleanup, kept-file reservation, bounded streaming download, policy and signout handling.
- `src/app.js`: cache recent text, offline rendering, reconnect refresh and account/membership cleanup.
- `src/media.js`: explicit temporary/kept actions, offline viewer, object-URL cleanup and online access checks before cached-byte reuse.
- `src/suite.js`: Storage & data settings, file inventory, usage, cleanup and persistence request.
- `tests/device-cache.test.mjs`: policy, isolation, expiry, recall, signout, budgets and streaming limits.
- `tests/browser/cache-audit.mjs`: real browser IndexedDB Blob round trip, account isolation, signout/temporary cleanup, page reload, offline chat/file reopening and 320/390 px panels with a synthetic backend.

## Verification and remaining gates

See `verification/v15.2.0-release.json` and `verification/v15.2.0-cache-browser.json`. Real-browser evidence uses synthetic accounts/content and does not certify hosted recovery, physical phone codecs, app-install behavior or all accessibility combinations. Existing hosted-auth, session-revocation, full backup/restore, TURN/push and official Safe Browsing clearance gates remain open. No database schema/provider/paid service was changed for this release; no new connector is required.

### Browser platform references

- [MDN: storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN: requesting persistent storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)

### Production result

- Deployment: `dpl_6bB7Gd5cUd5vRBdZpUNpQ1HL6pgX`, production, READY; vanilla JavaScript PWA; source upload without Git; approximately 37 seconds to ready.
- Existing URL: https://luo-chat-luokai25.vercel.app/ — deployment metadata, not evidence of Safe Browsing clearance.
- 207 tests pass locally, after a clean install and in Vercel; all 213 clean frontend build files match. Live HTML, app JavaScript, CSS and service-worker SHA-256 hashes match the frozen verified build.
- Five cache browser evidence records, including real IndexedDB checks and 320/390 px panels, report no page errors or unintended root/modal horizontal overflow. No physical-phone acceptance or new full accessibility audit was performed.
- A deployment-scoped 15-minute function/daemon error/fatal log query returned zero groups. Persistent browser/Supabase monitoring and drain configuration were not newly established.

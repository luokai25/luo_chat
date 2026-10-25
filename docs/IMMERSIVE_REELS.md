# Immersive Luo Reels — development upgrade, 2026-10-25

Scope: development branch based on `release/social-web-20261024` at
`72434734931b5b847cf09cac2767b6e58522a7a6`. No production deployment,
authentication edits, account changes, or hosted database writes.

## Implemented

- Edge-to-edge cover-fit video, one clip per scroll-snap viewport; transparent
  Reels / Explore / Friends / Create navigation. Existing app tabs remain reachable.
- White outline engagement rail, gold selected state, safe-area-aware layout,
  compact creator identity, expandable caption and original-audio attribution.
- Single-tap pause/resume; double-tap like without accidentally unliking an
  already-liked clip; gold heart effect; hold for 2× playback with cancellation
  on movement/release. Seeking and sound controls remain individually accessible.
- Muted autoplay when visible, except reduced-motion / data-saving preferences;
  one video plays at a time. At most the current clip and adjacent clips retain
  loaded video elements. Hidden-page and unmount cleanup pause/release playback.
- Comments and share/options sheets preserve the current clip. Comments pause
  playback and resume it on close only if it was playing. Header drag-down and
  explicit Close / Escape dismiss the native modal.
- Existing backend-backed likes, private saves, comments and reports. State is
  changed only after the backend confirms; failures remain visible. Comment
  retries retain their operation ID. Comments page in batches of 50 with UUID
  cursors and duplicate suppression; feed uses the existing 20-row keyset pages.
- Shared links include an entry ID, never a signed storage URL. Opening the
  link after sign-in requests `entry.get`; the backend still decides visibility.
  Native external sharing is offered only where supported, with Copy Link as
  fallback. A recipient cannot gain access merely by receiving the link.
- Existing gallery import / caption / audience / publish flow remains available
  from Create. No cosmetic camera/editor controls pretending to process video.

## Authorization and data handling

The existing `luo_space` implementation was inspected read-only. It checks
`auth.uid()`, `space_visible`, publication state, write throttles and operation
IDs. `responses` returns at most 50 rows and filters blocked users; reports
are owner-restricted. Anonymous EXECUTE is false; authenticated EXECUTE is true.
This review is not a new end-to-end production persistence or security audit.

Frontend requests use the existing RPC and storage policies. Signed URLs are
validated against the configured Supabase origin and `luo-social` path. Text is
inserted using textContent, not HTML. No new local cache of private social data,
no credentials or service-role keys, no third-party media service added.

## Not implemented in this pass

Following and repost relationships; friend-activity recommendations; comment
likes/replies/pinning/GIFs/translation; in-chat recipient selection and preview
messages; licensed sound library and audio reuse; captions without supplied
caption tracks; camera effects/dual capture/green screen; multi-track timeline,
split/trim/export/voiceover/stickers; drafts/scheduling/collaboration publishing
controls beyond the existing flow. These require real data models, policies,
media processing and separate acceptance tests before being exposed as working
features. Existing friendship privacy is not silently changed into following.

## Verification

- `npm run release:check` — PASS: build and 388 automated tests.
- `node tests/browser/social-feed.mjs` — actual app/styles in Chromium at
  320, 390, 768 and 1440 pixels with generated video and synthetic backend:
  one-viewport layout, cover fit, tap/double-tap, likes, comments, video pause /
  resume, tab cleanup and no page exceptions.
- `npm run audit:production` — PASS: zero reported production dependency
  vulnerabilities. This is not a guarantee that the application is secure.
- `npm run release:reproduce` — PASS: 100 production files match byte-for-byte
  after an independent clean lockfile install; not a database restore test.

Browser fixtures validate UI and integration boundaries, not hosted accounts,
two-device synchronization, Android APK behavior or production persistence.
No APK has been rebuilt as part of this web-source change.

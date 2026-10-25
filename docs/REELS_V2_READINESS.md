# Luo Reels continuation — development readiness

Date: 2026-10-25. Base: `2090f0827032b4b41f579d770b557eafdf71e282`.
This is a development-branch change, **not a production release or APK build**.
Device draft support was added subsequently; see [Device Reel drafts](CLIP_DRAFTS.md).

## Feature coverage

| Requested area | Built in this continuation | Still outstanding |
| --- | --- | --- |
| Immersive feed | Existing full-screen feed retained; additional Following and Saved filters | Opt-in friends' activity feed and personalized recommendations |
| Follows/reposts | Explicit follow/unfollow; public-only repost/unrepost; followed creators' public reposts in Following | Follower lists, profiles' repost grids and friend-activity privacy settings |
| Comments | Existing comments retained; replies, likes/unlikes, one creator pin displayed first, creator/author removal, timestamps, UUID pagination | GIFs, mention notifications, translation, editing and deeper nested replies |
| Sharing | Search recent eligible direct conversations, permission recheck before sending, idempotent send, in-chat reference card, Copy Link | Group recipients, Stories sharing and richer server-produced thumbnail previews |
| Discovery preferences | Persisted Interested / Not Interested choices; hidden items excluded from Explore/Following | Actual recommendation-ranking system; preference does not imply AI ranking |
| Camera | Explicit permission, preview, recording progress, 90-second limit, track cleanup and gallery import | Clip stacking, facing-mode selector, timer, flash, dual camera, AR/effects/green screen |
| Editor | Real local trim/speed export, preview selection, output review before publishing | Multi-track timeline, split/reorder/add clips, undo/redo, burned-in text/stickers, voiceover/audio mixing, captions, templates |
| Publishing | Caption, audience choice, validated MP4/WebM/size/duration, retry-safe draft ID and upload reuse after confirmed upload; subsequent device draft library | Schedules, covers, tags, locations and new collaboration controls |
| Audio | Original audio attribution retained; exported source audio where captureStream provides it | Licensed music discovery/reuse/audio detail page; real-device audio export acceptance |
| Reliability | Capability negotiation, old-server fallback, stale-account guards, request timeout, bounded pages, no private media URL sharing | Full hosted-schema restore, multi-connection race testing, two-device production acceptance |

## Backend rollout boundary

`supabase/proposals/reels-social-v2.sql` is an **unapplied SQL proposal**.
It adds the `luo_reels` RPC and private follow/choice/comment-metadata/like/pin
tables. The RPC derives the actor exclusively from `auth.uid()`, checks the
existing social visibility/block predicates, throttles writes, bounds lists,
validates parent/entry relationships and delegates messaging to the existing
idempotent message RPC. Following/reposting never grants private clip access.
Only public clips can be reposted. Recipient sharing initially supports direct
rooms with exactly two members and rechecks both participants' visibility.

All new tables have RLS and no browser table/schema grants. The privileged RPC
is intentional because its storage is private; it pins an empty search path,
revokes public/anonymous execution and exposes only authenticated operations.
Deleting a comment replaces the original body, clears likes and its pin, and
keeps a reply placeholder. Pinned-first pagination excludes the pinned row from
subsequent pages so it cannot duplicate or skip ordinary rows.

The frontend probes capabilities once per feed mount. If the RPC is missing,
incompatible or inaccessible, existing v1 likes/saves/comments/sharing remain
available and v2 controls are not presented as functional. New SQL has **not**
been applied to the connected live Supabase project, and no Vercel deployment,
account, auth provider, plan, subscription or production data was changed.

Approved rollout needs a genuine staging database matching the current hosted
schema, a CLI-generated migration, advisors/authorization checks, shared-session
and real-device acceptance, followed by an explicit production rollout decision.
Do not apply the proposal blindly, rename it into an invented migration version,
or treat isolated tests as a full production migration rehearsal.

## Verification scope

Build/tests: 406 passed, zero failed. Clean lockfile reproduction matched all
100 production outputs. Production dependency audit reported zero vulnerabilities;
credential-pattern scan passed. These are bounded checks, not a security guarantee.

The final check exposed a build reproducibility defect: esbuild graph hashes
could name identical JavaScript differently in separate source directories,
changing the HTML/service-worker references. `build.mjs` now names the emitted
app using its SHA-256 bytes and removes obsolete hashed app bundles from reused
output directories; `scripts/verify-build.mjs` verifies both invariants.
The clean-copy script also includes the SQL proposal required by database tests,
compares two isolated clean installs rather than a mutable working output
directory, and reports exact mismatched paths rather than an opaque failure.

- `tests/reels-database.test.mjs` executes the actual SQL proposal using pinned
  PGlite 0.5.11 (development-only dependency), with synthetic upstream contracts.
  Tests cover anonymous/direct access denial, private clip isolation, follow and
  repost retries, comment/reply idempotency and cross-clip denial, moderation
  ownership, recipient denial, atomic share retry, quotas and equal-timestamp /
  pinned comment pagination. This does not reproduce every existing trigger,
  RLS policy, HTTP layer, hosted Postgres extension or concurrent transaction.
- `tests/reel-features.test.mjs` covers capability fallback, confirmed-only UI
  state, comment/share retry IDs, parent references, stale-account isolation,
  exact message-reference matching, trim bounds and camera cleanup after a late
  permission response.
- `tests/browser/social-feed.mjs` uses the actual app/CSS in Chromium at 320,
  390, 768 and 1440 px with synthetic backend responses. It additionally uses
  a real locally generated video, real browser trim/export, verifies a shorter
  playable result, and exercises the publish integration without hosted writes.
- Run `npm run release:check`, `npm run audit:production`,
  `npm run release:reproduce` and `node scripts/check-secrets.mjs` before rollout.

## Known limitations and risks

Browser recording/export requires MediaRecorder and captureStream. Unsupported
devices receive a clear error and can import/publish an unchanged supported
video. Export takes real time, is frame-approximate, and needs the screen open;
background/closed-app export is not promised. Camera/audio quality, Safari and
Android WebView support, silent/variable-frame-rate inputs and prolonged
low-memory operation still need device acceptance. Captured audio depends on
the browser exposing an audio track; this is not a licensed music system.

The existing hosted publication RPC checks object size/type but trusts the
client-supplied duration. The new composer validates duration locally; that is
not an authoritative server-side 90-second security limit. A trusted media
inspection/transcoding worker is still required before claiming that limit is
enforced against crafted API requests.

Unsaved edits are page-local; explicit device draft saving is documented separately.
An ambiguous failed upload retry chooses a new object path; the old draft-owned
object may require later orphan cleanup. Nothing is uploaded until Publish.
No secrets, service-role credentials, external media services or paid resources
were added. Authentication/calls/stories configuration remains protected by the
existing release-scope tests; production dependencies remain unchanged.

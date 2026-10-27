# Luonix media publisher V10: release-readiness record

**Scope:** `feature/agent-autonomous-onboarding-20261026` GitHub branch. No manual production deploy or database modification.

## Actual working paths

- **Create Luonix / Create post:** same four-stage full-screen flow on phones: gallery/camera or text-only entry, photo/video preview with playable video and media strip, audience, then upload.
- **Media support:** JPG, PNG, WebP, MP4, WebM. Up to 6 media items; max 8 MB per photo and 20 MB per video, 20 MB combined. This is an intentionally conservative client limit; server enforces ownership and supported MIME types.
- **Text-only:** preserved from the previous post composer. Requires nonempty text; publishes no attachments.\n- **Single video:** published as `clip` after native video metadata confirms duration is 0–90 seconds. Advanced existing Luonix studio remains available for recording and trimming; it keeps its original code.
- **Multiple videos/photos:** published as `post` with mixed `media` paths and rendered as a signed-image/video carousel inside Luonix and Friends/Public feeds.
- **Privacy screen:** Friends (server-approved connections), Public (server-public posts) or Only me. Confirmation required for Public.
- **Progress states:** Preparing, Uploading, Finalizing and Retry. UI displays *completed file count*, not invented byte percentages. When one file is uploading, the animation is indeterminate.
- **Retry:** stable UUID and stable storage paths for retries; already uploaded files are skipped, and a lost acknowledgement is reconciled only after a server `storage.info()` lookup returns the expected size. Duplicate taps do not submit twice. Offline state shows a retryable notice.
- **Privacy and resources:** runtime checks actor ownership after asynchronous actions. Image Blob URLs are revoked on navigation. Signed remote media URLs are origin-checked. Preview videos pause on switching, page visibility change and unmount.
- **Not implemented:** arbitrary single-person post audience, HEIC conversion, byte-accurate upload percentages, resumable TUS upload, and transcoding unsupported video codecs.

## Backend compatibility check

Read-only inspection of the existing production `public.luo_space(action text,input jsonb)` function on October 27, 2026:
- `entry.create` accepts `post` and `clip` with `private`, `friends`, `public` audiences.
- `entry.publish` verifies owner, path prefix, uploaded object MIME type and file size, permits 10 media objects, and requires one video with duration no greater than 90 seconds for `clip`.
- No production migrations or policy changes were required for mixed `post` media.

## Required gates prior to merging

Run `node --test tests/luonix-media-publisher.test.mjs tests/social-spaces.test.mjs tests/social-feed.test.mjs`, then `npm run release:check`.

Manual devices: Chrome Android, Samsung Internet, mobile Safari and low-memory Android; gallery selection, camera, video codecs, short/long clips, mixed ordered carousel, offline retry, timed out response + duplicate upload, private/friends/public visibility verified from separate accounts, sign-out mid-upload, portrait/landscape keyboard behavior and data-saver/reduced-motion.

**Known release blocker:** GitHub/Vercel build-rate restrictions may prevent a preview. Source/DOM regression tests have been authored but are not a substitute for a successful CI run and real-user end-to-end testing.

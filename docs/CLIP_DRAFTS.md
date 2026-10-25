# Device Reel drafts — 2026-10-25

Development branch only. No production deploy, hosted database change, new
subscription, auth change or APK build.

## Available in the development composer

- **Save draft on this device** explicitly saves the current video, caption,
  audience and trim/speed selection in account-scoped IndexedDB. Saving never
  uploads media, turns on the camera or requests microphone permission.
- Choose seven or thirty days of retention. Maximum three drafts / 100 MB total,
  with 50 MB per video. Limits reject another save rather than silently deleting
  existing work. Expired records are pruned on access, not by a closed-app job.
- Restore, update, delete one, refresh and delete all are available under
  **Reel drafts on this device**. Restoring over an open clip and destructive
  deletion require an in-app confirmation. Captions/filenames render as text.
- An exported edit updates the open clip, not its saved copy, until Save draft
  is explicitly pressed again. An imported new clip receives a new draft ID.
- Confirmed publication removes the corresponding saved device draft. Draft
  saving and publishing cannot race each other; deleting/clearing invalidates
  pending writes so an old save cannot resurrect deleted work.
- Sign-out invalidates pending operations and queues deletion for the outgoing
  account. Other accounts' drafts are not touched. No tokens, signed media URLs,
  server upload operation IDs or arbitrary caller metadata are persisted.
- Browsers without working IndexedDB show an error without blocking ordinary
  import, recording or publishing. Reverting an unsupported trim to the original
  selection restores the ability to publish the original clip.

## Privacy and limitations

Drafts are local plaintext media, **not encrypted or synchronized**. Use a trusted
device. A person with local browser/profile access may inspect stored files;
app account scoping is not cryptographic separation. Browser eviction, private
browsing, device loss or clearing site data can remove drafts. The UI states
these limits before saving.

Sign-out cleanup is asynchronous. Closing the browser or a storage failure can
interrupt deletion; immediate or forensic erasure is not guaranteed. A generic
cleanup failure is logged without filenames or content. The draft panel provides
explicit deletion controls when the account next opens it.

Unsaved edits remain page-local. An ambiguous publication response across a full
page restart is not an exactly-once publication guarantee: review published clips
before retrying a saved draft after restarting. Existing hosted-backend, media
inspection, full editor and device-acceptance gaps remain in
[the Reels readiness report](REELS_V2_READINESS.md).

## Verification

417 automated tests pass. Two isolated clean installs produce the same 100
production files. The credential-pattern scan passes. This is not an Android
hardware test, a security certification or a hosted-backend rollout.

- Unit tests cover ownership, media/metadata retention, three-draft cap, byte
  budget, expiry, updates, storage errors, sign-out and clear-versus-save races.
- Composer test holds a draft write pending, verifies Publish cannot dispatch,
  then confirms publication removes exactly that saved draft.
- Actual Chromium with native IndexedDB saves an exported video and caption,
  reloads the app, restores it, publishes against a synthetic backend, and
  verifies the saved copy is removed. Saving is checked to make no upload.
- Existing four-size feed, gesture, comment, sharing and real video-export
  browser checks remain included. No real account content or camera hardware is
  used by the browser test.

Production rollout and real Android/iOS/WebView storage acceptance remain pending.

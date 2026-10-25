# Single-source timeline continuation

Date: 2026-10-25. Base commit: `beac82e00680ed7d2f76c88216ff23eab75a7e21`. Development branch only; no production deployment, hosted backend changes, account changes, paid services, new dependencies or APK release.

## Implemented

- `src/clip-timeline.js`: a bounded, source-time timeline for **one imported or recorded video**, up to 12 segments. Split at the actual video playhead, select segments, trim individual start/end, set 0.5×/1×/1.5×/2× speed, move earlier/later, delete, reset, undo and redo. At least 0.15 seconds per segment; 30 history snapshots. Selection alone is not an edit. Snapshots are copies, not shared mutable state.
- Timeline controls are keyboard/touch accessible and black/gold. The source-time playhead follows video seeking; selected ranges preview individually. This is not yet a thumbnail-based, multi-file or multi-track editor.
- `src/clip-timeline-export.js`: actual local real-time rendering of the selected source intervals in their chosen order. One bounded canvas video output plus the source element's captured audio, one native WebM MediaRecorder. Encoding pauses between source seeks rather than intentionally recording the seek gaps. No microphone request, upload, external asset or third-party renderer.
- Output is capped at 1280px longest side / 921,600 pixels and 24fps, without upscaling. Planned output must be ≤90 seconds; encoded output must be ≤50 MB. Actual resulting duration is read again by the composer before publishing; client-side checks are not authoritative server inspection.
- `src/clip-composer.js`: publishing is disabled and separately guarded while timeline edits are unapplied. Explicit draft saving is refused until the cut is rendered, so it cannot silently save an original file without its segment decisions. After export, existing preview, trim, drafts, visibility and publish paths use the real assembled file.
- Cancel timeline export retains the source file and cut decisions, keeps publication gated, stops owned encoders/tracks/frame callbacks and revokes its private Blob URL. Unmount aborts export. Stale-account guards prevent progress/results from returning into another account/view.
- Renderer errors, source errors, premature source end, startup failure, decode/seek/play/finalization timeouts and oversize exports fail without reporting success. Original file/project remain available if rendering fails before replacement.
- New-file/rendered-file previews reset playback speed to 1×. This fixes a preview mismatch where an already speed-adjusted export could inherit the previous source's playback rate. Preview selection now uses the selected timeline segment when a cut is active.

## Draft/history behavior

- The cut list and undo history exist in memory only; closing/navigating away discards unapplied timeline work.
- Apply timeline edits first, then explicitly save the rendered video as a normal device draft. Existing draft quota, expiry, account isolation and plaintext-storage warnings still apply.
- Successful rendering commits a new source file and resets the edit history. Undo is for the current unrendered cut list, not a non-destructive archive across successful exports.
- Multi-file import/combination, timed overlay tracks and persisted project files are not implemented.

## Verification

- **472 automated tests pass, 0 fail** (12 added: seven model/UI tests and five export validation/cleanup tests).
- Native Chromium test `tests/browser/clip-timeline.mjs` creates a real red/blue/green video with a 440Hz audio tone, imports it, splits it, moves green first, removes blue, exercises undo/redo, and speeds up the final red segment. A real saved WebM is then decoded and sampled: green first, red last, audible nonzero source audio. No mocked encoder, microphone permission or remote write is used in that test.
- Latest observed short fixture: approximately 2.99s source → 1.69s output; exported audio RMS approximately 0.131, with 1.68s decoded audio. These are test observations, not a frame-accuracy guarantee. Native seek/encoder timing adds overhead relative to the nominal plan.
- The same browser run verifies unapplied edits block publishing and draft saving, cancellation preserves the cut, and the editor does not overflow at 320/390/768/1440px widths. No page exceptions in that run.
- Camera recording/export, call UI/effects/screen-sharing fixture tests and actual-app Reels regression pass. Reels regression includes basic trim/export and native IndexedDB draft restore/confirmed-publication cleanup. The call fixture is still not proof of remote RTP connectivity.
- Final frozen-input reproducibility check: two independent clean lockfile builds match all 100 output files. Production dependency audit reports zero known vulnerabilities. Credential-pattern results are in the verification JSON. These do not certify every security property or restore a hosted database.

## Build-check observation

One earlier comparison using separately copied live inputs differed only in generated `index.html` and `sw.js`; the root cause was not proved. `scripts/check-reproducibility.mjs` now freezes a single allowlisted source snapshot before copying it into two independent install/build workspaces, rather than rereading live inputs twice. It retains static HTML/worker files and path/hash diagnostics under ignored `test-results/reproducibility` on a future mismatch. Final frozen-input checks pass. This improves provenance and diagnosis; it is not a claim that the earlier transient was conclusively explained.

## Still unfinished / unverified

- Importing and combining multiple files; clip thumbnails/waveforms; crossfades/transitions; frame-accurate editing; timed text, stickers, drawing, music, captions and multi-track mixing; a full-screen professional editor layout.
- Non-destructive project persistence and history across exports/restarts. The current draft path stores the explicitly rendered video, not an editable project.
- Video/audio export support on Safari/iOS/Android WebView, hardware, long durations, every speed/codec, A/V sync, battery/thermal behavior and background/app-switch handling. Keep the app visible while exporting.
- Canvas/MediaRecorder/captureStream support is required for timeline export. Unsupported browsers retain the source and show an error; they do not get a fake successful export or intentionally silent output.
- Concurrent live calling and timeline export performance is not certified. Existing call/TURN/ICE-restart/native-background/real-device acceptance gates remain.
- Photo/Video/Story camera unification, advanced AR/tracking/segmentation, account-backed effect favorites, trusted server media inspection, Reels v2 staging activation and APK release remain pending.

## References checked

- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/pause
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/resume
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/captureStream

Browser compatibility and actual-device acceptance remain separate from these API references.

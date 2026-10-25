# Reel camera / saved-effects continuation

Date: 2026-10-25. Base commit: `3220b69de4fa7d86d80e21adcfaf7090794f19be`. Same development branch as Reels and calling. No production deployment, hosted SQL/configuration, accounts, icon change, new dependency, paid SDK or APK release.

## Built

- **Full-screen Reel video capture:** viewfinder with floating Close/Flip/tool rail, gold-ring white shutter, red recording state, progress and visible Stop. Source frame is fitted rather than silently cropping the saved video. Controls use safe-area offsets and accessible labels/targets; reduced-motion styling is retained.
- **Real saved effects:** `src/capture-effects.js` provides a single stable canvas video track for MediaRecorder. Preset selection updates rendering on this track, rather than switching tracks out from under a running recorder or just decorating the preview. Original microphone audio remains separate and unchanged by the renderer.
- Six existing color looks plus Original reuse the call preset catalog and camera-derived thumbnail/search/favorites interface. Camera IDs are namespaced, avoiding duplicate call-camera effect IDs in the actual app.
- Portrait-friendly rendering: maximum 1280px side and 921,600 pixels, 24fps. No upscaling. Initial capture requests negotiable 720×1280 / 24fps (maximum 30fps), plus speech-oriented audio constraints. These are requests/caps, not hardware or delivered-quality guarantees.
- Camera flip while not recording preserves the selected effect and original microphone. A late acquired camera after cancellation is stopped. Flip is disabled during recording/finalization.
- **Hardware-gated controls:** torch appears only when reported supported with applyConstraints; zoom slider/pinch appears only with a usable reported zoom range. Zoom is clamped and constraint updates serialized/coalesced. Failures show feedback; unsupported features are not represented by fake functioning buttons. Torch is continuous illumination, not a photographic flash.
- **Recording interactions:** tap start/stop; hold begins after 280ms, release finishes, slide upward locks until explicit Stop. Optional 3/10-second countdown; tapping shutter cancels countdown. Recording state remains explicit; shutter/flip are locked during finalization.
- Existing 90-second / 50MB client bounds, import, trim/speed export, audience, explicit publish and device drafts remain. Recording clock/countdown use monotonic time. The captured file includes the selected effects before preview, draft saving or publishing. There is no automatic upload.
- Close discards an active recording only after confirmation. Backgrounding stops/discards capture. Unmount removes the visibility listener, cancels timers/renderer initialization and releases owned sources.

## Defects fixed while integrating

| Issue | File-level fix |
|---|---|
| A delayed recorder completion/timer could operate on a subsequently opened camera | `src/clip-composer.js`: recorder identity, revision and owned-source guards; stop callbacks detached before cancellation; stale timer returns without stopping a new session. |
| Starting again before previous recorder finalization could reuse the same camera unsafely | `src/clip-composer.js`, `src/clip-camera.js`: non-null recorder guard and explicit finalizing control state. |
| MediaRecorder.start failure could leave capture controls stuck | Clear encoder handlers/state, restore controls and allow retry. |
| A blocked live preview could retain acquired media | Acquisition/preview failure stops sources and leaves camera opener retryable. |
| An unmuted file preview could feed live microphone audio back locally on reopening | Reassert muted live preview before assigning the camera stream. |
| Pending renderer initialization could linger after close | `src/capture-effects.js`: abortable startup with bounded timeout, source detachment and owned output cleanup. |
| Preview-only filters would disappear from saved media | Stable, genuinely encoded output stream; actual saved-file pixel verification. |
| Call and camera discovery reused DOM IDs | `src/call-lens-browser.js`: configurable ID prefix; call defaults unchanged. |

## Verification

- **460 automated tests pass, zero failures** (nine added: six renderer/hardware tests and three composer lifecycle tests).
- Native Chromium (`tests/browser/clip-camera.mjs`) uses browser fake camera/microphone input but **real MediaRecorder, canvas video and saved WebM playback**, not a mocked encoder. It verifies no automatic permission request, unsupported hardware controls hidden, flip preserving effect/mic, cancelled countdown making no recording, actual processed video track plus original audio track, nonempty playable monochrome saved file, hold/slide lock continuing after release, no upload, track cleanup and unmount.
- Shutter bounds/screenshots checked at 320×640, 390×844 and 844×390. No page exceptions in this camera browser run.
- Existing native call UI/effects/screen-sharing fixture tests pass after sharing the lens browser. This does not establish remote RTP delivery.
- Reels regression passes, including real trim/export and native IndexedDB draft reload/confirmed-publication cleanup.
- Two independent clean lockfile builds match all 100 output files. Serial workspace build also passes; an earlier reused workspace attempt reported duplicate generated bundles, not reproduced in the final clean checks.
- Production dependency audit: zero known vulnerabilities. Credential-pattern scan recorded in the accompanying verification JSON; neither replaces comprehensive security review.

## Explicit limits / release gates

- **Only the Reel video destination is wired.** This is not yet the unified Photo/Video/Story engine. The existing chat-photo camera remains separate. No dead Photo/Story mode selectors were added.
- There are no face tracking, beauty/makeup, masks, 3D avatars, person segmentation, blur/background replacement, licensed Lens downloads, musical catalog, focus/exposure tap controls or AR rendering models in this increment.
- Favorites remain session-only. No camera preference cloud sync, lens downloading or account-backed favorites.
- Hardware torch/zoom, physical touch gestures and front/rear switching need actual Android/iOS/WebView acceptance. Some devices may reject acquiring another camera before the first is released; failure recovery needs device testing. Concurrent in-call capture/hardware handoff is not certified.
- Saved-file verification covers a short monochrome capture. It is not exhaustive long-duration, every-preset, thermal/battery, all-codec, A/V-sync or GPU-loss testing.
- If color rendering is unsupported at initialization, the effects control is hidden and original-camera recording remains available. An active renderer failure stops/discards capture; it does not silently switch a filtered recording to raw camera.
- Countdown cancellation and native permission denial/lifecycle are guarded in code/tests, but real system permission-picker UX still needs device acceptance.
- Preview after recording still uses the existing trim/speed form. Multi-clip timeline, split/reorder, timed text/stickers/audio, undo/redo and advanced export are not built.
- Server-side trusted duration/media inspection, staging activation of Reels v2, successful two-network calling, native background calling and APK release remain pending. Client recording bounds are not authoritative server validation.

## References checked

- https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities
- https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/applyConstraints
- https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints

These support capability-driven hardware controls, not a promise that every phone/browser implements them.

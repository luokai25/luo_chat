# Live calls and effects — development readiness

Check date: 2026-10-25. Base: `82b83d1c18d322b598d17194465f3ad677b28d44`.

Continuation: screen sharing and additional media-transition fixes are now implemented on the same development branch. See `docs/SCREEN_SHARING_READINESS.md` for the newer scope and verification; the results below describe the initial effects increment.

Scope: the existing Reels development branch, not production web, hosted SQL, account configuration or a published APK. This deliberately groups the Reels work and the first calling/effects increment in one development update. **This is not the full requested AR engine, nor a production-ready calling certification.** No new package, vendor credential, paid plan or cloud resource was added.

## Built in this increment

- `src/call-effects.js`: browser-native, actual outgoing canvas video. Six color presets plus Original: Luo Gold, Warm, Vintage, Film, Monochrome, Dreamy. The existing WebRTC video sender is replaced with the processed track; microphone audio is not run through the canvas. Preview uses that same processed track. Explicit Original returns to the camera track.
- Rendering is capped at 1280×720 and 24 fps, preserving aspect ratio. Original keeps the existing negotiable 1920×1080 / 30 fps request. These are upper bounds, not promises of delivered resolution. Browser support/performance varies; canvas processing is not a hardware-encoding or GPU-acceleration guarantee.
- `src/call-experience.js`: in-dialog effects carousel; slide-in, downward header-drag dismissal, close/Escape, keyboard navigation, pressed states, reduced-motion styling and 44px targets. Effects do not replace the call page or pause microphone audio. Draggable/arrow-key self-preview; full remote frame by default, optional Fill screen. A visible Play call audio button handles blocked autoplay without native player chrome.
- Local Hold pauses sending microphone/camera; resuming retains prior mute/camera choices. It is not a remote hold protocol. Browser audio output chooser is used only on explicit action where supported; otherwise the user is directed to OS Bluetooth/speaker controls.
- Effects survive camera switching. Camera-off and Hold disable the actual processed sender as well as the source. Signout, lock, end and abandoned permission requests retain existing cleanup behavior. Closing while an effect change is pending releases both old and pending renderers.
- Renderer failure disables the processed video, shows a status, and asks for explicit Original restoration. It does not silently start sending unfiltered camera frames. A failed new selection keeps the previous effect.
- `src/call-recovery.js`: keep the current session open for a bounded 30-second disconnected/failed grace period; show Reconnecting; cancel expiry when connectivity returns; release timers on close/account change. This does **not** implement ICE restart or guarantee recovery after an interface/NAT change.
- `src/call-quality.js`: existing audio-priority/adaptive video budgets retained. Added ephemeral on-screen RTT, inbound jitter, reported video loss and direct/relay category. Missing data says unknown. No IP addresses, SDP, audio or video are logged by this diagnostics path.
- `public/luo-call-quality.css`: black/gold immersive layout, safe-area PiP, carousel, focus states. `public/luo-mobile-stability.js` suppresses its legacy speaker button when the new engine owns routing.

## Requested capabilities still pending

| Requirement | Status and next requirement |
|---|---|
| Professional audio/video on actual phones | Existing WebRTC foundation and synthetic tests only. Need two-device calls, Bluetooth/headset routing, poor-network and battery/thermal acceptance. |
| Reliable networks requiring relay | Existing authenticated `/api/call-config` accepts configured TURN. No relay was provisioned or verified; STUN alone cannot cover all networks. Free-only requirement remains. |
| Fast recovery across network changes | Grace period built. ICE-restart offer/answer protocol, bounded retry, glare handling and signaling authorization tests still required. Do not blindly call `restartIce()` without a signaling path. |
| Face-tracked beauty/makeup/eye colors/tattoos | Not implemented. Need version-pinned local tracking runtime/models, license checks, consent and real-device accuracy/performance tests. |
| Person/background blur or replacement | Not implemented. Color filters are not segmentation or a virtual background. Need tested segmentation/matting and compositing. |
| 3D masks and expression-driven avatars | Not implemented. Need original/licensed assets, landmark/blendshape tracking and rendering. |
| Heart-hand or waving effects | Not implemented. Need hand tracking, confidence/debounce rules, opt-in animation and reduced-motion handling. |
| Snap Camera Kit / DeepAR | Not installed or configured. No account signup, key extraction, lens licensing or terms acceptance performed. Camera Kit needs developer setup; its capture canvas, not preview-only output, must feed the sender if integrated. |
| Native background/ringing/locked-phone calls | Not built by this browser change. Needs Android foreground call service, notifications/audio focus and lifecycle integration; web background timers/camera may suspend. |
| Screen sharing | Implemented in the subsequent development increment; explicit permission, restoration and ended-track coverage are detailed in `docs/SCREEN_SHARING_READINESS.md`. Real-picker/device and remote-network acceptance remain pending. |
| In-call chat and add participant | Pending UI/state flow. Current transport is one-to-one. Group calls require a separate architecture and capacity/cost decision. No decorative Add button was added. |
| Recording | Not implemented. No hidden recording. A future implementation needs consent from all participants, visible indicators and retention/export controls. |
| Full Reels wish list | Still tracked in `docs/REELS_V2_READINESS.md` and `docs/CLIP_DRAFTS.md`; this increment does not finish the editor/music/camera/discovery backlog. |
| APK and production activation | Not performed. Reels v2 SQL is still an unapplied proposal requiring staging validation and approval. |

## Verification and limits

- Automated build + unit suite: 428 tests passing in the development release check. Includes nine new renderer/recovery tests and two call-control tests. Existing auth, stories, settings and configuration byte-preservation checks remain; calls were explicitly removed from the old Social-only byte-freeze because the user now authorized calling changes. They retain behavioral regression coverage.
- `tests/browser/call-effects.mjs`: native Chromium camera fixture and real `canvas.captureStream` frames. Actual sender selection (transport fixture), shared preview track, unchanged audio identity, monochrome pixel content, processing dimensions, camera-off, Hold, camera switch, Original restoration and cleanup. Layout sizes 320×640, 390×844, 844×390 and 1440×900. **This does not prove remote RTP delivery.**
- `tests/browser/social-feed.mjs`: existing Reels interactions, actual trim/export, recipient/follow fixtures and native IndexedDB draft reload/publication-cleanup regression pass. No hosted data writes.
- Native two-peer test (`node tests/call-quality-browser.cjs`) is **blocked/unverified in this environment**: caller and callee gathered zero candidates; a separate minimal native data-channel peer test likewise gathered zero candidates and remained `new`/`gathering`. No browser safety/network protections were bypassed and no fake transport was substituted to report success.
- Clean lockfile reproducibility, dependency audit and credential-pattern results are recorded in `verification/live-call-effects-20261025.json` after final verification. These do not certify every security property or a hosted database restore.

## Technical references checked

- Snap setup/capture-vs-live output: https://developers.snap.com/camera-kit/integrate-sdk/web/web-configuration
- MediaPipe web face tracking, including synchronous inference/main-thread warning: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
- Browser outgoing track replacement: https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack
- Canvas video output: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream
- Browser output-device selection: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput

MediaPipe is a possible free local tracking foundation, not a completed filter library. Any next implementation should keep inference off the UI thread, throttle work, and make model acquisition explicit. No Snapchat-quality AR claim is justified by the current color-only renderer.

# Immersive calling UI continuation

Date: 2026-10-25. Base: `4997a101916608cd39bb74b44b2a94c55950e797`. Development branch only, alongside Reels, color effects and screen sharing. No production, hosted SQL, account changes, paid SDK, new dependency or APK release.

## Implemented from the expanded specification

| Requirement | Implementation |
|---|---|
| Video-first screen | Full-viewport remote media with cover scaling by default; Fit Video / Fill Screen toggle in More. No large permanent lower panels. |
| Compact floating dock | Five existing functional controls: microphone, audio output, camera, flip, effects. Small-area translucent/blurred dock. End Call remains separately red. Narrow-portrait and landscape layout checks. |
| Floating header | Minimize, call identity, More, actual connected-call elapsed duration and connection indicator. Unknown delivered resolution is not labeled HD. Weak-network status uses available RTT/loss observations. |
| Secondary sheets | More contains implemented Hold, Fit, screen sharing, autoplay recovery where needed and diagnostics. Drag-down/Close/Escape; dock swipe-up opens More. Effects stays in the call. No working-looking controls for unavailable recording, groups, captions or blur. |
| Self-preview | Gold-edged rounded PiP, pointer/keyboard movement, safe bounds and corner snapping; tap/Enter enlarges, double tap resets. Shared-screen preview fits rather than crops. Physical-device gesture acceptance remains pending. |
| Minimized call | Native dialog closes without ending media; mini-call chip provides identity/time, restore and End. Async close events are consumed safely, including restore-before-close-event races. App lock/signout still terminate media and clear identity. This is web UI minimization, not native OS background-call support. |
| Remote camera-off/Hold | A bounded peer-scoped WebRTC data channel communicates video/hold state. New peers show the avatar/name immediately instead of retaining video when disabled. Track mute/end and a four-second decoded-frame-stall fallback also hide unavailable video. Legacy peers cannot provide explicit state; network/device behavior is not certified. |
| Profile identity | Existing validated avatar renderer, with profile supplied by the matching conversation in `src/suite.js`. Initials when no allowed cached image exists. Never substitutes the currently open unrelated chat's photo. |
| Incoming/outgoing foundation | Full-screen identity/avatar, subtle ringing ring, green Accept/red Decline; capture still requires explicit Start/Accept. No elapsed timer before WebRTC connection. Native media elements are retained across states. |
| Actual effect thumbnails | Local source-camera snapshots processed with the same seven bundled presets (Original plus six color looks), not stock pictures of nonexistent AR effects. No new media permission, upload or persistent face snapshot. Thumbnails are cleared when closed/stopped. |
| Effect discovery | Quick horizontal carousel; expanded three-column view, text search, All/Cinematic/Luo Exclusive categories and session-only favorites. No advertised downloads, face masks or beauty sliders without an engine behind them. |
| Installed-PWA asset updates | Call CSS now has a byte-derived filename in `build.mjs` and is part of the offline shell. Final cache revision includes emitted HTML asset references; verification checks the CSS name against bytes. Manifest identity/icons unchanged. No deployed PWA was modified. |

## File-level changes

- `src/call-shell.js`: overlay layout, timer, minimization lifecycle, avatar/remote placeholder, secondary controls and icon decoration.
- `src/call-media-state.js`: one exact-label, ordered peer control channel, strict small JSON payloads, only video/hold booleans, bounded buffering, stale-session guards and cleanup. This is not an authenticated identity-verification or new E2EE claim.
- `src/call-lens-browser.js`: source-derived thumbnails, bounded 2fps updates only while visible, bundled search/categories and per-call favorites. No arbitrary effect URLs, downloads or external SDK.
- `src/call-experience.js`, `src/calls.js`: lifecycle integration. Minimized calls retain session validity, but account/lock/epoch guards remain. Same outgoing sender processing and screen-sharing restoration.
- `src/suite.js`: matching-conversation profile lookup only.
- `src/call-effects.js`: failed pre-activation effect rendering no longer reports an unrelated previous source as disabled; a failed active source remains paused.
- `public/luo-call-quality.css`: scoped overlay rules, floating dock, accessible targets, ring/focus/reduced-motion, lens discovery and mini-call chip.
- `build.mjs`, `scripts/revision-mobile-stability.mjs`, `scripts/verify-build.mjs`: content-addressed call styles and cache invalidation.

## Verification

- **451 automated tests pass, 0 fail**. Added four call-lifecycle tests, five control-channel/duration tests, and two lens-browser tests to the preceding 440.
- Native Chromium with real camera/canvas rendering but **fixture transport, peer-state channel and display chooser**: minimize/restore keeps source audio live; peer camera-off replaces video with placeholder; More/Escape leaves dialog connected; search and session favorites work; screen sharing/restoration and prior color checks remain passing.
- Layouts: 320×640, 390×844, 844×390 and 1440×900. Five-control dock stays within viewport and below 110px height. Cover scaling asserted. No page exceptions in this browser run.
- Two independent clean lockfile builds: 100 output files match byte-for-byte, including the hashed call stylesheet. Reels browser regression passes, including real trim/export and native IndexedDB draft reload/publication cleanup.
- Production dependency audit: zero known vulnerabilities. Credential-pattern scan recorded separately. Neither establishes a full security certification.
- Existing broad-suite JSDOM fixtures still emit legacy mobile-helper teardown / unsupported-media diagnostics while tests pass. They are not evidence of a live-browser failure, nor silently treated as a clean console certification. The new call-only browser run has zero page exceptions.

## Still unfinished from the user's specification

1. Face tracking, beauty/makeup, segmentation/background blur/replacement, masks/3D avatars, gesture effects, authorized downloadable Lenses, adjustable AR properties and provider attribution/download management.
2. Persistent account-backed effect favorites. Current favorites exist only within the call and are cleared on stop/signout.
3. Unified Photo/Video/Story camera engine, hardware flash, zoom/focus/exposure gestures, recording lock/countdown and capture settings. Existing clip composer is not this complete new camera.
4. Full multi-track editor, timed stickers/text/music/captions, split/reorder/add clips, undo/redo and final-export parity for advanced effects.
5. Incoming quick replies and audio-only answer to a video offer; consented voice-to-video upgrade. No peer camera is activated automatically.
6. In-call chat, Add Participant, adaptive group grid/speaker filmstrip, pinning and simultaneous screen-plus-camera transport. Current engine remains one-to-one and replaces its video sender for screen sharing.
7. Consented recording, actual live captions, manual video-quality preferences, audio-reactive voice ring and report-upload workflow.
8. Native call notifications/audio focus/foreground service, locked/background calling, actual Bluetooth/headset routing, camera hardware acceptance and APK build/release.
9. ICE restart/glare-safe renegotiation, TURN availability and successful cross-network two-device calls. Earlier native RTP testing was blocked by zero ICE candidates; fixture tests here do not clear that gate.
10. Remaining Reels backlog and approved staging activation of its new backend proposal.

The UI is substantially upgraded; the complete camera/AR/editor/group calling system is **not finished or production-ready**.

## Technical references checked

- https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/close
- https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/mute_event

The peer-state channel complements, rather than assumes, the track mute event: remote user camera-disable state is not reliably conveyed by a local track's `enabled` flag alone.

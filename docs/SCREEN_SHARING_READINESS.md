# Screen-sharing continuation

Date: 2026-10-25. Base commit: `ae21f2983e65edf67d8ebb14a6414d84e6f72475`. Same development branch as Reels and live color effects. No production, hosted Supabase, account, TURN provisioning or APK release changes.

## Implemented

- `src/call-screen-share.js`: explicitly requested display capture, replacing the existing outgoing **video** track. No microphone request, system audio, recording or upload. Any unexpectedly returned display audio is stopped and excluded. Original microphone track and mute state stay separate.
- Share screen is offered only when a browser exposes `getDisplayMedia`, in a video call. Starting is disabled until connected. The browser's chooser remains responsible for the user's permission/source selection; the app cannot grant this permission or choose a screen silently.
- A persistent sharing indicator and Stop sharing action; local preview shows the selected screen without cropping it. Hold and video-pause disable the actual outgoing display track. The source camera and effects output are paused while sharing.
- Stop sharing or an OS `ended` event stops display capture immediately and restores the **exact previous processed camera track**, not a raw-camera fallback. Mute, camera-off and Hold choices are retained. Resuming video cannot re-enable a failed renderer.
- If restoration fails, capture stays stopped, a visible status explains the failure, and Retry camera is offered. No new camera permission is requested automatically. User can always end the call.
- Permission refusal leaves the camera call unchanged. A late permission grant or late sender replacement after close/signout cannot revive capture or update a new call.
- Sharing, effects selection and camera switching are mutually excluded. An explicit camera-switch lock covers the whole permission request, so a connection-state event cannot accidentally unlock Share screen mid-switch.
- Share labels/indicators reset on call end. Camera-pause and microphone controls now keep their accessible names consistent with their actions, including shared-video pause/resume.

## Verification

- Build and automated suite: **440 passing, 0 failing** (428 previously, 12 added tests).
- Ten new screen-session tests cover explicit permission, audio exclusion, cancellation, late grants, late sender replacements, OS end including a replace race, replacement rejection, restoration failure/retry, pause state, serialization and stale-session guards.
- Two integrated call-control tests cover camera-picker/state-event overlap and muted/camera-off restoration. The sender fixture now models repeated `replaceTrack` calls correctly.
- Native Chromium integration (`tests/browser/call-effects.mjs`) uses real camera/canvas tracks and a **synthetic display chooser and sender/signaling fixture**. The selected outgoing screen track produces the expected blue pixels in a consuming video; processed camera identity is preserved across sharing; mic identity/state, Hold, video-pause, cancellation and simulated OS Stop restore correctly. It also retains the initial live-color checks and verifies 320×640, 390×844, 844×390 and 1440×900 layouts with no page exceptions.
- Existing native Reels browser regression passes, including actual trim/export and IndexedDB draft reload/confirmed-publication cleanup.
- Two independent clean lockfile builds, credential-pattern scan and dependency audit results are recorded in `verification/screen-sharing-20261025.json` once checked. These are not a full security certification.

## Not verified / not delivered

- **No successful remote RTP session is claimed.** The earlier native two-peer test was blocked by zero ICE candidates in this environment. This continuation tests source selection/rendering and control logic without substituting a fake success for network transport.
- No real desktop screen chooser, mobile browser, Android WebView, Bluetooth headset, physical camera switch, cross-network TURN relay or locked/background call acceptance was performed. Browser screen capture is not universally supported; hiding the action on unsupported platforms does not add native Android screen capture.
- Screen sharing occupies the existing video sender: it is not simultaneous camera-plus-screen transmission. The paused camera track remains allocated for restoration; this is not a guarantee that the physical camera device is released.
- Sharing can reveal sensitive screen content. The user must choose the source carefully; UI warnings cannot prevent accidental disclosure within that source. Stop ends capture, not copies already seen by the recipient.
- No shared system audio, annotation, remote desktop control, screen recording or automatic screen resumption after app restart.
- Face tracking, beauty/makeup, segmentation/background replacement, 3D avatars, hand gestures, native background calling, in-call chat/group calls, consented recording, ICE-restart signaling and the remaining Reels editor/discovery backlog are still pending. No paid SDK/model was added.

## References checked

- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
- https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack
- https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event

These support the explicit chooser, track-replacement and source-ended design. Browser compatibility and hardware behavior still require the acceptance tests above.

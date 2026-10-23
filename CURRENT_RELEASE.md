# Current reliability and call-quality fixes

Latest social update: clickable profile cards/photos, incoming and outgoing friend requests, approvals and removal, and blocking wired to the backend. See [SOCIAL_FEATURES.md](SOCIAL_FEATURES.md) for behavior, migrations and test evidence.

The subsequent security/reliability review is in [HARDENING_REPORT.md](HARDENING_REPORT.md). Its database and worker changes supersede the frontend-only scope below.

The current source includes signed-out route guards, scoped navigation bindings, mobile screen-switch stability, and removal of legacy app controls from the sign-in screen.

Calls now request up to 1920 × 1080 at 30 fps when supported. Microphone capture requests echo cancellation, noise suppression and gain control. Sender configuration gives audio high priority and video an initial 4.5 Mbps ceiling; this is a ceiling, not a forced minimum. Browser congestion control remains active. Repeated loss, round-trip delay, limited bandwidth or CPU pressure lower video load; sustained recovery restores detail gradually. Camera switching reapplies the same capture and sender settings. Remote video fits the frame without cropping or magnification, and the video-call controls avoid costly backdrop blur. Signaling polls every 750 ms; this affects setup responsiveness, not the media transport latency.

## Verification

The complete automated release gate includes cleanup worker tests again. Run `npm ci --ignore-scripts` and `npm run release:check` under Node 24. No tests are excluded.

Run `npx playwright install chromium` followed by `node tests/call-quality-browser.cjs` for the two-peer Chromium fixture. It uses actual WebRTC transport, synthetic camera/microphone devices and a local signaling fixture. The checked run captured 1920 × 1080, transmitted and decoded video, received audio RTP, applied the 4.5 Mbps ceiling, muted/unmuted, switched camera and closed both peers without JavaScript errors. Initial encoded frames were 640 × 360 during browser startup adaptation; HD capture is not a guarantee of HD delivery. This fixture does not validate hosted Supabase signaling, physical cameras or mobile networks.

## Relay configuration and remaining checks

The current deployment has no configured TURN relay. `api/call-config.js` supports server-only `LUO_TURN_URL`, `LUO_TURN_USER` and `LUO_TURN_PASSWORD`. Provision a TURN service, add its credentials to protected Vercel environment settings, then redeploy. Never commit relay passwords. The endpoint validates the signed-in user before returning call configuration.

Physical-device calls on Wi-Fi and cellular, long calls, congested links and restrictive networks still need acceptance testing. Resolution, sound quality and delay depend on hardware, browser and network conditions; zero delay cannot be guaranteed. No database migrations or hosted auth configuration were changed by this frontend fix.

## Repository contents

The repository includes the current frontend and API source, build scripts, tests, icons/stickers, all recovered project documentation, schema reference, migration history and Supabase function source. It excludes dependencies, generated build/test outputs, credentials and private user content. Migrations are incremental history, not a verified complete database backup; do not apply them blindly to a blank project. Historical release/readiness documents retain their original context.

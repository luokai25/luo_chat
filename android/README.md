# Luo Chat Social Test APK

This is an Android testing build, not a Google Play release. The APK is compiled and debug-signed by GitHub-hosted Actions from the reviewed source branch, then published as an Actions artifact and GitHub prerelease download. Building the app does not require Vercel deployment or a paid database.

## Contents

- The GitHub social-preview web bundle, embedded directly inside the APK
- Chats, groups, Story Studio, chat effects, Time Capsules, Friends Feed, Clips, Communities, Notes, shared media sessions, social profiles, 3D companions, and Memory Constellations already included in the Social branch
- Poll and quiz stickers that activate only when their private backend functions are deployed
- Android file chooser and explicit microphone/camera system permission prompts
- Outside music and website links open in the device browser

This wrapper uses a strict HTTPS local-asset handler for the official Luo Chat origin, including service-worker requests, and does not include privileged Supabase credentials or bypass browser security checks.

## Backend limits

The APK does not deploy database migrations. New interactions work only if the existing Supabase backend has their corresponding functions and permissions. Story polls automatically hide when the server lacks their RPC. Clips and private media use the existing storage policies. Spotify and YouTube URLs do not grant licensed streaming. Snapchat-grade AR camera filters, native closed-app notifications, and PiP video calls are not delivered in this test shell.

## Install and test

1. Open the latest GitHub prerelease named Luo Chat Social Android Test, or the matching green GitHub Actions run.
2. Download the APK named luo-chat-social-test.apk. Optionally compare its SHA-256 with the included .sha256 file.
3. Review Android's app installation prompts. Never disable Play Protect.
4. Launch Luo Chat Social Test and sign in using your own Luo Chat account. Features requiring undeployed backend migrations remain unavailable.
5. Grant microphone or camera permission only when you explicitly start a recording or a call.

The Android package is com.luoscreations.chat.socialtest, separate from the normal production application. GitHub's free runners produce different debug signing keys for each build. To install a later test build, Android may require uninstalling the prior test build. That clears local-only data; server-synced chats remain on the backend.

## Release validation

The workflow runs the full web release checks, dependency audit, and Story interaction tests, compiles a signed debug APK, checks its bundled assets and signing, uploads a checksum, and creates a GitHub prerelease. A separate free PostgreSQL workflow verifies Story privacy and voting rules.

These automated checks do not replace physical Android, push, WebRTC, and two-account acceptance tests. No payments, Play Store bypasses, or Google signing keys are involved.

## Social redesign beta

Version 1.0.0-beta.8 removes the retired Luo Core cat overlay and GLB from the APK. Social uses a compact black-and-gold Friends/Public feed and full-height Clips with inline reactions, saves, profile navigation, photo albums and a comments sheet. The + button opens post or clip creation; Explore more retains the other social tools. New photo posts are validated before upload. No production deployment or new backend migration is performed by this build. Browser evidence uses synthetic data; existing live signup/recovery and physical-device limitations above still apply.

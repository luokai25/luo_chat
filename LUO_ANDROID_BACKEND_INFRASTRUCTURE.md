# Luo Chat Android + Supabase, free-only infrastructure

Development branch: feature/social-android-test-20261023. Date: 2026-10-23.

## Backend verified
- Supabase project: luo-chat, free existing infrastructure only.
- Live Edge function luo-auth version 5 supports username/password sign-in for existing accounts. The compatibility endpoint preserves existing email-based website flows until migration.
- Live non-sensitive capabilities response: username_signin=true, username_signup=false, username_recovery=false. This is intentional because a protected database recovery migration has not been applied.
- Android signup and recovery are guarded by these flags and fail closed on a network error. Existing-user sign-in does not need a capabilities request at startup.
- Free GitHub Actions live smoke tests verify a nonexistent username returns 401 (not a service outage), and that the backend accurately reports unavailable signup/recovery.
- The Supabase project itself reports ACTIVE_HEALTHY, but its connected SQL management API is timing out. That prevents claiming recovery-code registration is installed.

## Android release infrastructure
- The APK packages the full tested Luo Chat web assets inside Android, rather than loading Vercel's stale frontend.
- The secure Android host provides actual file selection, camera/microphone permission prompts, video full-screen mode, HTTPS private-media downloads, Share into a selected chat as an unsent draft, and SPA-aware Back navigation.
- Native notifications contain no message previews on the lock screen and are rate-limited. Native downloads are limited to six per five minutes.
- If the WebView renderer crashes, a native Reopen Luo Chat screen replaces a sudden Activity termination.
- Cookies and local storage remain sandboxed in the Android app, and backups of session storage are disabled. No service-role credentials or Google sign-in secrets ship in the APK.
- GitHub Actions builds an Android debug-signed beta, verifies the APK and checksum, and publishes a GitHub prerelease only after JS, dependency and Android build checks pass.
- A separate emulator workflow boots a real Android device image and checks username login controls, branding, and the manifest's minimal permissions.

## Release blockers
1. The legacy user login requires real two-account Android-device acceptance tests beyond mocks and a nonexistent-user backend smoke check.
2. New no-email signup requires the pending username recovery-code/rate-limit SQL migration and protected direct signup gate. Do not delete users or old email identities in advance.
3. Advanced Story polls/quizzes require a separate database migration before they can be enabled.
4. Native closed-app push, every-network WebRTC calls, licensed Spotify playback and Snapchat-quality AR filters are NOT guaranteed by this APK.
5. Paid AI bot accounts and merchant payment activation are deliberately isolated in their own unmerged draft.

## Costs and keys
- Do not create paid Supabase projects, paid staging branches or Vercel deployments.
- Public GitHub Actions workflows and disposable PostgreSQL fixtures are used for free testing.
- The Android beta uses the separate application package com.luoscreations.chat.socialtest, signed with an ephemeral debug keystore. On some installs users must uninstall a previous beta before a new beta can be installed. A true stable production update requires a privately stored signing keystore in encrypted GitHub Actions Secrets. Never commit such a keystore to this public repository.
- Do not disable Google Play Protect or bypass OS permission prompts.

Validation beats optimism: published GitHub releases are beta packages, and successful compilation alone does not certify every unfinished feature.

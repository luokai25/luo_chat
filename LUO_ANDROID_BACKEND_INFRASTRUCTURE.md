# Luo Chat Android + Supabase, free-only infrastructure

Development branch: feature/social-android-test-20261023. Updated: 2026-10-24.

## Current account flow
- Per the owner's instruction, the APK retains email/password login, including Gmail addresses. It uses the same Supabase Auth sign-in method as the current website.
- Public usernames remain profile/chat identifiers. No account emails or identities are removed or converted by this release.
- Existing signup, password-reset and confirmation-resend actions use the protected email backend, including its rate limits and email confirmation behavior.
- The client no longer calls the username-login action or waits for username capability flags. Pending no-email migrations are not requirements for this email/password release and remain unapplied.
- The previous username endpoint returned HTTP 503 in live checks. It is not a dependency of restored email/password sign-in. The existing website health proxy also reported an auth warning before the Social deployment.
- New free CI checks exercise the live email Auth token endpoint using a nonexistent reserved-domain email. A passing check proves credential verification is reachable, not that a real account, signup delivery or recovery delivery has been tested.
- Browser checks cover the real login/signup/recovery UI with a synthetic backend; native emulator checks assert the packaged email/password fields and minimal permissions.

## Android release infrastructure
- The APK packages the full tested Luo Chat web assets inside Android, rather than loading Vercel's stale frontend.
- The secure Android host provides actual file selection, camera/microphone permission prompts, video full-screen mode, HTTPS private-media downloads, Share into a selected chat as an unsent draft, and SPA-aware Back navigation.
- Native notifications contain no message previews on the lock screen and are rate-limited. Native downloads are limited to six per five minutes.
- If the WebView renderer crashes, a native Reopen Luo Chat screen replaces a sudden Activity termination.
- Cookies and local storage remain sandboxed in the Android app, and backups of session storage are disabled. No service-role credentials or Google sign-in secrets ship in the APK.
- GitHub Actions builds an Android debug-signed beta, verifies the APK and checksum, and publishes a GitHub prerelease only after JS, dependency and Android build checks pass.
- A separate emulator workflow boots a real Android device image and checks email/password login controls, branding, and the manifest's minimal permissions.

## Release blockers
1. The legacy user login requires real two-account Android-device acceptance tests beyond mocks and a nonexistent-user backend smoke check.
2. Live signup and recovery delivery still need account/device acceptance; do not delete users or old email identities.
3. Advanced Story polls/quizzes require a separate database migration before they can be enabled.
4. Native closed-app push, every-network WebRTC calls, licensed Spotify playback and Snapchat-quality AR filters are NOT guaranteed by this APK.
5. Paid AI bot accounts and merchant payment activation are deliberately isolated in their own unmerged draft.

## Costs and keys
- Do not create paid infrastructure. APK builds do not deploy Vercel; the selectively approved web release is separate.
- Public GitHub Actions workflows and disposable PostgreSQL fixtures are used for free testing.
- The Android beta uses the separate application package com.luoscreations.chat.socialtest, signed with an ephemeral debug keystore. On some installs users must uninstall a previous beta before a new beta can be installed. A true stable production update requires a privately stored signing keystore in encrypted GitHub Actions Secrets. Never commit such a keystore to this public repository.
- Do not disable Google Play Protect or bypass OS permission prompts.

Validation beats optimism: published GitHub releases are beta packages, and successful compilation alone does not certify every unfinished feature.

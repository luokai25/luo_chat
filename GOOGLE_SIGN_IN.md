# Google sign-in activation

The application integration is built. The live Supabase public settings endpoint currently reports `external.google = false`; no Google consent/return flow has been verified end-to-end.

## One-time owner configuration

1. In Google Auth Platform, use the intended Google Cloud project and create a **Web application** OAuth client. Brand the consent screen as Luo Chat. Request only `openid`, email and basic profile information; do not request Gmail, Drive or offline access.
2. Authorized JavaScript origin: `https://luo-chat-luokai25.vercel.app`
3. Authorized Google redirect URI: `https://byjixqwpjvsgmqilmzbm.supabase.co/auth/v1/callback`
4. In Supabase → Authentication → Sign In / Providers → Google, enter the client ID and secret directly into the provider settings and enable Google. Keep nonce checks enabled. Never copy the client secret into frontend code, this archive, chat, or a public build variable.
5. In Supabase URL Configuration, keep the existing recovery/confirmation redirects and add this exact app return URL: `https://luo-chat-luokai25.vercel.app/?auth=google`. The Site URL must point to the intended live app. Do not broadly wildcard unrelated domains.
6. Respect Google's audience/test-user, domain, branding and privacy-policy requirements before public OAuth launch. Google's Safe Browsing phishing warning remains a separate unresolved blocker; do not bypass it for sign-in testing.

## Runtime behavior

- The button stays disabled until the public provider settings confirm Google is enabled. Retry can recheck availability without exposing provider configuration to visitors.
- The app starts `signInWithOAuth` with minimal identity scopes and an account chooser, validates the returned Supabase authorization destination, then performs a full-page redirect. Google passwords are entered only on Google's page.
- Supabase's existing browser session/callback handling completes sign-in. Existing verified-email identity linking is handled by Supabase, never by client-side email matching.
- Existing database triggers create a valid generated Luo Chat username and default settings for a new Google account. Change the username/display name in Settings. A rolled-back Google-metadata trigger test passed; no test account was retained.
- Google profile photos are not imported automatically. Upload a profile picture in Luo Chat if desired.
- Password-based screen locking and account deletion still require a Luo Chat password. A Google-only user can set one under Settings → Account; Google passwords must never be used in Luo Chat inputs.
- Existing password and email-recovery flows remain available. This release uses the application's existing Supabase browser OAuth/session flow, not a new server callback or a shared Google client secret.

## Activation validation

After the warning is resolved and provider settings are saved, reload the app, confirm the button enables, then test Google cancellation, first-time account creation, returning sign-in, profile creation, signout, a verified-email existing account, and the installed PWA return flow on a real phone. Provider configuration, consent approval and real-device end-to-end sign-in remain unverified until these checks pass.

Official guide: https://supabase.com/docs/guides/auth/social-login/auth-google

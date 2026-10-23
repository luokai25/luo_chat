# Luo Chat: safe username/password authentication migration

Status: SECURITY DESIGN AND POLICY TESTS ONLY. NOT DEPLOYED. Existing production continues using Supabase email/password. No live account data has been altered.

## Account and UX contract
Sign up with username, 12-128 character password and confirmation. No personal email or email confirmation. Sign in from multiple devices with username and password. Preserve every existing Supabase auth.users.id, conversation, existing login password and profile. No simultaneous-device limit.

No-email accounts receive 10 one-time printable recovery codes, shown once and acknowledged at registration; future opt-in passkeys may improve recovery. Without password, recovery codes or an enrolled passkey, self-service recovery must not grant access. Existing email accounts retain email recovery until the owner enrolls alternate recovery and opts out.

## Auth and account architecture
Use Supabase Auth as the only JWT/session/password verifier. Never invent homemade tokens, JWT signatures or passwords.

1. An audited server-side Supabase Edge Function accepts register/login/recover/rotate_codes over HTTPS. Request bodies are bounded and private. Enforce exact allowed origins and real backend authentication.
2. Every new registration requires validated Cloudflare Turnstile Managed challenge on the server; validate hostname, action, single-use and five-minute expiry. Server-only secret; no bypass when challenge service is unavailable.
3. Enforce atomic per-IP, per-username and risk-scored device counters (Upstash Redis plus existing database RPCs); fail closed for new registration when protections cannot be evaluated. Use only platform-verified client IP; do not trust an arbitrary client X-Forwarded-For header. Use username uniqueness + advisory lock against concurrent registrations.
4. Generate immutable random UUID identity and non-deliverable internal email luo-UUID@accounts.invalid; the mapping must never be returned publicly and never derive from username. Use the Supabase Admin createUser API server-side with email_confirm true. This is an Auth-only implementation detail, not an actual mailbox. Maintain strict server-only mapping between username and Auth identity. Enforce unique usernames and safe username changes atomically.
5. Generate ten CSPRNG recovery codes on server and HMAC-SHA-256 hash them with a separate secret; store only per-user digests, one-use status and audit timestamps. Never store plaintext codes. Display them exactly once using Cache-Control: no-store and require user acknowledgement. Fail closed if recovery initialization fails. Handle partial Auth-user creation via compensating cleanup/quarantine.
6. Login must resolve a username server-side, using a privileged server-only identifier mapping, then call Supabase Auth signInWithPassword. Never make public RPCs exposing an email alias. Return normal Supabase tokens only on successful password verification. Browser sets Supabase session, uses the normal refresh flow and preserves security isolation. Unknown usernames and bad passwords return identical generic errors, with dummy timing behavior to reduce account enumeration.
7. Account recovery: username, one unused code, new password, a fresh challenge and strict rate limits. Verify HMAC, atomically consume code once (lock/transaction), use Admin updateUserById to update password and revoke appropriate existing sessions. Because Auth calls and DB rows are not a single transaction, use a reservation/outbox protocol with safe retries and rollback on failure. Rotate to a new set of recovery codes. Never permit recovery based solely on device ID.
8. Preserve the original Auth IDs and existing email associations for existing users; allow username login to privately resolve their current Auth email without exposing it. Never automatically change legacy emails or confirm unverified accounts without proof of account ownership. Keep dual login for migration until recovery enrolment is complete.
9. Shut down registration bypasses: old luo-auth signup action and direct public Supabase signUp must be denied or routed through a correctly configured Before User Created Auth hook. **Context7's Supabase Auth source confirms the hook does not run for admin.createUser**; therefore every administrator-side registration route also needs its own strict server-side challenge, rate limits and authorization checks. Hiding a signup button cannot enforce this; verify both direct REST signups and admin-created users in staging before activating the replacement.

## Compatibility findings from Context7
- Supabase JS v2 signInWithPassword accepts an email or phone, not a public username. Server lookup to an internal Auth identity must never become an unauthenticated public email directory.
- The admin.createUser API supports email_confirm true and uses built-in password hashing. Do not turn off email confirmation project-wide just to support a username frontend; the new internal-only accounts must be registered by the protected server route.
- Existing username rules accepted numeric or underscore prefixes. Continue accepting those legacy identities for login, while applying stricter rules only to new signups.
- Web Crypto HMAC importKey requires an algorithm descriptor with name HMAC and hash SHA-256. The matching policy helper and its CI tests now use that explicit descriptor.
- Synthetic addresses under accounts.invalid remain an unverified design until GoTrue Admin Auth rejects or accepts them in a staging account creation test. Never assume the input validator permits them.

## Fair household abuse prevention
Every registration gets a server-validated bot check. Each username: approximately five failed logins per fifteen minutes with gradual backoff. Soft challenges around 12 registrations/hour or 40/day per IP; unusually heavy bursts around 100/hour or 300/day may be temporarily refused with a review route. IP is not a unique person because households, workplaces and mobile networks share NAT. Device IDs are untrusted and must never be hard-account limits; 3/day per device may increase risk score but cannot prove identity. Monitor IP and account creation patterns across windows, count successful accounts, add manual review and appeals for false positives. These numeric thresholds are starting policies to tune against real usage, not guarantees. Total prevention of multi-accounting requires stronger identity verification; do not collect ID documents by default.

## Infrastructure checked
Supabase project byjixqwpjvsgmqilmzbm includes Auth, profiles, Edge Function luo-auth, consume_signup_rate_limit and consume_auth_action_limit; recent direct SQL calls time out, so migrations must wait for reliable service. Upstash Redis database luochatreliability exists, suitable for atomic throttling. Cloudflare account is connected but has no Turnstile widget configured yet. Vercel project luo-chat-luokai25 has previously hit its daily deployment quota. GitHub repo luokai25/luo_chat is source of truth.

## Required gates before production
- Staging Auth and database migrations successful, with backups and rollback.
- Atomic and unique username mapping, Auth user creation, recovery-code reservation/consumption, account deletion and settings changes tested.
- Existing users sign in with username + existing password and retain original chats on two devices concurrently; old email recovery remains operational.
- Unauthenticated direct REST and old signup function calls cannot bypass Turnstile and rate limits.
- Whole-household tests permit separate users on one IP; rate thresholds challenge suspicious bursts rather than globally banning Wi-Fi networks.
- No service-role credentials, internal aliases or recovery hashes exposed to public clients, responses or logs. Audited RLS/grants, security advisors, data retention, and accessibility.
- Confirm Supabase backend reliability and Vercel production deployment capacity.
- Gradual, reversible rollout. No live auth setting changes until all gates pass.

WARNING: Disabling email confirmation alone is not sufficient to implement username-only authentication, recovery, or abuse prevention.

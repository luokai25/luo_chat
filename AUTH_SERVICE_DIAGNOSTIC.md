# Luo Chat sign-in service diagnostic — 2026-10-24

## Confirmed checks

- Supabase project `luo-chat` / `byjixqwpjvsgmqilmzbm` reports `ACTIVE_HEALTHY` in the management API.
- The public publishable key configured in the client matches an enabled key in that project. The legacy anon key is also enabled. No keys were rotated or disabled.
- The public gateway responds HTTP 401 to an Auth health request without an API key.
- Auth health, email/password token verification with a nonexistent reserved-domain account, and an anonymous zero-row database read time out when using the configured public key.
- Auth health and the zero-row database read also time out with the active legacy anon key. No legacy key change was applied to the app.
- The SQL management connection test failed with `Connection terminated due to connection timeout`.
- The old live username Edge-function check returned 503. The replacement direct email Auth check timed out. No real account password was used and no real email was sent.
- Security advisories could not be retrieved. Read-only log queries returned a small number of gateway/function records but did not establish a root cause.

These checks establish an availability problem on the live service paths; they do not establish which Supabase process or infrastructure component caused it. A management status of ACTIVE_HEALTHY does not prove that Auth or database requests are working.

## Completed client work

The APK client restores Gmail/email plus the Luo Chat account password, using Supabase Auth directly for sign-in. Signup, resend and recovery retain the protected existing email backend. Accounts, email identities and server settings are unchanged. Tests cover credential validation, missing-session rejection, duplicate requests, obsolete responses, email confirmation guidance and stable signed-out rendering. The production website already retains email/password login and remains on the separately reviewed Social-only release.

## Next operational step requiring separate authorization

Use the Supabase dashboard for this exact project to inspect its service health and database restart control. If the dashboard confirms a stalled service, perform its standard in-place restart, then verify Auth health, a zero-row database read and rejection of a nonexistent email/password account. A restart interrupts the whole live backend. The connected Supabase plugin has no restart action.

Do not substitute pause/restore, a database upgrade, a password reset, an email-identity migration, a key rotation or account deletion for an in-place restart. If the dashboard shows a platform incident or lacks a safe restart control, preserve the project and escalate through the owner's Supabase support channel instead of guessing. No support message has been sent.

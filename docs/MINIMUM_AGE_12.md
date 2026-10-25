# Luo Chat minimum age 12: gated development implementation

Updated 25 October 2026 on `feature/reels-immersive-20261025`. Production and live authentication settings are unchanged.

## Product decision
Minimum product age: **12**. Ages **12–17** need independently verified legal-guardian authorization; children younger than 12 cannot register. The age screen computes an age band locally and does not submit or store the date of birth. Adult (18+) registration still uses the existing email/password flow.

## What has been implemented
- `src/age-policy.js`: UTC birth-date validation, completed years, age bands, invalid-date and future-date rejection.
- `public/index.html` and `src/app.js`: signup-only date-of-birth and guardian approval fields, clear age feedback, and a fail-closed block for any 12–17 signup until child protection is activated.
- `supabase/functions/luo-auth/index.ts`: server requires `age_band`; rejects under-12 and unknown bands, and requires a short-lived email-bound HMAC guardian grant when `LUO_MINOR_SIGNUP_ENABLED=true`. The key `LUO_GUARDIAN_APPROVAL_SECRET` is **server-only**, must be 32–512 characters, and must never be sent to the browser. The grant token is `v1.<expiry_unix_seconds>.<base64url_HMAC_SHA256(email_lowercase + "|12-17|" + expiry)>`; expiry cannot exceed 30 minutes.
- Dedicated tests cover age boundaries, absent age claims, below-minimum age, disabled guardian admission and adult signup.

## Why minor signup is deliberately unavailable
An HMAC proves that an approved operator issued a grant **after independently verifying** a guardian. The app cannot perform that verification by having a child click a checkbox. There is no approved verifier, no documented guardian request/deletion path, no established underage privacy defaults in the Social backend, and no independent accessibility/safety acceptance yet.

**Critical authorization bypass:** the Supabase Auth public signup endpoint is still reachable directly. Since `luo-auth` currently calls public `auth.signUp`, its validation alone is not universal enforcement. Before any child registration, turn off public self-signup in the isolated Auth project and build a dedicated privileged server-only registration route. Verify every path with a controlled adversarial client. Do not disable production signup as part of this change.

Do not turn on `LUO_MINOR_SIGNUP_ENABLED` merely because tests pass. The backend code has not been deployed to production or to working staging.

## Required before accepting minors
1. Qualified review of COPPA and applicable Egyptian child-data requirements, reviewed notices and verifiable guardian identity/relationship/consent, a durable revocation and access/deletion process.
2. Complete isolated database and Auth staging baseline; staging was discovered active but empty in public schema and migration history. Do not point previews at production to try out minor registrations.
3. Privileged server-only registration, a durable non-user-editable underage authorization and consent record, audit logging with minimal retention, deny-all on missing or expired authority, and independent RLS tests.
4. Default private profile and closed discoverability, no unsolicited adult-to-child messages, locked-down public reels/shares, abuse reports reviewed by trained moderators, rate limits and guardian protections.
5. Complete cross-network call tests, encrypted transport checks, safe media moderation/quarantine, direct API abuse tests and actual physical-device acceptance. Keep production unchanged until these gates pass.

## Notes
Age-bands are initially self-declared; the current frontend does not verify identity. Never use client-reported `registration_age_band` in `raw_user_meta_data` as an authorization fact. No birthday or token belongs in diagnostics. Child-specific consent requires a verified, revocable server-side authorization model.

Regulatory references for review:
- FTC COPPA: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Egypt Personal Data Protection Executive Regulations (2026), child information consent provisions (legal review required)

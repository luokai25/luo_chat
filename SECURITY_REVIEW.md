# 14.1.3 adversarial follow-up

See `ADVERSARIAL_REVIEW.md` for confirmed attachment validation bypasses, the recall correction, new rolled-back attack tests and remaining risks. The migration is applied; release verification is recorded in `verification/v14.1.3-security.json`.

# Security follow-up — 14.1.2 (2026-10-21)

## Confirmed and fixed

- `src/stories.js`: a delayed contacts lookup could restore private contact usernames after sign-out. Reproduced with a failing regression, fixed using session epochs and actor checks. Story circle loads are guarded across signout/signin to the same account. Composer success/error paths and media continuations also check the current session; pending file hashing/upload does not continue publishing after a session change.
- `supabase/migrations/20261021044753_restrict_vault_metadata_updates.sql`: the authenticated role could rewrite its own vault file pointer/MIME/size and snapshot source/body. This tampering was reproduced in a rolled-back transaction; no cross-user file read was established. Updates are now restricted to collection and private note columns, with existing owner RLS unchanged. Checked creation RPCs retain their privileges. This migration is applied live; its filename matches the version returned by hosted migration history.

## Verification

- 115 application tests pass, including two new session-boundary regressions in `tests/ui.test.mjs`.
- `tests/vault-isolation.sql` passes against the applied migration in a rolled-back transaction: foreign vault records and Storage objects are hidden; foreign row changes/deletes and claims are denied; owner note edits work; pointer, file metadata and snapshot rewriting are denied.
- `tests/v12-social-access.sql` passes again after the permission change, exercising the existing story, vault, group, presence and consent controls.
- Live column privilege inspection confirms only `collection` and `note` remain client-updatable on both vault tables.
- All metadata-only test users/rows are rolled back. No real user file bytes were read or deleted. The test does not exercise Storage download/signing HTTP end-to-end; an initial direct SQL Storage deletion test was rejected by Supabase's protection and removed rather than disabling that protection.
- Database advisor findings remain the same categories as before: intentionally locked RLS tables, authenticated schema/function discoverability and disabled leaked-password protection. No new advisor category was introduced.

## Remaining limits

This targeted audit cannot certify absence of flaws. Public profile fields and avatars remain intentionally visible according to current product rules. End-to-end encryption, upload malware scanning, instant revocation of existing signed media URLs, physical-device checks and comprehensive penetration testing remain incomplete. Google Safe Browsing clearance, hosted Auth leaked-password protection and Google OAuth setup remain separate blockers. Direct Auth API abuse limits and Edge trusted-IP provenance remain unverified.

The previous review below describes 14.1.1 checks and protections, retained in this release.

---

# Luo Chat security review — 14.1.1

Checked 2026-10-21. Scope: browser source, hosted database access metadata, rolled-back access tests, production dependency audit and hosting headers. This is a targeted review, not a penetration-test certification or proof that no other defects exist.

## Confirmed defects fixed

| Severity | Defect | Fix |
| --- | --- | --- |
| Medium | Unified search could render after its panel closed or after signout/signin to the same account. Its catch path could also display an old session's error. | `src/workspace.js`: request counter and session epoch guard successful/error/finally paths; cancellation on close and signout. `src/app.js`: close handler cancels pending work. |
| Medium | An old search result could put its cached text back into the room after the server hid a recalled/deleted message. Account and room context could change during the lookup. | `src/app.js`: fetch the target through current RLS, reject missing/recalled/deleted/expired originals, use current body, bind asynchronous work to account generation and room request. `src/workspace.js`: guard result navigation across session changes. |

Six UI regressions exercise panel close, same-account reauthentication, stale errors, recalled-result navigation, edited text and delayed target lookup after signout. All six reproduce relevant gaps or verify the patched paths. The three initial core regressions failed before their fixes.

## Additional browser protections

`vercel.json` adds Cross-Origin-Opener-Policy `same-origin` and X-DNS-Prefetch-Control `off`. Existing restrictive script CSP, frame-ancestor denial, no-referrer policy and nosniff stay in place. The new opener policy separates unrelated browsing contexts; it does not encrypt messages or scan uploads. Real Google OAuth return remains untested; the implementation uses a full-page redirect.

## Verified controls

- Every public base table has row-level security enabled, according to live PostgreSQL metadata.
- No public SECURITY DEFINER function grants EXECUTE to the anonymous role. Authenticated callable functions and schema discoverability still require authorization review; their visibility alone is not a data leak.
- Chat media, stories and vault buckets are private with 50 MB limits and MIME allowlists. Avatars are intentionally public, limited to 5 MB and JPEG/PNG/WebP.
- Existing `tests/v12-access.sql` passes live in a rolled-back transaction: outsider search isolation, private vault/transcripts, quote integrity, timed expiry, group permissions and interactive-message controls.
- Existing `tests/v12-social-access.sql` passes live in a rolled-back transaction: story audience/reactions, circles/vault, task permissions, bot limits, mutual timeline consent/revocation, presence selection and retained-file access.
- `npm audit --omit=dev --json`: zero known production vulnerabilities at check time. This is advisory coverage, not proof of supply-chain safety.

## Open risks and blockers

- Google's reported phishing warning is not cleared; these fixes do not establish its cause.
- Supabase reports leaked-password protection disabled. Enable through the owner Auth configuration; the available connected operations cannot edit it.
- Auth CAPTCHA configuration and protection against bypassing the app's email-action wrapper have not been established. The database wrapper rate limits do not prove every direct Auth API path is protected. Trusted client-IP provenance in Edge Function requests needs platform verification.
- User files have MIME/size restrictions, but no malware scanning or content disarm pipeline. Treat received files as untrusted.
- Supabase Auth sessions live in browser storage; a future script injection could steal tokens. Existing CSP and text escaping reduce this risk but do not eliminate it.
- End-to-end encryption and individual-device secure revocation are not implemented. Password-based local screen lock is not an encryption boundary.
- Account-deletion concurrent activity and pre-existing signed media links warrant further targeted testing. This release does not change deletion behavior or revoke already-issued signed URLs.
- No load/denial-of-service simulation or physical-device security test was run. No paid firewall changes, credentials, domains or accounts were altered by this release.

## Production verification

Deployment `dpl_EyFdTT4grUMtdChngWq7GtNWZwyz` is READY on the existing production address. All 113 checks passed in the remote build. Live HTML, service worker and application JavaScript match the local build by SHA-256; COOP and DNS-prefetch headers were observed. See `verification/v14.1.1-security.json`. No runtime error-log or traffic-monitoring audit was performed.

## 14.1.2 deployment result

Production deployment `dpl_8SJyDmdMjC74fcBDwiZCYBmEcw9o` is READY. All 115 checks passed remotely. Live HTML, application JavaScript and service worker match the local tested build by SHA-256. This checks release integrity, not absence of security defects. Evidence: `verification/v14.1.2-security.json`.

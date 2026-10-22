# Luo Chat attacker-oriented review — 14.1.3

Checked 2026-10-21 on the authorized Supabase/Vercel project. No real user files were accessed. Database attack fixtures were temporary and rolled back. This is a targeted adversarial review, not a guarantee or an independent penetration-test certification.

## Findings and fixes

| Priority | Finding | Evidence and remediation |
| --- | --- | --- |
| Medium | A signed-in member could bypass the upload RPC and insert attachment metadata for a nonexistent object. No cross-user data read was established from this path. | Reproduced before patch. Client INSERT/UPDATE/DELETE on `chat_attachments` is now revoked; the existing upload RPC performs checked creation. |
| Medium | `send_chat_attachment` accepted a declared MIME type different from stored metadata. | The new attack suite failed before patch on this case. The RPC now compares Storage MIME metadata as well as owner, path, size and checksum. This does not inspect file bytes or establish that a file is malware-free. |
| Medium | Calling `recall_own_message` failed because its update moved the row outside the live-message SELECT policy. | Reproduced while testing recipient access after recall. Recall now uses an explicitly authorized server write: signed-in actor, exact sender ownership, current membership, live/unexpired row, fixed recall fields. No arbitrary client UPDATE privilege is added. Peer, outsider and repeat recall tests pass. |

The changes are in `supabase/migrations/20261021045541_require_verified_attachment_metadata.sql`, applied live. The file was generated with the CLI and aligned to the hosted migration-history version returned after application.

Recall is intentionally a privileged, narrowly scoped mutation because it must hide a row immediately after modifying it. It uses a fixed empty search path, qualified objects, an authentication check, sender and membership checks and no dynamic SQL. Anonymous EXECUTE remains denied. The advisor count for authenticated callable SECURITY DEFINER functions increases by one; this expected finding is documented, not dismissed as proof of safety.

## Attack checks

`tests/attachment-adversarial.sql` passes after application:

- Forged MIME, size, checksum and object ownership are rejected.
- Direct attachment insertion/deletion is denied.
- Valid checked creation and idempotent retry still work.
- Recipients can read a live attachment; outsiders cannot read its row or Storage object.
- Peers and outsiders cannot recall it; its author can recall once.
- Recipients cannot read attachment rows or obtain fresh Storage access after recall.

`tests/v12-access.sql`, `tests/vault-isolation.sql` and `tests/settings-access.sql` also pass after application, covering group rules, cross-conversation search, private snapshots/transcripts and settings access. The 115 automated application checks pass. These tests validate database policies with fixture roles; authenticated HTTP login/upload/download and real file-content delivery are not end-to-end tested here.

Direct anonymous HTTP probes using only the public publishable key returned:

| Endpoint | Status |
| --- | --- |
| GET `/rest/v1/chat_messages?select=id&limit=1` | 401 |
| GET `/rest/v1/chat_vault_files?select=id&limit=1` | 401 |
| POST `/functions/v1/luo-delete-account` with empty body | 401 |
| POST `/functions/v1/cleanup-chat-media` with empty body | 403 |
| POST `/rest/v1/rpc/recall_own_message` with a nonexistent test UUID | 401 |

## Remaining attack surfaces

- Stolen valid access tokens may work until expiry after refresh-session revocation; instant session enforcement across all data paths has not been implemented.
- Previously issued signed media URLs remain bearer links until expiry; downloaded copies cannot be revoked.
- Password breach checks remain disabled in hosted Auth; owner configuration is required. CAPTCHA settings, direct Auth abuse limits and trusted proxy-IP handling remain unverified.
- There is no file-byte malware scanning, content disarm pipeline or end-to-end encryption.
- XSS, browser storage token theft, dependency compromise, denial-of-service resistance and account recovery need ongoing review; passing this suite does not eliminate these classes of attack.
- Google's phishing warning remains unresolved and this review does not establish its cause or clearance.

No brute-force, load, credential-stuffing or third-party attack tests were performed. No paid security service was enabled.

## Release verification

Vercel deployment `dpl_GMp1YUrDyCSxFXgHApt956nHKBhs` is READY. All 115 application checks passed locally and remotely. Live HTML, application JavaScript and service worker match the local build by SHA-256. Evidence is in `verification/v14.1.3-security.json` and `verification/v14.1.3-anonymous-http.json`.

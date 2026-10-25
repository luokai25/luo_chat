# Release gates: implementation and verification progress

25 October 2026. Development only; production, hosted SQL, auth settings,
subscriptions and accounts were not modified. Base: `d4b3bbc80df61b5a416ad1d0adf3c687fd805145`.

## Status of the four requested items

| Gate | Work completed | What is still required |
| --- | --- | --- |
| Real two-device / cross-network / TURN | Existing temporary-credential implementation and call tests retained; physical acceptance procedure below | Two supported physical devices, two networks, an approved configured relay and operator participation. No hardware or remote RTP pass is claimed. |
| Backend staging / migration validation | Actual Reels and inspection proposals applied together to isolated PGlite Postgres fixtures; permission, immutability, retry, feed and publication contracts tested. Live schema column types checked read-only. | A separate hosted staging project and a full baseline restore. Only production/default main exists. No billable branch created. Owner must choose organization before a new project can be created, even if the quote is $0. |
| Trusted server-side upload inspection | Implemented bounded byte download, actual SHA-256, container/codec/dimension limits, native full decode, worker adapter/entry point, server-only receipts and a publication/immutable-storage SQL proposal | A working isolated worker host, reviewed generated migration, real Storage API acceptance, scheduling/retry/cleanup integration and activation. No live upload pipeline was silently switched. Coverage is Reel MP4/WebM, not every attachment format. |
| Password security / final legal policies | Confirmed Free subscription and disabled leaked-password advisory; expanded original EULA with account/permission boundaries, content ownership, compatibility, deletion and mandatory-rights sections | Built-in leaked-password blocking requires Pro; no upgrade approved. Auth configuration mutation is not exposed by the connected tools. Legal identity/contact address, markets, retention/transfer decisions and qualified review remain necessary. |

## Confirmed infrastructure facts (read-only)

- Organization `luo` (`echykfdiaqkxrslonpmh`) reports plan `free`.
- The only project is `luo-chat`, `byjixqwpjvsgmqilmzbm`.
- The branch list contains only default `main`, pointing at that same live project;
  this is **not** a safe staging target.
- Current public/internal inventories are 86 / 12 tables. The repository's old
  `supabase/schema-reference.json`, captured 20 October, lists 58 tables and two
  buckets. It is not a complete current restore baseline. Do not replay the
  incremental migration archive onto a blank project assuming otherwise.
- The live Storage object `id`, `version`, `owner_id`, `metadata`, `bucket_id`
  and `name` column types match the inspection proposal's expected shapes.
- Supabase security advisors still report leaked-password protection disabled.
  Official documentation limits the built-in feature to Pro and above. A browser
  password-strength check is not an equivalent server-enforced substitute.
- No management token, service-role key or private media was fetched from the
  user's connected accounts for this work.

## New trusted-inspection implementation

### Worker code

`src/server/media-inspection.js` accepts only bounded MP4/WebM bytes (50 MB),
validates container/streams/codecs/dimensions/frame rate/audio limits and then
requires a complete native FFmpeg decode with a positive duration no greater
than 90 seconds. SHA-256 and byte count come from the actual bytes. Header/client
duration cannot override decoded duration. Missing final progress, decoder error,
unsupported input or cancellation rejects the job.

Production execution defaults to `/usr/bin/bwrap` with a separate network/PID
namespace, cleared environment, read-only system mounts, temporary workspace,
process CPU/memory/file limits, bounded output and a wall-clock kill deadline.
Input is `pipe:0`, allowed protocols are only `pipe`, and no shell is invoked.
No private worker credentials are passed to the native child. This is format/
decode validation, **not antivirus, abuse moderation or proof of no decoder CVEs**.
The operational host must provide supported, security-patched and pinned native
tools, a proven sandbox and appropriate concurrency/resource controls.

The sandbox smoke test here failed with
`bwrap: open /proc/5/ns/ns failed: No such file or directory`.
No permission bypass or unsafe production fallback was attempted. Native tests
use only known source-generated MP4/WebM fixtures with an explicitly named
test-only executor. No user upload was processed outside a sandbox. Thus this
environment does **not** certify operational isolation for untrusted uploads.

`src/server/clip-inspection-job.js` bounds streamed downloads, cancels stalled
reads, validates owner/path and compares authoritative object snapshots before
and after decoding. `src/server/inspection-store.js` uses worker-only metadata
and receipt RPCs and a short-lived signed download restricted to the configured
HTTPS project origin/object path. Redirects and credential-bearing/foreign URLs
are refused. Service credentials are not attached to the signed media fetch.

`scripts/inspect-stored-clip.mjs` is an operator-run worker entry point, not a
public HTTP endpoint or an automatically deployed background service. It requires
explicit `LUO_INSPECTION_PROJECT_URL` and `LUO_INSPECTION_SERVICE_KEY` server
environment configuration; credentials are never accepted as command arguments
or logged. It was **not** run against live user media. Configure only a reviewed
staging target first, through the owner's secret-management workflow.

### Database proposal

`supabase/proposals/clip-inspection.sql` is **unapplied**, not a generated migration:

- Private RLS receipt table, no browser table access; receipt identity binds the
  exact storage object ID/version/path/owner, measured hash, size and duration.
- Worker-only metadata/recording RPCs, no anon/authenticated execute grants;
  intentional SECURITY DEFINER uses an empty search path.
- Trusted receipt recording locks and rechecks the object, with idempotent retries
  and conflicting-proof rejection. A transaction-scoped path try-lock prevents
  lock-order waits from becoming an unbounded deadlock.
- Published Reel insert/update requires a matching receipt; server-measured
  duration replaces the client claim.
- Restrictive Storage policies and a volatile guard trigger prevent browser
  mutation/deletion/reuse of reserved paths, including moving an approved object
  to another bucket. The trigger is a backstop for earlier policy snapshots.
- Receipt owner deletion cascades from Auth. Privileged storage cleanup is still
  permitted; validate real cleanup/account-deletion behavior before rollout.
- Transaction and lock deadlines prevent a partially installed proposal. A proper
  CLI-generated reviewed migration is still needed for hosted activation.

Existing published uploads are **not retroactively scanned**. Neither new policy
text nor a local SQL pass changes live enforcement. Before activation, plan a
reviewed backfill/quarantine strategy, permissioned job scheduling with retries,
rate limits, staging UI pending/rejection feedback and orphan cleanup. Other
image/audio/PDF/text/avatar/Story/Vault formats require their own inspection
policies and tests. Do not advertise all attachments as malware-free.

## Password-security configuration boundary

No current password was changed, emails disabled or login method migrated. No
unreviewed authentication policy was pushed to production. To finish safely:

1. Restore a staging baseline and read its actual Auth settings with authorized
   configuration access. Review minimum length, password-change reauthentication,
   refresh-token rotation/reuse, signup/reset limits and redirect allowlists.
2. Match signup, recovery and password-change UI/server behavior to the selected
   policy; test old accounts, new registrations and expired recovery links.
3. Choose an affordable **server-enforced** compromised-password solution. The
   Supabase Free plan cannot simply enable the documented Pro-only switch.
4. Test and review the specific auth-setting diff before any production change.

Connected tools do not expose an Auth-config update operation. This does not
authorize extracting credentials from another connector or using SQL to bypass
the platform's configuration controls. No plan or billing changes were made.

## Legal policies and requested plugin

The cybersecurity plugin's currently installed skill describes a technical
glossary assistant: it defines terms/acronyms. It does not provide EULA generation,
Termly/TermsFeed integration or legal approval. It was inspected rather than
misrepresented as a legal review service.

`scripts/site-content.mjs` now includes additional substantive EULA draft sections.
They preserve user content ownership and mandatory rights and distinguish
uninstalling from account deletion. The documents remain visibly labeled as
original review drafts. Finalization requires the operator's legal identity,
public business/contact address, countries served, applicable age requirements,
retention/transfer decisions and distribution/payment plans. No address,
governing law, arbitration clause, registered company or DMCA certification was
invented, and no agreement was submitted on the owner's behalf.

## Physical acceptance procedure — not executed here

Use two consenting participants, separate test accounts, current supported
devices and separate Wi-Fi/mobile networks on an approved staging build:

1. Confirm no mic/camera transmission before explicit answer, including rejection,
   cancellation, denied permission and an expired incoming call.
2. Complete voice and video calls both ways. Verify outgoing audio mute, camera-off
   placeholder, hold, flip camera and teardown against the recipient's actual media.
3. Test direct and relay-only routing, recording only the route category, RTT,
   jitter/loss and user-visible result—not SDP, IPs, tokens or signed URLs.
4. Interrupt networking for a short period, restore it, change network interface
   and verify honest Reconnecting/failed states; no fake duration before connection.
5. Confirm effects reach the other device, preserve audio, and do not silently
   transmit raw camera on renderer failure. Check slow devices and thermal limits.
6. Check headset/Bluetooth, supported screen sharing and unsupported-control
   hiding, foreground/background/locked-screen behavior and app signout/lock.
7. Verify actual relay credential expiry, replay limits, allocation/bandwidth
   quotas and active-call behavior near expiration. Existing ICE restart/renewal
   limitations remain; do not certify them using a mocked timer alone.

The agent has no access to two physical phones or a provisioned relay. Native
browser fixture transport tests remain useful regressions, not substitutes.

## Verification commands and references

Default frontend release tests do not require FFmpeg. Dedicated native fixture
test runs separately so a static Vercel build does not acquire a native-toolchain
dependency:

```sh
npm run release:check
node --test tests/server/media-inspection-native.mjs
node tests/browser/site-quality.mjs
npm run release:reproduce
node scripts/check-secrets.mjs
node scripts/check-git-secrets.mjs
```

Final results: `verification/release-gates-20261025.json`. Local PGlite tests use
minimal managed-Auth/Storage fixtures; they are not a full hosted Supabase clone.
One earlier shared-output run failed the worker-branding assertion; final clean
runs passed. The cause of that intermediate output was not established. Use
exclusive build workspaces and reverify the final worker before promotion; this
continuation does not claim to have fixed that separate build-hygiene observation.

Official references:

- https://supabase.com/docs/guides/auth/password-security
- https://supabase.com/docs/guides/local-development/cli/config
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://www.termsfeed.com/eula-generator/
- FFmpeg/FFprobe command help from the installed binaries; native fixture tests
  verify the used options. Public FFmpeg documentation fetch timed out.

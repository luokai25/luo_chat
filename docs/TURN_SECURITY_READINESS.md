# Expiring relay credentials — development security continuation

Date: 25 October 2026. Base: `105e6dcb2678ca7917a7c2f8994a3f55b2e1adee`.
No production deployment, cloud provisioning, environment change, user/account
change, hosted SQL or published APK is part of this continuation.

## Confirmed defect fixed in source

The previous `/api/call-config` could return an operator-configured static TURN
username/password to an authenticated client. That client could reuse it outside
Luo Chat indefinitely, subject to relay-side configuration. Limiting requests to
the config endpoint did not limit reuse of already issued credentials. No live
TURN password was configured or fetched during this work.

`src/server/turn-credentials.js` now implements coturn-compatible TURN REST
credentials: epoch-seconds expiration plus a random 96-bit username tag and an
HMAC-SHA1/base64 credential. HMAC-SHA1 is the specified protocol construction,
not plain SHA-1 password hashing. Lifetime is fixed server-side at 3,600 seconds;
clients cannot request a longer lifetime. The shared signing secret and raw
account identifier are not included in the response. Credentials are temporary,
**not single-use**: a recipient can reuse them within the allowed interval.

`api/call-config.js` preserves remote Supabase `auth.getUser` validation, checks
that it obtained a nonempty user ID, and consumes the shared Redis quota before
minting a credential. Failure to authenticate, validate config or enforce the
quota cannot return a relay credential. Static or mixed old/new configuration is
an explicit generic 503 rather than a misleading STUN-only success. No configured
relay remains an intentional STUN-only result with `relayExpiresAt:null`.

URI validation permits `turn:`/`turns:`, hostname/IPv4/bracketed IPv6, ports 1–65535
and optional `transport=udp|tcp`. It rejects embedded credentials, paths,
fragments, extra parameters, unsupported transports and malformed addresses.
The endpoint accepts the relay only from server environment configuration,
never user input. The response retains `Cache-Control:no-store`.

`scripts/verify-build.mjs` now rejects accidental inclusion of relay shared-secret,
static-password, quota-salt or Redis-token environment references in the browser
app bundle. This complements, but does not replace, secret scanning.

## Configuration contract (not applied to hosted settings)

| Variable | Requirement |
| --- | --- |
| `LUO_TURN_URL` | Approved TURN REST-compatible relay URI; single endpoint in this implementation |
| `LUO_TURN_SHARED_SECRET` | Server-only random secret matching the relay's TURN REST secret; 32–512 ASCII base64/base64url/hex-compatible characters; length validation alone cannot prove entropy |
| `LUO_RELAY_QUOTA_SALT` | Separate server-only secret used for pseudonymous quota keys |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Approved shared limiter storage; existing per-user 12/min and global 2,400/day config-request ceilings |
| `LUO_TURN_USER` / `LUO_TURN_PASSWORD` | Legacy configuration no longer accepted; migrate deliberately, never silently fall back |

Generate/manage actual secrets through the owner's approved secret-management
workflow. Do not paste them into chat, put them in browser-prefixed variables,
or commit a populated environment file. No secret was generated for or installed
into a hosted account here, and no paid relay was provisioned.

The relay operator must explicitly support this protocol, configure a matching
realm/secret, synchronize its clock, enable authentication and enforce bandwidth
and allocation quotas. API request quotas are not TURN bandwidth or billing caps.
Do not enable anonymous relay, unsafe server-relay mode or access to prohibited
private/multicast peer networks. Test the selected provider's actual behavior.

## Verification

`tests/turn-credentials.test.mjs` covers URI forms, malformed input, incomplete and
legacy configuration, fixed HMAC fixture, second-based expiry, fresh random tags,
invalid clocks/randomness, authentication/quota ordering, no secret/account ID
in output, generic errors and STUN-only behavior. Existing quota and auth-error
tests now use temporary-credential configuration, not a static-password fixture.

Final build, full tests, clean-build comparison and scan results are recorded in
`verification/turn-security-20261025.json` after completion.

## What this does not establish

- No real coturn server or provider has accepted or rejected these credentials in
  this environment. Unit HMAC matching is not an end-to-end relay certificate.
- No physical-device or two-network RTP, relay-only connection, NAT/firewall,
  IPv6 route, packet loss, audio quality or Bluetooth acceptance was performed.
- Active-call credential renewal/ICE restart is not implemented. `src/calls.js`
  fetches fresh config for a new call, not for an existing hour-long call. Test
  behavior at expiration and implement controlled renewal before promising long
  calls or network-transition recovery.
- Existing access-token revocation timing, signout and linked-device behavior
  need hosted acceptance; `getUser` is not claimed as instant session revocation.
- Staging, trusted upload inspection/quarantine, leaked-password protection,
  provider cost controls, legal review and the remaining AR/editor/native-call
  release gates remain as recorded in the main production checklist.

## Requested cybersecurity plugin

The user requested the `cybersecurity` plugin. Its linked identifier was not
present among the available executable tools or skills; plugin-directory search
for its name returned no result. This continuation therefore used direct
repository inspection and tests, **not a plugin scan**, and makes no independent
scanner/penetration-test certification claim. No alternative plugin was silently
installed or granted broader permissions.

## Primary references reviewed

- coturn current protocol/config documentation:
  https://github.com/coturn/coturn/blob/master/README.turnserver
- Supabase authenticated user validation:
  https://supabase.com/docs/reference/javascript/auth-getuser
- Supabase changelog reviewed for relevant breaking changes; legacy TLS cipher
  removal remains a supported-device acceptance concern:
  https://supabase.com/changelog/cbc-tls-ciphers-deprecated

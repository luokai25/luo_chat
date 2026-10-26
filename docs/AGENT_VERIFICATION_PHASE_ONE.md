# Luo Chat: key-possession verification release, October 26, 2026

This capability is deliberately narrower than paid AI-agent account activation.

## Trust boundaries

- A server challenge signed by an Ed25519 private key confirms possession of **that cryptographic key at the time of the proof**. It is **not** verified AI authorship, ownership of a human's username, an association with a model provider, a trusted-organization badge or an active Luo Chat membership.
- `key_verified` never signs an agent in, charges money, provisions payment entitlements, opens chats, discovers private people, bypasses Worlds consent, or exposes user data.
- Humans remain on the existing production auth stack. Youth registration and AI-to-human messaging remain subject to separate safety and guardian-approval controls.
- The public server exposes `GET /api/v1/agents/verification`, `POST /start`, `POST /finish`, and `GET /status?id=UUID` beneath that prefix. All mutations default to HTTP 503 until `LUO_AGENT_VERIFICATION_ENABLED=true` in the target Vercel deployment.
- Identity keys use Ed25519 raw 32-byte public keys encoded as canonical unpadded base64url. The client signs the exact UTF-8 bytes of the `challenge` string. Proof signatures are 64 bytes in canonical base64url.
- The challenge includes the random UUID, 32-byte nonce and normalized username; it expires after **10 minutes**. The server checks and atomically consumes it. A verified proof is viewable for **30 days**, after which a new proof is required.
- An invalid proof consumes one of **eight per-challenge attempts**. This is a resource-abuse guard, not a substitute for server-side global, key, username and network rate limiting.
- The DB allocates at most 2000 challenges per UTC day across all users, 12 per network, 8 per key, and 8 per proposed username. These counters are reserved atomically before returning a challenge.
- Client IPs are accepted only from Vercel's trusted `x-vercel-forwarded-for` ingress. If a trustworthy IP is unavailable, fail closed instead of accepting a spoofable proxy chain. Only a keyed HMAC of the address is stored; the raw address is not in the verification tables.
- Private records and counters live in `luo_agent_verify`, a non-Data-API schema. RLS is enabled, and `anon`/`authenticated` have no table access or RPC execution privileges. A server-only service credential is required.
- Every response is `no-store`. Do not log private keys (which should never be sent), signed challenges, signature payloads, IPs, Supabase credentials, or user account data.

## API contract

1. `GET /api/v1/agents/verification` reads feature availability, proof algorithm, limitations and endpoint paths. Safe even with verification disabled.
2. `POST /api/v1/agents/verification/start`: JSON `{"username":"my_agent","public_key":"..."}`. The API validates fields and quotas before returning a verification UUID, the exact challenge string and expiry.
3. Client signs the entire challenge (including newline delimiters) with its own Ed25519 private key.
4. `POST /api/v1/agents/verification/finish`: JSON `{"id":"UUID","signature":"..."}`. A valid signature sets `key_verified`. Invalid signatures return 401; expired, consumed or exhausted challenges return 409.
5. `GET /api/v1/agents/verification/status?id=UUID` returns `challenge_pending`, `key_verified`, or `expired`, with `membership_active:false` and `chat_access:false`.
6. Status IDs are opaque random UUIDs. Treat them like private verification receipts and avoid exposing them to search indexing or automatic referrers.

## Release gates

- [x] Database version created and access grants verified in isolated staging Supabase.
- [x] New frontend/API source, OpenAPI contract, secondary-surface enhancement and regression tests authored on GitHub feature branch.
- [ ] Vercel preview of exact commit has passed the complete release test suite.
- [x] Isolated production schema migration exists, and ordinary users lack direct table permissions.
- [x] The dedicated `LUO_AGENT_VERIFICATION_ENABLED=true` switch is enabled in Vercel Production; paid-membership and messaging gates remain independent.
- [ ] Release the hardened per-challenge attempt-limit update after all tests; the earlier key-verification release is already live.
- [ ] Smoke-test production HTTP 200 info and a real Ed25519 challenge/signature flow with controlled test key (without activating any subscription).
- [ ] Audit errors and source security alerts. Keep other billing, chat, registration and login flags disabled.

## Human and AI developer experience

The full guidance in `public/agents.html`, `public/openapi.json` and the public verification capability response is intended for human developers and responsible AI agents. No model provider endorsement is claimed. Never advertise a permanent account or membership badge based on public-key ownership alone.

## Secondary-screen V4

Designed real destinations instead of inventing extra routes: profile detail, original chat wallpaper chooser, authorized shared media, full media viewer, poll/quiz and schedule composer, dynamic Luonix comments/share sheets. The original authorization, attachment, submission and persistence handlers remain in the existing modules.

### Acceptance checks

- On 320, 360, 390 and 430 px screens, verify bottom-sheet safe area, user-profile vertical fit, chat-wallpaper grid, media viewer, horizontal shared file category chips and comments composer above Android keyboard.
- Check poll/quiz state, schedule previews, shared media filters, input focus/return after close and no duplicate handlers.
- Verify reduced motion, screen-reader names, network failures and long Arabic/English content without clipping.
- No confidential chat or status content may appear in public metadata, agent documentation, SEO schema or unauthenticated API responses.

### Follow-up security hardening

The production and staging databases received `agent_verification_proof_attempt_limits`, limiting any one challenge to eight proof attempts. The API now consumes this counter before each signature verification, so an unlimited stream of bad signatures cannot reuse the same challenge indefinitely.

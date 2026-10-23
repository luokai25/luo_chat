# Profiles and connections

Luo Chat keeps its existing black-and-gold interface, contacts, stories, groups and chat flows. New profile cards open from username lookup, saved contacts, the room identity/photo, group members, group message sender names, story authors and Settings → View my profile. Tap the profile photo to open the larger image. Only project-hosted avatar URLs are rendered; profile text is inserted as text, never HTML. Account emails are not part of the profile API.

People now includes Received, Sent and Friends lists. Requests require explicit recipient approval. Senders can cancel; recipients can decline; either friend can remove the friendship. Saving a private contact remains separate from becoming friends. Lists load 50 people at a time with a user-ID cursor, and Refresh checks for changes without background polling.

Blocking uses the existing server protection for direct messages and calls, removes pending/approved connections, and now also prevents creating or reopening a direct chat through the creation RPC. Shared groups are unaffected. Unblocking does not recreate friendship. Existing conversation history and previously public avatar files are not erased by blocking.

## Server behavior

- `chat_connections` stores one canonical pair, protected by participant-only RLS. Browser roles have no direct write access.
- `change_chat_connection` validates `auth.uid()`, target, action, direction and state. Reciprocal requests do not silently approve one another.
- Pair-level transaction locks serialize requests, approvals, blocking and direct-chat creation. A retry cannot create duplicate friendship rows or new duplicate direct rooms. Existing duplicate rooms are preserved.
- New requests are limited to 20 per account per UTC database day. Declined, cancelled or removed relationships have a 24-hour resend cooldown. Duplicate pending/accepted requests do not consume another quota slot.
- `get_chat_person` returns only name, username, bio, avatar, frame, relationship and own-block status. A person blocked by the target receives no profile from this RPC. Existing profile discovery/storage policies remain in effect.
- All new privileged functions pin an empty search path and revoke anonymous/public execution. Counter storage is private. Pair, recipient and requester indexes cover lookup and foreign-key access.

Migrations applied to Supabase: `20261023001926_profile_connections.sql` and `20261023002025_block_direct_chat_creation.sql`.

## Verification

- 323 automated tests passed, including six dedicated profile/relationship UI cases.
- `tests/connections-access.sql` passed against the hosted database in a rolled-back transaction with synthetic accounts. Checks cover ownership, third-party isolation, self-approval denial, explicit approval, retry behavior, cursor enforcement, cancellation/cooldown, quota denial, anonymous denial, blocking, direct-chat creation denial and unblock behavior.
- `tests/v12-social-access.sql` passed with rollback: story audience/reaction privacy, private circles/vault, tasks, moderation, timelines, selected presence, retained media, digest jobs and cleanup.
- Browser checks passed at 390px and 1280px using intercepted synthetic backend responses: profiles/photos, request/cancel, received approval, block/unblock, contacts, direct chat/message sending, stories, groups, tabs, desktop layout and reduced motion. No browser exceptions observed. Browser fixtures and hosted SQL checks verify separate boundaries; they do not constitute a two-device production acceptance test.
- Clean lockfile reproduction matched all 98 production files byte-for-byte; dependency audit found no known production vulnerabilities. Credential-pattern scanning passed.
- Security/performance advisors were reviewed. The new table's authenticated GraphQL exposure is constrained by participant-only RLS, and the three privileged RPCs are intentional with explicit authorization tests. Existing leaked-password-protection and broader operational/staging/restore items remain documented in the hardening reports.

## Email

Resend production sending remains blocked on an owned, DNS-verified sender domain. The free `luo-chat-luokai25.vercel.app` URL can host the website and authentication redirect destination, but cannot be verified as the email sender. Existing authentication mail transport is preserved. See `RESEND_EMAIL.md`.

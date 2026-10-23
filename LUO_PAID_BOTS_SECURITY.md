# Luo Chat Paid AI Agent Accounts

STATUS: staged code only. Disabled by default. Not activated in production; no checkout, charge, credential issuance or bot messaging enabled.

## UX and commercial model
A human Luo Chat owner applies for a bot with a username like @bot_luo_helper. It has a permanent AI Bot / Automated badge. No AI can present itself as a real person. The owner pays a real subscription through a hosted checkout, receives a bot-specific **cryptographically generated high-entropy password** after the payment and safety review, then controls that bot via a separate API. Bot password is never a Supabase human password.

1. Existing human owner signs in. They choose a unique bot handle, within their account's bot-count cap.
2. Trusted server creates a checkout order at a server-defined price, currency and subscription period.
3. Paymob or another supported provider sends a signed POST callback; server verifies its HMAC and matches order ID, amount and currency. A user redirect, screenshot, receipt upload, browser "paid" parameter or AI declaration never activates access.
4. Successful payment changes payment status only. Human moderation must also approve it. Pending bots remain suspended, have no scopes and cannot access the API.
5. After verified payment and approval, owner gets a one-time 256-bit random bot credential; its keyed hash is privately stored. Rotate or revoke it from Settings. Never share service-role credentials or human Supabase refresh tokens.
6. Unpaid, expired, refunded, disputed, banned or owner-paused bots are immediately disabled. A verified refund/void callback suspends and revokes the bot.

## Security boundaries
The first implementation has an additive private luo_bots schema:
- accounts, credentials, orders, payment_events, audit
- thread_consents, action_receipts, usage_buckets
- a server-role-only SQL function to atomically authorize and debit each bot operation
- an owner-only emergency pause function.

Bots must NEVER get ordinary human Supabase Auth sessions or browser keys. Bot authentication and all operations use a separate allowlisted gateway that enforces payment, moderator approval, bot scopes, per-action quotas, thread consent, and a replay-resistant request ID. Bot messages are always labeled Automated. AI-generated text never changes permissions.

A bot can read or reply to one assigned 1:1 thread only when the human explicitly authorizes that specific bot, conversation and action. The SQL policy checks actual conversation membership. Humans can revoke consent. No cold DMs or scanning users.

## Initial server-enforced quotas

| Action | Per minute | Per day | Per recipient per minute |
| --- | ---: | ---: | ---: |
| Read consented thread | 30 | 600 | 15 |
| Reply in consented thread | 6 | 180 | 2 |
| React in consented thread | 12 | 250 | 4 |
| Publish moderated public post | 2 | 12 | N/A |

Blocked by default: unsolicited DMs, calls, scraping contacts/profiles, user invitations, groups administration, account or recovery changes, payment operations, mass mentions, bulk exports, attachments, reading other threads. Paying must NEVER buy unlimited actions. Include owner/IP/ASN anomaly budgets, reports, moderation and kill switches.

## Provider and payment work
Paymob is a practical candidate for an Egyptian merchant. This branch has a Paymob HMAC-SHA512 verifier for the documented 20 transaction callback fields, plus a staged POST-only webhook that requires the configured integration and owner IDs. Payment settlement requires a matching pre-existing server order and prevents replay/overpayment/wrong-currency activation; verified refunds/voids revoke access. No merchant credentials, checkout or price has been configured, and no money has been collected. Test sandbox and live separately. Paddle can be a separate adapter if chosen.

Official references:
- https://developers.paymob.com/paymob-docs/developers/transaction-callbacks
- https://developers.paymob.com/paymob-docs/ai-solutions/ai-agent-skill
- https://github.com/PaymobAccept/Paymob-AI-Integration-Skill/blob/main/skills/paymob-integration/references/hmac-verification.md

## Release gates
1. A reliable staging Supabase/Postgres SQL environment, successful migration application and RLS/security review. Production Supabase management has intermittently timed out.
2. Implement owner-only bot applications, server-created payment checkout, verified event processing, generated credential issuance, bot API auth and proxy actions. They do NOT exist yet.
3. Prove full isolation from every direct Supabase Data API, Realtime, Storage and SECURITY DEFINER RPC path; a bot must never receive a full human JWT. Review every permitted chat mutation before enabling it.
4. Real human 1:1 consent UI, bot badges, owner pause/rotation, expiry handling and moderation tools. Prove group chats, unconsented messaging and bulk data requests cannot leak data.
5. Payment integration tests: live-merchant HMAC signature, amount and order matching, refunds/chargebacks, duplicate/out-of-order events, duration renewals, zero charges in sandbox, server-only secrets.
6. Load and concurrency tests for quotas, retries and idempotency; red-team account takeover, abuse and rate-limit bypass attempts.
7. Only then enable billing and bot creation in production, with a rollback switch. No new payment or bot power is activated by this branch alone.

The idea works only if bot accounts remain transparent, paid and human-controlled, with much tighter privileges than ordinary accounts.
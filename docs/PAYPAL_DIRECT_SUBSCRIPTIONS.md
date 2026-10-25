# Luo Chat direct-to-owner PayPal subscriptions (not live)

## Merchant settlement
PayPal Subscription Checkout sends the buyer to PayPal. **The merchant account
associated with the configured PayPal REST client ID and secret is the seller and
receives PayPal payments directly**, subject to PayPal account eligibility, holds,
fees and local banking rules. Luo Chat is not an intermediary or separate wallet.

A linked ChatGPT PayPal connector is NOT a PayPal REST application. It can create
ordinary payment links/invoices, but it cannot supply subscription plan IDs,
merchant OAuth credentials, signed webhook IDs, or legal seller information.
**Never infer payment from the redirect URL, screenshots, transaction emails,
or a payment-link visit.**

## Existing staged code
- API: POST /api/v1/agents/register for a pending autonomous agent; payment
  does not bypass the per-network creation caps and one-agent-per-subscription limit.
- POST /api/v1/billing/checkout supports `provider: "paypal"`, valid username,
  password, and `plan: "starter" | "pro" | "max"`.
- POST /api/v1/billing/paypal-webhook validates PayPal's own signature against
  the merchant webhook ID, checks the subscription with PayPal's API, confirms
  a settled USD transaction and server-controlled plan/price, reconciles it with
  a reserved checkout intent, and only then activates a subscription.
- Idempotency and account/subscription uniqueness are database requirements.
- Existing monthly price configuration: Standard $12 USD, Pro $24 USD,
  Maximum $30 USD. An optional operator-started first-invoice promotional campaign
  is configured independently; no promotion starts automatically.

## Operator-only setup
1. Confirm the owner has an eligible **PayPal Business** merchant account in
   their region. Verify direct receipt, currency and dispute/refund policies.
2. In the PayPal Developer Dashboard create a REST application for the **same
   business seller**. First use Sandbox client ID/secret and sandbox buyer accounts.
3. In the PayPal Subscriptions dashboard/API create products and **monthly
   recurring plans**, matching the exact standard prices. For promotional first
   invoices, configure distinct provider plans with the correct one-time trial/
   introductory billing period, automatic full-price renewals and disclosures.
4. Set the staging-only secret variables `LUO_PAYPAL_CLIENT_ID`,
   `LUO_PAYPAL_CLIENT_SECRET`, `LUO_PAYPAL_ENV=sandbox` and
   `LUO_PAYPAL_PLAN_STANDARD_REGULAR`, `LUO_PAYPAL_PLAN_PRO_REGULAR`,
   `LUO_PAYPAL_PLAN_MAXIMUM_REGULAR` (plus *_PROMO only if active).
5. Add the PayPal application's webhook endpoint
   `/api/v1/billing/paypal-webhook`, subscribe to subscription activation,
   cancellation, suspension, expiry, payment-failed and completed-sale events.
   Enter the returned `LUO_PAYPAL_WEBHOOK_ID` as a server-only secret.
6. On the isolated Supabase staging project only, deploy and test the verified
   agent billing SQL migrations, RLS, unique constraints and RPC authorization.
   The staging schema has not been shown to be fully initialized.
7. After isolated end-to-end tests pass (checkout, first payment, renewals,
   cancellation, retry, refund/reversal, webhook duplicates/out-of-order events,
   merchant account mismatch, reused accounts, wrong prices and network limits),
   separately review merchant terms, privacy policy, chargebacks, underage users,
   and data-deletion requirements before any **production** rollout.
8. Production live credentials must be bound to the production seller, separate
   from sandbox; production cannot inherit staging agent tables, test buyers or
   sandbox subscription IDs. The current server intentionally rejects production
   and all attempts without verified operator configuration.

Do not paste PayPal client secrets, account access tokens or signing keys into
GitHub, public Vercel environment variables, ChatGPT messages or browser code.
Avoid connecting Binance API market-data credentials to merchant payment flows.

## Current status (2026-10-25)
Backend PayPal subscription flow is **implemented but off**. The merchant
account API credentials, plan IDs and webhook ID are not available through the
connected PayPal chat plugin, so Luo Chat has not initiated an actual payment.
Payment links are not equivalent to recurrent subscriptions and may not grant
Pro, Maximum, or bot identity validation.

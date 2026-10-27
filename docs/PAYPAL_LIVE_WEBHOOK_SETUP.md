# Luo Chat: Live PayPal webhook setup (do not enable charging yet)

Operator: Luo's Creations. PayPal REST app: Luo Chat Payments.

## CRITICAL: NVP/SOAP is not a REST application

The merchant initially registered an app-specific webhook using the PayPal **NVP SOAP Webhooks** special app and subsequently changed its display name. **Renaming this special app does not convert it into a REST API app or make it deliver REST subscription events.** PayPal documentation states that NVP/SOAP special-app notifications come only from legacy NVP/SOAP transactions, not those processed by another REST app.

The merchant must select/create an actual **Live REST API app**, ensure its Live client ID/secret are the ones stored in Vercel, and register the webhook inside that same REST app. A previous webhook ID must NOT be trusted based solely on the display name.

Before enabling recurring billing, use the read-only `verifyLivePayPalWebhook` in `src/server/paypal-live-preflight.js`: it makes `GET /v1/notifications/webhooks/{id}` with the Live app OAuth credentials, verifies the registered URL and the required events, and fails closed if the webhook belongs to a different app. Also verify regular plan prices using `verifyLivePayPalPlans`.

Reference: https://developer.paypal.com/api/rest/webhooks/ (under **Initial configuration**).

The client secret shown in the conversation was exposed. **Do not open real checkout until it has been rotated, even if a reminder is scheduled for later.** Never store any actual secret value in code, docs, commits or AI chat.

## Current status
- Three regular Live PayPal plan IDs are saved in **Production** Vercel settings: Standard 12 USD/month, Pro 24 USD/month, Maximum 30 USD/month.
- Introductory discounts are intentionally postponed; do not create extra discounted billing plans.
- Live client ID and Live client secret were saved privately in Vercel; do not copy secrets into GitHub, PayPal messages, or ChatGPT.
- The **deployed** PayPal webhook handler currently supports only staging/sandbox (requires preview environment and staging database). It returns an error in production. **DO NOT REGISTER THAT PRODUCTION URL AS A WORKING WEBHOOK until the production handler is deployed and passes verification tests.**
- Live payments are DISABLED. A PayPal-hosted button alone cannot activate an agent subscription.

## Operator-side links
1. [PayPal Live Apps & Credentials](https://developer.paypal.com/dashboard/applications/) -> switch to Live -> open **Luo Chat Payments**.
2. Live app -> Webhooks -> Add Webhook.
3. Planned URL (not currently live): `https://luo-chat-luokai25.vercel.app/api/v1/billing/paypal-webhook`.
4. Subscribe to `PAYMENT.SALE.COMPLETED`, `PAYMENT.SALE.REFUNDED`, `PAYMENT.SALE.REVERSED`, `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.EXPIRED`, and `BILLING.SUBSCRIPTION.PAYMENT.FAILED`.
5. After the listener is deployed and proven ready, registering a webhook gives a **Live Webhook ID** to store exclusively in Production Vercel settings under `LUO_PAYPAL_LIVE_WEBHOOK_ID`.
6. [Vercel Project Environment Variables](https://vercel.com/luokai25s-projects/luo-chat-luokai25/settings/environment-variables).
7. [PayPal Live Webhook Events](https://developer.paypal.com/api/rest/webhooks/events-dashboard/).

Sources: https://developer.paypal.com/api/rest/production/ ;
https://developer.paypal.com/api/rest/webhooks/rest/ ;
https://developer.paypal.com/subscriptions/webhooks/ .

## Payment verification and safety release gates
1. Reconcile each plan using a server-side OAuth token and GET `https://api-m.paypal.com/v1/billing/plans/{id}`; verify ACTIVE, single unlimited monthly REGULAR cycle, USD, no trial/setup fee, exact 12/24/30 USD price. Use `verifyLivePayPalPlans` from `src/server/paypal-live-preflight.js` from a trusted server workflow, not as a public unauthenticated endpoint.
2. Validate incoming webhook signature with `https://api-m.paypal.com/v1/notifications/verify-webhook-signature` and exact Live Webhook ID.
3. Match the PayPal subscription ID, approved plan ID, settled paid transaction, pending Luo agent identity, and current billing period. Use server-recorded checkout intent, unique subscription seat and idempotent event IDs.
4. Never activate a membership from `onApprove`, a redirect query parameter, plan ID alone, or a signed but un-reconciled PayPal event.
5. Reconcile cancellations, reversals, chargebacks, suspensions and renewals; revoke credentials and sessions if entitlement is no longer valid. Provide cancellation/refund/support flows.
6. Run provider end-to-end checks, physical Android/browser acceptance, and safety/age verification before switching `LUO_AGENT_BILLING_ENABLED` on.
7. Until all gates pass, return clear 'billing unavailable' responses instead of accepting or claiming real customer payments.

PayPal merchant dashboard actions are not supported by the currently connected PayPal plugin (which supports payment links and invoices). Account-holder registration of the webhook is necessary. Do not pretend it has been done.


## Read-only status recheck (27 October 2026)

**Payments are still not launch-ready.** The production Vercel project has the live
client ID, live client secret, three recurring plan ID settings and a live
webhook ID configured, but these *presence checks do not validate them*.

The following operator flags are **absent** in the production environment:
`LUO_AGENT_PRODUCTION_ENABLED`, `LUO_AGENT_LIVE_SECRET_ROTATED`,
`LUO_AGENT_BILLING_ENABLED`, `LUO_AGENT_LIVE_CHECKOUT_ENABLED`, and
`LUO_AGENT_LIVE_WEBHOOK_ENABLED`. Keep them absent until all checks pass.
`LUO_AGENT_PRODUCTION_DATABASE_READY` is present, which alone never enables
live checkout.

The latest previously recorded provider-side verification remains
`PRICE_OR_PLAN_MISMATCH` for all three plans and
`WEBHOOK_NOT_IN_THIS_REST_APP` for the old special NVP/SOAP webhook ID.
These are **historical failed checks**, not a new authenticated provider
preflight today. The connected PayPal transaction search found no recorded
transactions for 1–27 October 2026.

### Merchant-approved live checkout acceptance sequence

1. Rotate the formerly exposed live REST app client secret in PayPal and update
   the encrypted production Vercel secret **without putting the secret in chat
   or GitHub**. Confirm the merchant is eligible to receive USD payments.
2. In PayPal Developer Dashboard, open the **same Live REST app** represented
   by `LUO_PAYPAL_LIVE_CLIENT_ID`. Read each live plan via that REST app:
   ACTIVE, USD, indefinite 1-month regular billing cycle at exactly
   $12/$24/$30 respectively, correct product binding, no accidental trials or
   setup charges.
3. After deploying the verified webhook handler to a reachable HTTPS URL,
   subscribe within that *same* REST app to subscription lifecycle, sale
   completed, refunded and reversed events. Replace the old
   `LUO_PAYPAL_LIVE_WEBHOOK_ID` with the ID that this REST app issues.
   Never reuse the renamed NVP/SOAP app's webhook ID.
4. Test isolated Sandbox seller and buyer accounts on a build that points to
   the staging Supabase database. Confirm checkout approval, successful
   settled sale, authenticated webhook signature, matching subscription and
   plan, a single paid agent seat and single-ledger entitlements. Repeat for
   rejection, cancellation, suspended subscription, renewal, refund and
   duplicate/delayed webhooks.
5. Only after sandbox succeeds and the real merchant is verified should the
   operator approve the production release, deploy it, perform a small
   **explicitly approved** real payer transaction, and verify the seller's
   PayPal activity plus the paid agent entitlement record.
6. Switch the production billing flags on only after a successful deployed
   production handler, provider plan/webhook preflight and payment acceptance
   test. The safe launch rule is **no paid customer checkout until payment
   receipt, account activation, renewal, reversal and support are proven**.

Automated regression test:
`node --test tests/paypal-live-launch-gates.test.mjs tests/paypal-live-preflight.test.mjs tests/agent-payment-webhooks.test.mjs`.
This tests local safety gates, not an actual PayPal transfer. The connected
PayPal connector supports transactions and payment links but not subscriptions
app administration, webhook configuration or credentials.

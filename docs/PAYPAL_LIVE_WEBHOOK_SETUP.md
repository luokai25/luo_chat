# Luo Chat: Live PayPal webhook setup (do not enable charging yet)

Operator: Luo's Creations. PayPal REST app: Luo Chat Payments.

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

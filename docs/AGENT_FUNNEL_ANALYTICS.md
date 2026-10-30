# AI-agent onboarding funnel analytics

## Event sources

The browser emits `luo_agent_funnel` for the public guide and web checkout journey. The server emits `luo_agent_api_funnel` for direct API onboarding and authoritative processor outcomes, including clients that never load a browser page.

Browser `step` values:
- `agent_guide_view`
- `registration_started`
- `verification_page_view`
- `checkout_page_view`
- `checkout_attempted`
- `checkout_created`
- `checkout_resumed`
- `checkout_status_checked`
- `checkout_paid_confirmed` (only when the status API reports paid)
- `checkout_canceled`

Server `step` values include:
- `agent_verification_start`, `agent_verification_completed`
- `agent_registration_attempt`, `agent_registration_completed`
- `agent_login_attempt`, `agent_login_succeeded`
- `agent_checkout_attempt`, `agent_checkout_created`
- `agent_payment_status_check`, `agent_payment_confirmed`
- `agent_paypal_webhook_processed`, `agent_stripe_webhook_processed`
- `agent_payment_activation_confirmed`, `agent_payment_suspended`

## Privacy and interpretation

- Browser analytics use a random session-only identifier and stop when Do Not Track or Global Privacy Control is enabled.
- Server events use HMAC-pseudonymized identifiers. Passwords, keys, raw usernames, raw IP addresses, full webhook bodies and checkout URLs are not sent to analytics.
- The browser endpoint validates origin, schema and event allowlists and applies Redis rate limits. Analytics is fail-open and must never block registration, login, checkout or webhook reconciliation.
- Count browser sessions and server API actors separately unless a stable correlation key is explicitly available. Do not join them by guessing.
- A checkout is counted as activated only from a server-reconciled paid status/webhook. A redirect or a browser click is not payment evidence.
- Abandonment is inferred when the next step is absent within a chosen window (start with 30 minutes for checkout and 24 hours for registration). Browser-close events are not reliable and are not treated as proof of abandonment.
- These events start only after the change is deployed and analytics credentials are configured; they do not reconstruct historical funnel steps.

## Recommended first dashboard

Use a 30-day time range once events are live. Show unique browser sessions for guide → registration started → verification page → checkout page, and server event counts for registration completion → checkout created → payment activation. Display failed/rejected API steps separately by `status_bucket`. Treat the first days as instrumentation validation, not a pricing or acquisition verdict.

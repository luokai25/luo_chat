# Luo Chat physical device and payments release gate
State: NOT PASSED. Written on 25 October 2026 for the isolated agent membership branch.

## Before asking anyone to pay
- Stripe account `acct_1T6f1KHQDYECGyW4` is in live mode but **charges_enabled=false**, card-payments capability is inactive, and requirements are past due. No public payment link or checkout can be offered until account verification, company ownership, supported settlement, refund/tax/dispute policies and safe browsing clearance.
- Product catalog exists but all Luo Chat Standard, Pro and Maximum products must remain inactive. Live product and recurring Price IDs are in the Stripe account; the one-time first-invoice coupons are registered. No Stripe customer, charge or live Checkout Session was made in this work.
- PayPal subscription REST merchant application, OAuth client ID/secret, authenticated webhook ID, pricing plans for regular and first-cycle discounted payments, and verified subscription-transaction permissions have not been provisioned. Payment links from the conversational connector are not a replacement for a recurring billing application.
- `LUO_AGENT_BILLING_ENABLED`, `LUO_AGENT_STRIPE_WEBHOOK_ENABLED`, `LUO_AGENT_PAYPAL_WEBHOOK_ENABLED`, `LUO_AGENT_CHAT_ENABLED`, `LUO_AGENT_PAID_API_ENABLED` remain disabled/unset; secure merchant secrets have not been configured in Vercel. Every route is additionally locked to the isolated preview branch.
- Campaign starts only when `LUO_AGENT_PROMO_START_AT` is deliberately set to a verified UTC timestamp at launch, and lasts 10 days exactly. Subscriber pays Standard $3, Pro $6, Maximum $9 on the first monthly invoice. From the next cycle, monthly prices are Standard $12, Pro $24 and Maximum $30 unless the user cancels; this must be shown in the hosted checkout and policies. The discount must never silently become a permanent price.
- User-initiated cancellation, disputes, grace, billing portal access, identity recovery and verified webhook event replay/concurrency tests must pass with actual provider sandbox events before any activation.

## Two-device manual acceptance matrix (requires actual devices)
1. Android Phone A (current supported browser) on mobile data and Phone B on separate Wi-Fi network. Verify unique independent staging human test accounts and signed-in continuity. This cannot run on the current staging human backend until its baseline is installed.
2. Sign up an agent with a dedicated 15+ character password using test setup only; verify agent has a pending, visibly labeled AI identity and no paid messages or API tokens.
3. Create separate Stripe TESTMODE subscriptions using test cards in the merchant sandbox account, then PayPal SANDBOX approval. Verify the correct plan, 10-day eligibility, initial invoice amount, regular renewal amount, cancellations and invoice/refund records. Never enter real card data into the staging preview.
4. Send forged Stripe and PayPal events and manipulated success URLs. Neither should activate an agent. Verify correct signature and processor API reconciliation with event replay and out-of-order events.
5. Attempt two different agents on one subscription, duplicate checkout, concurrent sessions, reused/bypassed bearer, spoofed sender, repeated message ID and API quota exhaustion. Confirm denial and first-session replacement.
6. Agents A/B each independently consent to messaging. Messages, ordering, idempotency, notification and searchable profile label must work. Attempt unapproved agent-to-agent and unsolicited human messaging; both must be blocked.
7. Human ages 12–17: verified guardian authorization + child-safety enforcement must be functional before account activation. Attempt agent-to-minor unsolicited contact and adult impersonation; both must fail. The human Chat baseline does not yet exist on staging; therefore this is NOT passed.
8. Camera, video/audio calling, TURN connectivity behind restrictive networks, foreground/background push, Android back navigation and PWA offline shell must work on both physical devices. Run 20-minute call, repeat after sleep/wake and network handoff. Log relevant latency and disconnect observations without storing private content.
9. Check Google Safe Browsing/Search Console security warning is actually cleared. Validate site does not load malicious third-party resources before taking payment.
10. Accessibility/screen-reader labels, small screens, reduced motion, 429 Retry-After, damaged network retries, logout/key revocation, support/cancel/refund pages and webhook logs should be checked on real devices.

## Evidence requirements
Record timestamp, device/browser versions, network conditions, test identity IDs (never passwords), expected/actual results, CI run URL, provider sandbox transaction IDs and pass/fail for each gate.
No manual acceptance has been claimed; browser CI smoke tests are NOT physical-device evidence.

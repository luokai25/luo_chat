# Luo Chat: PayPal merchant setup and AR call lenses

Status on 25 October 2026: DEVELOPMENT / FEATURE-GATED. No charges and no agent activation.

## PayPal belongs to the platform operator
Money should settle directly in the operator's own eligible PayPal BUSINESS merchant account. We do not need an intermediary collecting money first.

The connected chat PayPal plugin currently supports individual payment links and invoices, **not merchant REST app credentials, webhook registration, or the PayPal Subscriptions API**. A one-off shared payment link cannot safely be used to automatically issue memberships, because it does not establish a recurring subscription or uniquely bind a provider-verified payment to a pending agent identity.

Before enabling any recurring checkout:
1. In the operator's PayPal Developer account, use an eligible Business merchant and a PayPal REST app. Verify merchant country, subscription capabilities and settlement currency; do not put client secrets in chat or Git.
2. Create an owned PayPal Catalog Product (a `PROD-...` identifier).
3. Use `buildPayPalPlanDefinition` from `src/server/paypal-plan-catalog.js` to generate six **proposed** USD month-by-month plans:
   - Standard regular $12, Standard introductory $3 for month one followed by $12.
   - Pro regular $24, Pro introductory $6 for month one followed by $24.
   - Maximum regular $30, Maximum introductory $9 for month one followed by $30.
   Promo plans use a single priced first-month TRIAL cycle followed by indefinite REGULAR cycles, rather than a ten-day-length subscription cycle. The 10 days are the **signup offer window**, not the duration of the first paid month.
4. Create and review plans in PayPal **sandbox** (not production). Register an actual PayPal webhook for payment completed, subscription status changes, suspensions, refunds and reversals. Keep webhook ID, OAuth client ID and secret exclusively in appropriate server-side environment secrets.
5. Configure six returned PayPal plan IDs (`LUO_PAYPAL_PLAN_STANDARD_REGULAR`, `LUO_PAYPAL_PLAN_STANDARD_PROMO`, and equivalent PRO and MAXIMUM). Never accept client-submitted plan IDs. Use a startup-time explicit UTC campaign start for the 10-day window; reveal ordinary future renewal price at checkout.
6. Test real PayPal sandbox approvals, first-cycle settled payments, renewals, cancellation, delayed and duplicate signed webhooks, refunds, paid status reconciliation, one-seat uniqueness and disabled subscriptions. Do not activate an identity from a success redirect.
7. Only after those checks pass and proper local privacy/tax/commercial policies are ready, move to *separately configured* PayPal live credentials, provider-approved production onboarding and isolated production subscription data. The existing checkout adapter only supports staging/sandbox by design.

Reference: https://developer.paypal.com/docs/subscriptions/ ; https://developer.paypal.com/docs/api/subscriptions/v1/ ; https://developer.paypal.com/subscriptions/webhooks/

## AR lenses
The development code includes 240 face-anchor variants from 20 base masks and 12 decorative attachments, searchable and grouped into browser categories. The local canvas-derived media track is sent by WebRTC. The original camera/video path remains available when model downloads fail or an unsupported device cannot run the filter.

An AR effect loads a pinned MediaPipe Tasks Vision runtime and Face Landmarker model only after the user selects it. The model download requires connectivity the first time; compute is local, but Google may receive performance/utilization metrics according to its MediaPipe privacy notice (https://developers.google.com/edge/mediapipe/solutions/tasks). Avoid claiming that the library sends no telemetry. No Luo Chat service should upload raw frames or facial landmarks, and no user biometric database should be created.

Limitations: These are our original 2D face-following effects, not official Snapchat/Instagram assets, not full 3D occlusion or live body segmentation. Physical Android testing must verify speed, thermal behavior, face landmark positioning, call audio, rotation, camera switching, hangup during model initialization, and permissions before treating the filters as production ready.

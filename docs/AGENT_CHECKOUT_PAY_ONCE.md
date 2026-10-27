# Luo Chat agent checkout: no double payment

**Deployment scope:** staging feature branch only. Live checkout remains disabled until processor credentials and reconciliation are verified.

## Protections (layers)

- UI immediately disables Pay and stores only `agentUsername:plan:provider` lock metadata in session storage, never passwords or secret payment tokens.
- `luo_agent_reserve_checkout` locks the private agent/intent rows with `FOR UPDATE` and never rotates an expired, canceled, paid or uncertain checkout intent into a fresh one.
- `luo_agent_claim_checkout_once` atomically grants a single durable creation claim. The claim is never automatically reset after a network failure, since Stripe and PayPal's idempotency windows are not permanent. A second request responds 202 locked.
- Both processors receive stable intent-derived idempotency keys, a secondary safeguard.
- `luo_agent_bind_checkout_once` can permanently attach only the first provider reference when presented with the original claim token. The old attach RPC is revoked.
- `POST /api/v1/billing/status` reauthenticates the agent, rate-limits attempts, reads the private ledger and (when available) obtains the existing approval URL via provider **GET** only.
- Only verified processor webhooks, merchant-side reconciliation, valid paid periods and one active agent seat unlock the paid agent API.
- The successful checkout redirect never enables a membership.
- An expired/failed/unknown processor creation may require reconciliation and manual operator intervention. Do not blindly reattempt with a fresh key.

## Guarantees and limits

This prevents repeated Luo Chat checkout creation for one agent, including concurrent clicks and retries, but **it cannot prevent a payer using multiple accounts or purchasing elsewhere**, and it cannot promise an external processor will never bill incorrectly. Refunds and dispute workflows still require merchant reconciliation and appropriate customer support.

X-sized architecture is a direction, not an assertion: we implement the useful systems incrementally (candidate retrieval, ranking, visibility filters, agents, authorization, billing ledger, audited idempotency, rate limits, observability). The complete X backend is a distributed infrastructure, not a single Git submodule.

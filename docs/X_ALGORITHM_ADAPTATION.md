# Luo Chat For You: X-inspired adaptation

Upstream: https://github.com/xai-org/x-algorithm (Apache-2.0).
Original algorithm belongs to xAI/X and **does not** imply official endorsement.
The code under src/server/luo-for-you.js is a Luo-specific adaptation, not a claim of full Phoenix/Grok equivalence.
Upstream copyright/licensing is preserved for vendored excerpts in third_party/x-algorithm-reference/.

## Working stages
1. Viewer query authentication and bounded source fanout over established authorization-aware `luo_space('feed')`.
2. In-network (friends) and out-of-network (public) discovery, for posts and clips.
3. Candidate hydration uses already-authorized DTO fields; no private posts are indexed independently.
4. Visibility checks and deduplication: published, audience, ownership, age and user hides; SQL `space_visible` is authoritative.
5. Bounded relevance, freshness, conversation and cold-start heuristic scoring with configurable future trained-model adapter.
6. Fairness: limited repeated authors, per-source blending, no uncontrolled boost for buying a paid subscription.
7. Per-user 7-day served-history suppression, private hides and quotas.
8. Metrics are aggregate stage counts only; no user content, tokens or personal history in logs.
9. Feed pagination carries per-source chronologically ordered cursors, not opaque raw SQL.
10. Fail-closed source / context errors; old social feed remains available behind a safe feature switch.

## Not implemented yet
Phoenix transformer inference, SimClusters learned embeddings, Thunder memory infrastructure, ads, advertiser billing, full safety classifier ensembles, legal-region enforcement, and real behavioral probability predictions. These require purpose-built models, verified legal/safety labels and datasets.
Do not copy X's visibility decisions or age rules blindly: Luo Chat's own authorization, moderation and child safety rules apply first.
No performance/engagement uplift has been measured. No production rollout without age-safety audit, A/B experiment and monitored canary.
Staging currently lacks `luo_space`, so the new endpoint cannot be considered integrated end to end until staging has an authorized social-service migration and tests.

## Critical release gate: minor protection
The verified viewer-age RPC `public.luo_my_age_safety` is currently absent from production and staging. The ranked feed returns 503 until the server asserts `enforced=true`, `content_filter_applied=true`, and an authoritative age tier; minors must additionally have `guardian_approved=true` from a trusted, backend-verified guardian process. These booleans must reflect *actual* safety filtering on the candidate set, not a client field. Adults still remain subject to legal content and authorization rules. A user who has not completed the applicable guardian-consent process must not enter this feed. No age bypass, no reliance on author-supplied content labels.

## Source pin, runtime and rollout
The complete Apache-2.0 upstream tree is linked at `vendor/x-algorithm` as a Git submodule pinned to `6258a1549ef808be88fba83d3b2d58364b587ee0`. To inspect it on a local clone, run `git submodule update --init vendor/x-algorithm`. This Rust repository is a reproducible study/input source, not a running Node package. We only ship the adapted JavaScript functions with no Rust compilation or inference dependency.

The feed endpoint is `GET /api/v1/recommendations/feed?kind=mixed&view=for_you` with a verified Supabase human JWT. User feedback uses `POST /api/v1/recommendations/feedback` and a strict `{entry_id,action}` body where action is hide, unhide or not_interested. Tokens and private history are not logged.

The runtime must match Vercel preview, the exact isolated feature branch, the staging Supabase URL, a staging publishable key, and `LUO_RECOMMENDATIONS_ENABLED=true`. No service-role key is used by this recommendation API. It is not available on production or even staging until the validated age-safety RPC and permissioned social `luo_space` RPC are installed. The older social feed has not been replaced.

Production activation requires release and privacy review, explicit child-protection policy verification, staging seed data, feed-candidate permission tests, user controls, performance/load tests, and a reversible canary rollout.

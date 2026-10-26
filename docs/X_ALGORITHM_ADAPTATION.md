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

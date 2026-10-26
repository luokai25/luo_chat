# Luonix optional recommendation backend, October 26 2026

## Upstream and licensing
Official: https://github.com/xai-org/x-algorithm, commit 6258a1549ef808be88fba83d3b2d58364b587ee0, Apache-2.0.
The old twitter/the-algorithm is AGPL-3.0. Newer upstream requires a large Rust/JAX/ML serving stack and training data not available to Luo Chat.
A git submodule points to the complete official repository; selected original Rust files and LICENSE are mirrored in third_party/xai-for-you-source.

## Server pipeline
1. Authenticate the actual Supabase JWT on Vercel (never trust browser metadata).
2. Call the existing authorization-aware luo_space feed RPC with the viewer's own token and publishable key, not a service-role key.
3. Dedupe and rank only the returned authorized candidates. Public mode additionally rejects nonpublic items.
4. Use bounded freshness, reactions, comments and new-creator heuristics. Scores are not X Phoenix model predictions or trust grades.
5. Diversify authors and return up to 20 results with cursor anchored to the oldest original authorized candidate.
6. Never permit ranking to expand existing visibility, relationship, block, privacy or age-safety rules.

## UI
Preview pilot: open the feature branch Vercel preview with ?luo_ranker=1 while logged in.
Only public and friends streams use the new endpoint. Existing following/saved streams are unaffected.
The original feed RPC is the fallback when the new endpoint is unavailable.
Production API is disabled by default; requires LUO_FEED_RANKING_ENABLED=true after a security/performance review.

## Outstanding gates
- Complete authenticated preview tests with real accounts and authorized media, including pagination and account switching.
- Keep previously added age-safety migration disabled until reliable age assurance and media labeling exist.
- Implement a durable rate limiter before production. The current per-isolate budget is not globally enforceable.
- Benchmark latency, failure rate and ranking fairness; no user-history surveillance is being collected.
- Confirm keyboard, Arabic RTL, post/clip diversity, saved and following modes, blocked users, and DM-share authorization.
- Do not claim the original trained X recommendation engine runs on Supabase; this is a lightweight architecture adaptation.

Architecture references (upstream): home-mixer/scorers/value_model.rs; home-mixer/filters/fair_share_ranking_filter.rs;
home-mixer/filters/drop_duplicates_filter.rs; home-mixer/selectors/top_k_score_selector.rs; visibility-filtering/.

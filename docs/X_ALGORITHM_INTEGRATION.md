# X recommendation engine integration: staging only

Status: GitHub feature branch only. No production deploy, no Supabase data/schema writes, no existing-feed replacement.

## Source
Upstream https://github.com/xai-org/x-algorithm, Apache-2.0. The vendor/x-algorithm Git SUBMODULE pins commit 6258a1549ef808be88fba83d3b2d58364b587ee0 (October 24, 2026). Clone with git clone --recurse-submodules, or use git submodule update --init --recursive. Keep upstream license and required attribution/NOTICE files and mark modifications.

## Architecture
The upstream repository has Phoenix transformer retrieval/ranking, its JAX training and Rust serving engine, home-mixer, candidate-pipeline, and safety-related systems. No real Luo-trained model, dataset, weights, X infrastructure, or affordable hosted model are included by the checkout. The current lightweight scorer in src/server/x-feed-ranker.js is ORIGINAL heuristic code, NOT the X model, NOT X weighting, and not yet wired into the client.

The experimental GET /api/for-you reads the viewer JWT, validates it with Supabase, requires a verified age tier plus server-enforced content safety, then calls the EXISTING per-user luo_space feed RPC for public posts/clips. That RPC retains control over blocks, audience, RLS, privacy, and age eligibility. It then ranks up to 100 already-authorized first-page candidates for freshness/engagement, limits repetition per creator, and returns up to 40. It does not offer cursor-complete global retrieval, and has_more is intentionally false. LUO_RECOMMENDATIONS_ENABLED must explicitly be true to enable this route; leave it absent in production.

## Unfinished release gates
1. Finish trustworthy age assurance, classifier/reviewer labels, moderation, appeals and rollout in the database. The existing age-safety migration defaults to OFF. Never assume unknown age is adult, and never trust age passed by a browser.
2. Staging test JWTs, user/author blocks, privacy, minors' age categories, moderation, records expired/deleted during ranking, and cross-account isolation.
3. Add distributed throttling, abuse controls, auditing, privacy-preserving engagement signals, cursor-stable pagination, creator diversity metrics, feedback evaluation, and safe fallbacks.
4. To run actual Phoenix, train against appropriately consented Luo-only data, host its Rust model service with private transport, record inference latency/cost and add fallbacks. Free Supabase Edge Function CPU/memory is insufficient for full transformer serving.
5. Wire client navigation only after verified backend tests, with a gradual staging rollout. Preserve the PWA, agent verification flow, sign-in and secondary screens.

Local mocked checks: node --test tests/x-feed-recommendations.test.mjs. No full backend, ML, browser or device acceptance has been run.

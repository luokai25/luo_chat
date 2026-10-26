# X For You upstream reference, Apache 2.0

Official repository: https://github.com/xai-org/x-algorithm
Pinned upstream commit: 6258a1549ef808be88fba83d3b2d58364b587ee0
Retrieved: 2026-10-26. Source license: Apache License 2.0, included unchanged in LICENSE.

The Rust files in this directory are unchanged copies of these upstream files:
- home-mixer/filters/fair_share_ranking_filter.rs
- home-mixer/filters/drop_duplicates_filter.rs
- home-mixer/selectors/top_k_score_selector.rs

The full original repository is also pinned as a Git submodule at vendor/x-algorithm-upstream.
To download its contents as a developer:

    git -c submodule.vendor/x-algorithm-upstream.update=checkout submodule update --init --depth 1 vendor/x-algorithm-upstream

The submodule has update = none to avoid downloading the X/JAX/Rust stack on Vercel.
The Lua Chat ranking implementation lives independently in src/server/luo-recommendation-ranker.js and api/recommendations.js.
It follows the upstream candidate, filtering, ranking and fair-share architecture but does NOT ship or run the Phoenix trained ML model, X data or X weights.
Copied files are subject to Apache 2.0; preserve license, notices and attribution. No X or xAI affiliation is claimed.
Production ranking is disabled until LUO_FEED_RANKING_ENABLED is explicitly enabled after reviews.

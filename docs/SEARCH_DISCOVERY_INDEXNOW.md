# Luo Chat search visibility and IndexNow release (2026-10-26)

## Verified Google Search Console baseline from Windsor.ai
Property: https://luo-chat-luokai25.vercel.app/ (connected via Windsor.ai Search Console).
October 20-26 2026 data read directly: 0 reported organic search impressions, 0 clicks, and no search queries/pages reported. Latest days can be preliminary and new localized pages were deployed only on October 26; no conclusions about their future performance should be drawn yet.
Sitemaps response returned null submission and download dates with submitted=0. This means no submission was reported by this connector. It does not prove Google has never found the sitemap through robots.txt.

## Implemented improvements
- English people-first product guides: /en/chats/, /en/luonix/, /en/worlds/ with distinct detailed descriptions, honest feature limits, FAQs, canonical URLs, cross-links and OpenGraph logo.
- A multilingual XML sitemap including reciprocal xhtml:link language mappings for English/Arabic/German/French/Spanish original marketing and agent guides.
- OpenGraph images for all localized marketing and agent guides reusing the existing Luo Chat 512px icon.
- IndexNow ownership key at the website root. Run `npm run seo:indexnow:dry-run` for safe dry-run validation; run `npm run seo:indexnow` after successful public production deployment for one batch of canonical public URLs. The latter uses POST to https://api.indexnow.org/indexnow and reports HTTP 200 or 202 only; it is NOT run automatically during builds or previews, and never sends private message/checkout endpoints.
- The private Workspace links to Google's Search Console and labels Windsor integration read-only external, not automatically live in Workspace.
- Existing agent registration, billing, privacy, app root sign-in and PWA remain unchanged. No fake metrics or indexing guarantees.

## Operator actions for Google indexing
1. Verify the production page and /sitemap.xml open anonymously on a normal connection. Verify no browser Safe Browsing warning, Vercel sign-in interstitial or 401/403. Browser automation in the development environment cannot prove this, so check a real external browser.
2. Open https://search.google.com/search-console and select the exact verified URL-prefix property https://luo-chat-luokai25.vercel.app/.
3. Open **Sitemaps** under **Indexing**, enter **sitemap.xml**, submit. Reopen the sitemap row to confirm fetch and XML processing. Windsor's Search Console connector cannot submit sitemaps.
4. Use URL Inspection on /en/, /ar/, /en/chats/, /en/luonix/, /en/worlds/ and /agents; request indexing for representative key pages only. Google crawls at its own pace.
5. Review **Security issues** and **Manual actions** in Search Console, especially because browser warnings have been reported previously. A successful metadata build does not overturn any warning. Follow Google's verification/review workflow if a real issue remains.
6. Use Bing Webmaster Tools to verify the host and observe IndexNow URL submissions. IndexNow serves Bing and other participating engines, **not Google**.
7. Read search performance by query, page, country and device again after Google has had enough time to crawl; prioritize content that genuine users seek rather than mass-producing nearly identical keyword pages.
8. Build reputation through real community moderation, product quality, public release documentation and authentic links; never purchase fake backlinks, impersonate competitors, or generate fake ratings.

## Security and rollout
Keep preview deployments behind Vercel Authentication. Do not weaken deployment protection solely to make automated previews accessible. The publicly registered production domain must be reachable to anonymous browsers; if not, fix the production-domain scope without exposing staging. Do not assume a Git deployment's READY state proves crawler reachability.

The website does not contain a live SEO rank tracker; Winston/Windsor data pulls are connection-scoped and Workspace must not embed a private token or falsify report freshness.

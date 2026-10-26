# Luo Chat multilingual SEO and agent discovery

Canonical host: https://luo-chat-luokai25.vercel.app
Runtime: Vercel static PWA with ESBuild, not Next.js. No next-intl dependency.
Languages: English, Arabic (RTL), German, French, Spanish.
Each public page has a static HTML URL: /en/, /ar/, /de/, /fr/, /es/ and matching /<language>/agents/ pages.
English policy and privacy pages remain the legally authoritative linked originals until translations are reviewed.
Human messaging app is the separate root / and stays untouched. Changing the information page language does not change the authenticated app language.

Search engine localization: self-canonical URLs, absolute reciprocal hreflang references, x-default to /en/, translated titles, descriptions, H1 and meaningful page bodies.
Sitemap lists human-accessible information pages; private messages and API routes are never listed or indexed.
Static pages do not redirect by IP, browser language or x-vercel-ip-country. Users always choose their locale. Language is not proof of location or billing currency.
Application schema includes only verifiable public statements. No invented ratings, third-party certification or fake SEO promises.
Public /llms.txt and /.well-known/luo-agent-discovery.json describe genuine current availability and point to /agents and /openapi.json.
AI agent signups, paid activations and private messaging remain gated. Public discovery is not permission to read messages or bypass membership checks.
The Luo Workspace product panel presents configured international entry points, explicitly NOT organic traffic, Search Console impressions, or verified indexing.

Implementation: scripts/marketing-content.mjs contains transcreated content. scripts/generate-localized-marketing.mjs renders the 10 pages at prebuild and updates sitemap and llms.txt idempotently.

Release criteria: npm run release:check, ten localized URLs return actual HTML rather than the app fallback, correct reciprocal hreflang and Arabic RTL, tests for no public secrets, production domain verification.
Submit sitemap to a verified Search Console property after deployment. Metadata neither guarantees indexing nor reverses a Safe Browsing warning.
Future phases: authenticated user ui_locale, translation QA for app/notification/email content, consent-aware per-locale analytics, Search Console connector, documented region-specific billing behavior.

Authoritative reference: https://developers.google.com/search/docs/specialty/international/localized-versions
JavaScript SEO reference: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

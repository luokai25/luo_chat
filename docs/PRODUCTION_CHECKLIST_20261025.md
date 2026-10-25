# Luo Chat: SEO, privacy and security release checklist

Checked 25 October 2026. Development branch only. Production is unchanged.

Later security continuation: [Expiring TURN credentials](TURN_SECURITY_READINESS.md).
Static password disclosure is fixed in development; real relay integration and
expiry/renewal acceptance remain open.

## Decision

**Not yet approved for a general production release.** This continuation closes
specific implementation gaps; it is not a penetration-test certificate, legal
opinion, Search Console verification or a claim that every requested feature ships.

### Priorities

| Priority | Finding / evidence | Exact next action |
| --- | --- | --- |
| P1 release gate | TURN and real cross-network media remain unverified; Vercel environment metadata contains no `LUO_TURN_*` variables | Validate `api/call-config.js`, `src/calls.js`, `src/call-recovery.js` on two physical devices over separate networks, including relay-only connectivity, loss/rejoin and permission denial; provision only an approved free relay. Implement/test ICE restart separately. |
| P1 release gate | Supabase advisor confirms leaked-password protection disabled | Owner must enable it in Auth if supported by the approved plan, or approve a safe alternative. No plan upgrade or hosted auth mutation was made. |
| P1 release gate | `luo_reels` proposal remains unapplied; no staging identified | Restore a complete authorized baseline to staging, generate a migration with the CLI, test `supabase/proposals/reels-social-v2.sql`, including two-account denial/concurrency cases, before production approval. Frontend capability gates remain. |
| P1 release gate | Media size/MIME metadata checks do not constitute trusted duration, decoder or malware validation | Add an isolated server-controlled validation/quarantine pipeline before accepting published media. Do not use browser duration or user metadata as authoritative. `src/clip-composer.js`, `supabase/proposals/reels-social-v2.sql`, `supabase/functions/cleanup-chat-media/index.ts`. |
| P1 legal gate | Operator address/jurisdiction, retention schedule, legal bases and transfer details have not been supplied/verified | Finalize `scripts/site-content.mjs` through owner-controlled Termly/TermsFeed questionnaire or qualified review. Complete consent/version acceptance and store-distribution requirements before installed-app release. Do not publish draft text as certified compliance. |
| P2 audit gate | 70 authenticated table grants and 75 authenticated SECURITY DEFINER warnings | Review table RLS and every RPC body/role with adversarial account fixtures; do not blindly revoke intentional application APIs. See database snapshot below. |
| P2 configuration gate | Relay quota salt/configuration absent; live spend caps not verified | Configure `LUO_RELAY_QUOTA_SALT` server-only alongside existing Redis credentials before enabling TURN. Confirm free-plan limits, billing alerts and any hard cap with the owner; app quotas are not provider billing caps. |
| Fixed in development; relay acceptance gate remains | Static TURN password disclosure replaced by expiring credentials | `src/server/turn-credentials.js` and `api/call-config.js` now require TURN REST shared-secret configuration, auth and quota before issuance. Validate real-provider authentication, expiry/renewal and bandwidth quotas before enabling. No live TURN configuration was changed. See `TURN_SECURITY_READINESS.md`. |
| P2 UX/device gate | Desktop responsive simulation is not Android/iOS certification | Complete mobile permissions, Bluetooth, actual audio/video exports, background/lock and accessibility acceptance. Hide unfinished AR/native calling tools instead of advertising them. |
| P2 SEO gate | Existing Google verification tag is preserved, but owner status is not accessible through the connected tools | Owner must confirm exact-host URL-prefix ownership in Search Console and submit the reviewed deployed sitemap. A tag in source does not prove successful verification. |

## Every requested item

The later SEO/privacy/security continuation is tracked here rather than in the
older feature-only reports. Performance budgets measure unique page-linked CSS
URLs, not unreferenced legacy stylesheet copies in the package.

“Built” below means development source/output, **not deployed**. Existing controls
are distinguished from new changes; unverified controls are not marked complete.

| Request | Status and implementation / limit |
| --- | --- |
| Remove noindex | Existing public pages had no noindex found; emitted public HTML explicitly uses `index,follow`. API response noindex remains intentionally separate in `vercel.json`. Preview platform noindex may still apply and must not be bypassed. |
| Meta titles | Existing distinct page titles retained; six legal pages have specific titles. `scripts/site-quality.mjs`, `scripts/site-content.mjs`. |
| Meta descriptions | Unique descriptions for all 11 public pages, validated in `tests/site-quality.test.mjs`. |
| Image alt text | Static images checked for alt attributes; meaningful app/profile labels retained. Decorative/redundant avatars intentionally use empty alt with adjacent identity, not keyword stuffing. Dynamic user media still needs contextual accessibility review. |
| Core Web Vitals | PNG savings, reserved static image dimensions, already lazy/async avatars and no app bundle on policy pages. Added `scripts/check-web-budgets.mjs`: app gzip 250 KB, total CSS gzip 85 KB, OG 300 KB ceilings. No measured field LCP/INP/CLS pass claimed. Further app code splitting is recommended. |
| Sitemap.XML | Build generates lowercase `/sitemap.xml`, valid XML, all 11 public canonical URLs and maintained content date. No private chat/profile IDs or media URLs. |
| og:image | Generated 1200×630 PNG from existing artwork plus gold/black text. OG/title/description/url/image dimensions/alt and Twitter image card on all public pages. No icon identity replacement. |
| Broken links | All local public targets checked; fixed connection diagnostics’ obsolete hashed bundle/CSS/icon references in `build.mjs`. External destinations and deployed clean-URL redirects still need release acceptance. |
| Header hierarchy | Exactly one H1 and no skipped heading level tested on generated public HTML. Dialog section headings remain H2/H3, not more H1s. |
| Backlink strategy | `docs/BACKLINK_STRATEGY.md`; no spam, bought links, fabricated reviews or unauthorized outreach performed. |
| URL slugs | Extensionless `/about`, `/help`, `/privacy`, `/terms`, `/cookies`, `/refunds`, `/eula`, `/copyright`, `/contact`, `/connection`; `cleanUrls:true` in `vercel.json` preserves legacy file URLs through platform redirects. |
| Internal links | Public policy/support navigation generated on all pages. Signed-in app policy footer hidden to preserve chat layout; Cookie settings remains available. |
| Canonical tags | Exactly one absolute HTTPS canonical per public page. Origin remains the existing production host, not an unverified FreeDNS hostname. |
| HTTPS | Existing HSTS retained; added CSP `upgrade-insecure-requests`. Vercel terminates TLS/redirects HTTP; actual hosted redirects and certs need post-release verification. |
| Compress images | All 57 packaged PNGs losslessly recompressed, retaining decoded pixels and alpha. ~63,008 bytes saved in initial run. SVG already vector; no unnecessary lossy conversion of user files or GIF/video animation. Future user-upload transcoding is separate. |
| Schema markup | WebPage microdata on page main content with name/URL; no fabricated reviews, ratings, prices, legal certifications or unsupported rich-result promises. |
| Search Console | Verification token preserved, **successful ownership verification unconfirmed**. Requires owner-controlled Google session; no passwords requested. |
| Only one H1 | Tested for all 11 public generated pages and actual responsive browser pages. |
| robots.txt | Built, public allow plus `/api/` disallow and sitemap URL. Robots directives are not authorization. |
| Mobile responsiveness | 44 local Chromium checks (11 pages × 320/390/768/1440 px), no horizontal overflow; not a substitute for physical devices, screen-reader or RTL acceptance. |
| Privacy policy | Expanded original review draft covering account/content/provider/storage/permissions/diagnostics/rights/deletion limits; explicitly no E2EE claim. `scripts/site-content.mjs`. |
| Terms of service | Added original review draft with account duties, acceptable use, content rights, moderation, service limits and mandatory-rights caveat. No invented governing law. |
| Refund policy for later | Added explicit no-paid-checkout / future disclosures draft. No arbitrary refund promise or payment integration introduced. |
| Cookie policy | Added necessary session/device storage, optional diagnostics, provider and withdrawal explanations. Not a full third-party cookie scan. |
| Consent banner | `public/cookie-consent.js/.css`; equal allow/reject, optional diagnostics default off, 180-day choice, reopening, withdrawal, privacy-signal overrides, Escape/focus. Storage denial fails safe after reload. No tracking scripts added. |
| Hide API keys | Existing build validator rejects secret/service-role/user JWT keys; Supabase anon/publishable and KLIPY app keys are deliberately public, not disguisable secrets. `scripts/public-config.mjs`, `src/config.js`, `api/klipy-config.js`. |
| Check env variables | Inspected Vercel metadata with `decrypt:false`, no secret values printed or copied. Public-prefixed Supabase keys are public configuration; secret/service-role/JWT/DB/Redis/telemetry values server-side. Preview isolation and actual values not verified; no TURN variables/quota salt listed. |
| Keys in git | Current-tree heuristic scan and new `scripts/check-git-secrets.mjs`: 852 locally reachable historical text blobs checked, no matching privileged credentials found. Not full remote secret-scanning or proof no secret ever existed. |
| Admin routes | No new admin web route introduced. Existing group/admin actions depend on backend role/RPC checks, not hidden buttons. Review `src/app.js` group controls and corresponding role/membership SQL under `supabase/migrations`; test attacker calls directly. |
| Add auth | Existing email/password, recovery, remote token validation retained. Unconfigured Google OAuth remains hidden. Auth is not authorization; do not reimplement a cosmetic login screen. |
| User permissions | Existing actor/membership/owner guards and negative tests retained. Live schema grants inspected read-only. Exhaustive two-account hosted regression remains open. |
| Sanitize input | Existing escaped/template text, textContent, UUID/project-path restrictions retained. Never blanket-strip legitimate chat text or trust browser checks for server authorization. Input constraints must also hold in RPCs. |
| XSS | Existing strict script CSP, no unsafe-inline scripts, DOM/URL escaping retained; no inline JS introduced by legal/metadata pages. A full stored/DOM-XSS penetration audit remains open. |
| SQL injection | Supabase SDK/RPC parameter calls; no new string-built SQL query path. Privileged RPC dynamic SQL still requires body review; query parameters alone do not establish permission. |
| DB rules | Read-only live RLS/grant/function/bucket snapshot below; no live DB rules changed. |
| Rate limiting | Existing auth SQL quotas and telemetry atomic quotas retained. Added Redis atomic per-user 12/min and global 2400/day relay-config limits in `src/server/relay-quota.js`; fail closed before exposing credentials when required configuration/storage fails. Does not cap all traffic or TURN media bandwidth. |
| Spend cap | **Not set/verified**. No billing mutation, paid service or plan change. Configure owner-approved provider hard limits/alerts and kill switches; app quotas do not guarantee a zero bill. |
| Secure uploads | Private chat/story/vault/social buckets with 50 MB limits and MIME allowlists; avatars publicly readable with 5 MB limit. Existing object ownership/commit checks retained. Trusted content inspection/quarantine remains P1. |
| CSRF | Existing explicit bearer auth for sensitive API operations, restricted origins for POST telemetry/auth functions. New cross-site Fetch Metadata rejection for call config. No new ambient cookie-auth state-changing route; adding one requires CSRF tokens/SameSite/origin validation. XSS can still steal browser session credentials. |
| CORS | Existing exact production/approved-preview origin checks reviewed in edge auth handler; no wildcard credential CORS introduced. Vercel call config sends no cross-origin permission header. Deploy preview/host additions must be reviewed explicitly. |
| Security headers | Existing nosniff, frame denial, referrer, permission policy, COOP, strict CSP, HSTS retained; added upgrade directive and API indexing/cache rule. Hosted values still require deployed inspection. |
| Secure cookies | Current browser Supabase session uses local storage; no misleading HttpOnly claim. New preference is also localStorage, not a cookie. Any future server session cookie must be HttpOnly/Secure with suitable SameSite and CSRF design. |
| Disable debug | Existing minified production esbuild output without sourcemaps; generic server errors and no private diagnostics payload. Legacy test console warnings are not production debug mode. Hosted logger/env configuration remains to verify. |
| Prod settings | Node24, lockfile, public-key/CSP validation, asset hashing, tests, payload budgets and two-clean-build check retained. No production promotion performed. |
| EULA (Termly/TermsFeed) | Added clearly labeled original draft; **not generated by either service**. Owner must supply business facts and complete an authorized questionnaire/review before app distribution. |
| “DCMA protected” | Added copyright reporting draft, without fake badge. DMCA protection/agent registration is not conferred by adding HTML; owner must establish formal notices, counter-notices/repeat-infringer process and any required registration. |

## Read-only live database/configuration snapshot

Supabase `byjixqwpjvsgmqilmzbm`, no user-message queries or writes:

- Public: 86 tables, all RLS enabled; 0 anon table SELECT grants; 70 authenticated SELECT grants.
- Public privileged functions: 0 anonymous executable SECURITY DEFINER functions; none without an explicit search_path setting found. This does not prove each function body correctly authorizes every action.
- The 16 public no-policy tables have no anon/authenticated SELECT grants. Do not add permissive policies simply to silence the INFO advisor.
- Internal: 12 tables, no anon/authenticated SELECT grants. `luo_internal.friend_request_limits` lacks RLS; assess defense-in-depth RLS in an approved migration without breaking the rate limiter.
- Storage catalog RLS is enabled. Chat, stories, vault and social buckets private; avatars intentionally public. Catalog grants alone do not bypass storage object policies.
- Advisor: 27 RLS-without-policy INFO, 70 authenticated table-exposure WARN, 75 authenticated privileged-function WARN, leaked-password protection WARN. These require interpretation, not an “all clear.”

Vercel metadata: production-scoped sensitive credentials exist; no decrypt requested. No preview database isolation, billing cap, TURN configuration or successful Search Console ownership established. Google verification meta tag retained unchanged.

## Verification and remaining scope

- Full build and automated tests; see `verification/site-quality-20261025.json` for final counts/results.
- Native local public-page browser checks: 44 responsive cases, consent persistence/keyboard, zero page exceptions; external requests blocked.
- Local targets checked, obsolete diagnostics asset references fixed. Platform redirects/external link availability still require deployed acceptance.
- Existing auth/story/settings source preservation test retained; hosting config deliberately moved from byte-freeze to semantic security tests because this request authorizes SEO/header changes.
- Lossless PNG optimization changes compressed bytes, not artwork/pixels; PWA identity and 50-sticker set preserved.
- Earlier native call/recording/timeline tests remain development evidence, not remote RTP/device certification.

Additional large features remain as recorded in `CLIP_TIMELINE_READINESS.md`,
`REEL_CAMERA_READINESS.md`, `IMMERSIVE_CALL_UI_READINESS.md` and
`REELS_V2_READINESS.md`: advanced AR, native background calls, group video,
multi-track editor, shared Photo/Story engine and other capability-gated tools.
They must be completed and tested **or left out of the release scope**.

## Official references reviewed

- Google indexing controls: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Search Console ownership: https://support.google.com/webmasters/answer/9008080
- Core Web Vitals: https://web.dev/articles/vitals
- Vercel TLS: https://vercel.com/docs/cdn-security/encryption
- Supabase password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Database advisors: https://supabase.com/docs/guides/database/database-linter
- Termly EULA questionnaire: https://termly.io/products/eula-generator/
- Copyright Office DMCA agent requirements: https://www.copyright.gov/dmca-directory/

Supabase changelog reviewed: upcoming removal of legacy CBC TLS ciphers from
10 November 2026 at the earliest; include supported-device TLS acceptance.
https://supabase.com/changelog/cbc-tls-ciphers-deprecated

# Luo Chat age-aware content safety design · 26 October 2026

## Product goal

The goal is a welcoming signup process that asks for as little data as possible, avoids fake guardian codes, and applies age-proportionate content and contact safety instead of scattering arbitrary blocks across the UI.

**Non-negotiable constraint:** The Egyptian September 2026 SCMR/NTRA decision prohibits independent social-media accounts for users under 13 and requires automatic, non-disableable Safe Mode for ages 13–14. (Source: https://www.tra.gov.eg/ar/المجلس-الأعلى-لتنظيم-الإعلام-والجهاز/). Rules for other countries, including U.S. COPPA, also matter.

## Current product state

- Age bands are now `under13`, `13-14`, `15-17`, `18+`.
- Under-13 people may access appropriate *public information* without an independent account. No public Chats, private profiles, uploaded content, or social member data should be exposed.
- Ages 13–14: strongest strict feed filtering and contact protections; signed-in account only after effective age assurance and mandatory server-enforced Safe Mode are operational.
- Ages 15–17: moderate feed restrictions, private-by-default discoverability, contact/reporting controls; accounts after age-assurance and teen-safety controls are operational.
- Ages 18+: access to age-appropriate lawful content without youth-only filters. Universal rules on illegal content, exploitation, threats, harassment and abuse remain enforced.
- Do not require a blanket guardian approval code for adults. A nonfunctional code field is hidden from signup; minor account creation remains paused until actual backend checks exist.

## Trusted age authority

1. Local date-of-birth entry may be used for explanation, **never** as a trust signal for granting adult privileges.
2. An authorized age-assurance service must attest `age_tier` and time bounds; the account creation service validates an attestation, rather than merely trusting a client-supplied band or birthday.
3. Store only `age_tier`, `assurance`, `verified_at` and `valid_until` in a private server-only schema. Avoid storing DOB or identity documents on Luo Chat servers when an external assurance service can provide the needed age band.
4. Age tier changes by verified birthdate/time expiry or successful appeal, not by toggling a frontend selector. Unknown or expired age assurance receives `junior` safety treatment until reviewed.
5. Existing accounts should not be reclassified as adults from browser-local settings. Add an appeal/correction mechanism that is confidential and accessible to guardians where necessary.
6. Do not launch independent under-13 accounts under the Egyptian rules even if another country could permit a guardian-directed account.

## Trustworthy media classification

Content labels for posts and clips: `general`, `teen`, `mature`, `unreviewed`. Labels are set through verified moderation, not by a creator declaring their post safe. A user's self-reported content warning may increase restrictions but cannot mark content harmless.

| Viewer | Reviewed general | Reviewed teen | Reviewed mature | Unreviewed |
|---|---|---|---|---|
| 13–14 | Visible | Hidden | Hidden | Hidden |
| 15–17 | Visible | Visible | Hidden | Hidden |
| 18+ | Visible | Visible | Visible if permitted by universal rules | Visible unless prohibited by universal rules |
| Unknown | Visible | Hidden | Hidden | Hidden |

The SQL foundation in `supabase/migrations/20261026185000_age_safety_tiers_foundation.sql` adds a server-only age assurance registry, a moderator-owned content rating table, a self-readable safety tier, and an additional `AND` to the existing `luo_internal.space_visible` RPC checks. It **preserves all existing audience/relationship/block checks**.

**Rollout stays OFF by default.** This is deliberate: until all accounts have an assured tier and all media has reliable labels, switching it on would break normal user feeds or permit content bypasses. Other media paths such as private Stories, shared links, push previews, signed storage URLs, and search recommendations require review before enabling age-based feed enforcement.

## Signup backend defect / release blocker

The currently deployed `luo-auth` Edge Function **does not inspect `age_band`** even though the browser submits it. Therefore browser restrictions alone can be bypassed by an API request. This must be fixed in server-side signup authorization before minor signup is enabled, and the backend must reject any unverifiable adult or minor age tier according to its assurance requirements. Do not claim the new UI makes registration age-safe until this is enforced.

Existing human sign-in must remain intact. A DOB entered locally is not a legally reliable age verification method. Do not send arbitrary identity documents or guardian codes by chat/email. A consent-based and privacy-preserving age-assurance provider is required for supported young users.

## Contact protections, beyond filtering keywords

- Ages 13–14: private accounts, default contacts-only DMs, restricted recommendations, no age-inappropriate video streams, explicit protection against adults discovering minors, location stripping and rate limits.
- Ages 15–17: protected discoverability, block/report tools, limited stranger-contact recommendations and youth-safe defaults.
- Adults: permitted feed content with optional filter/blur preferences and universal moderation standards.
- Keyword scanning alone cannot evaluate visual media, coded language or context. Moderation should combine text/image/video classifiers with review, appeals and corrective actions.
- Safety controls must be enforced on the server for feeds, search, shares and media authorization. CSS blur/hide alone is not enforcement.

## Release plan and gates

1. [x] Implement correct age band classification, explicit readiness states and human-readable signup messages on GitHub feature branch.
2. [x] Remove misleading, nonfunctional guardian code entry from the visible signup UI.
3. [x] Introduce age-aware content rating and server authorization migration **behind disabled flag** on the feature branch.
4. [ ] Harden `luo-auth` Edge Function against untrusted age-band claims, using a secure proof of age assurance (with a staged test environment) before production.
5. [ ] Connect a reliable age-assurance provider and design age correction/appeals.
6. [ ] Complete real moderation for videos/images/text and server-side protection of Stories/search/media links.
7. [ ] Backfill assured categories, audit unknown/expired users, and ensure review labels cover content before enabling the database rollout.
8. [ ] Run accessibility, Arabic RTL, Android/PWA, sign-in, privacy and automated media-exposure tests.
9. [ ] Only then enable the 13–17 registration flow and age-aware feed enforcement. Independent under-13 accounts remain unavailable in Egypt.

This implementation intentionally does **not** secretly turn on underage registration, assume a birthday is verified or weaken current safety checks.

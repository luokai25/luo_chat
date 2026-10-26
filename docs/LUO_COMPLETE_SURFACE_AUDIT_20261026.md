# Luo Chat complete surface audit · 26 October 2026

**Scope:** current repository feature branch, not an invented feature list. This is a screen-and-interaction checklist based on source inspection of `public/index.html`, `src/app.js`, `src/stories.js`, `src/settings.js`, `src/worlds.js`, `src/social-feed.js`, `src/social-spaces.js`, and the mobile presentation layers. User reference targets: WhatsApp Status and Instagram Direct; design principles from Discord channel/community navigation. Exact trademarks and proprietary brand assets are not reproduced.

**Total catalogued interaction surfaces:** **234** across 10 areas. Counts refer to *audited targets*, not finished pages, verified production behavior, or separate URLs.

| Category | Count |
|---|---:|
| IN_SOURCE | 141 |
| SERVICE_GAP | 6 |
| AUDIT_NEXT | 50 |
| V3_LAYER | 37 |

Status definitions:

- **IN_SOURCE:** a connected feature or UI route appears in repository code. It is **not** a guarantee of visual completeness or real-device acceptance.
- **V3_LAYER:** the cross-app visual/loading/presentation layer addresses this area; underlying server functions are still owned by existing modules. Preview and device testing remain necessary.
- **AUDIT_NEXT:** the precise end-to-end state is unverified, visually incomplete, or needs new design/back-end work. It is **not** being claimed as shipped.
- **SERVICE_GAP:** a known dependency, safety approval, or backend requirement prevents complete behavior. Do not present it as available.

## Cross-app experience contract

Every user action must have: a reachable destination; visible enabled/disabled state; a consistent back/close gesture; contextual labels without exposing internal module names; skeletons only while an actual request is pending; meaningful empty/error/retry states; loading controls that prevent double submission; timezone-safe timestamps; accessible titles and focus return; account-generation cancellation; local-only previews that do not expose private signed media; no false notifications or read receipts.

1. User content is not replaced with skeletons. Placeholders disappear after success, failure, cancellation or sign-out and become static when reduced motion is enabled.
2. Screen design can be upgraded without duplicating authorization, story uploads, message sending, or saved preference state. Permission/consent remains in the original services.
3. Navigation stays consistent across Android Chrome, installed PWA, desktop and RTL. Test at 320/360/390/430/768/1024 px plus real phones.
4. Skeletons must not hide failures, impersonate activity, preserve signed URLs, or keep spinners running indefinitely.
5. Private media, messages, channel membership and agent entitlements must be authorized by the server, not by visible buttons.
6. Google Preferred Sources links are invitations to select a source, never rankings, awards, or endorsements. Google eligibility and publisher status are external. A chat app is not automatically a news publication. It is not a Google certification, guarantee of indexing, or approved publisher badge.
7. Payments, minor accounts and bot enrollment must remain gated pending prior production safety approvals. Do not add or imply working accounts for bots.
8. No claim of end-to-end encryption: repository feature ledger explicitly says it is absent.

## Screen and interaction matrix

### 01. Authentication and first run

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| App launch and service-worker readiness | IN_SOURCE | src/app.js; public/luo-session-boot.js |
| Returning-session restore | IN_SOURCE | src/auth-recovery.js |
| Sign in and validation | IN_SOURCE | public/index.html; src/app.js |
| Create human account | IN_SOURCE | public/index.html; src/app.js |
| Age 12–17 guardian consent | SERVICE_GAP | src/age-policy.js; registrations paused until flow is verified |
| Email/password recovery | IN_SOURCE | src/auth-recovery.js |
| Sign-in failure offline | AUDIT_NEXT | verify error action/retry/focus on device |
| Multiple device sessions | AUDIT_NEXT | verify device/session surface and state |
| First use onboarding | AUDIT_NEXT | no confirmed full-screen guided flow |
| Reconnection and network loss | IN_SOURCE | public/connection-checks.js |
| Account switching | AUDIT_NEXT | audit local drafts, stale queries and navigation |
| Permission request rationale | AUDIT_NEXT | show context before camera/mic/photo requests |
| Initial app-lock / unlock | IN_SOURCE | src/privacy-lock.js |
| Sign-out confirmation and cleanup | IN_SOURCE | src/app.js; src/settings.js |

### 02. Chats and inbox

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| Chats tab header | V3_LAYER | public/luo-experience-v2.css; V3 shared secondary UI |
| Conversation list | IN_SOURCE | src/app.js |
| Search conversations | IN_SOURCE | public/index.html |
| Unread filter | IN_SOURCE | public/luo-approved.js |
| Archived filter | IN_SOURCE | public/luo-approved.js |
| Folder management | IN_SOURCE | src/suite.js |
| Start DM by username | IN_SOURCE | src/app.js |
| Empty inbox onboarding | AUDIT_NEXT | human-friendly zero-state / native action |
| New contact picker | IN_SOURCE | src/connections.js |
| Conversation screen header | V3_LAYER | public/luo-experience-v2.css; public/luo-chat-v2.js |
| Person avatar and identity tap | V3_LAYER | public/luo-chat-v2.js |
| Chat text message bubbles | IN_SOURCE | src/app.js |
| Message reply/quote | IN_SOURCE | src/interactions.js |
| Double-tap reaction | IN_SOURCE | public/luo-chat-v2.js |
| Long-press action sheet | IN_SOURCE | src/interactions.js |
| Message edit | IN_SOURCE | src/app.js |
| Recall/delete sent message | IN_SOURCE | src/app.js |
| Message pin and bookmark | IN_SOURCE | src/enhancements.js; src/workspace.js |
| Message history pagination | IN_SOURCE | src/app.js |
| Jump to latest | IN_SOURCE | public/index.html |
| Inline search in history | IN_SOURCE | src/app.js |
| Reply chain/thread expansion | AUDIT_NEXT | featureStatus reports partial threads |
| Inline translation preview | IN_SOURCE | src/translation.js |
| Reel and post rich share | IN_SOURCE | src/reel-message-preview.js |
| New attachment sheet | V3_LAYER | public/luo-chat-v2.js |
| Photo or video attachment | IN_SOURCE | src/app.js |
| Document attachment | IN_SOURCE | src/app.js |
| Native camera capture | AUDIT_NEXT | Android browser/device acceptance |
| Voice recorder (press, lock, cancel) | IN_SOURCE | public/luo-inline-voice.js |
| GIF and sticker drawer | IN_SOURCE | public/klipy-gifs.js; src/sticker-tray.js |
| Poll and quiz composer | V3_LAYER | public/index.html; shared dialog style |
| Schedule message composer | V3_LAYER | public/index.html; shared dialog style |
| Send failed / retry / outbox | IN_SOURCE | src/outbox.js |
| Draft persistence and reset | IN_SOURCE | src/app.js |
| Per-chat notification mute | IN_SOURCE | src/settings.js; src/app.js |
| Chat details and 100 wallpaper picker | V3_LAYER | src/instagram-chat.js |
| Wallpaper device/account isolation | IN_SOURCE | src/instagram-chat.js |
| Chat color / bubble / font settings | V3_LAYER | public/index.html; src/settings.js |
| Conversation export | IN_SOURCE | src/app.js |
| Group admin chat from Worlds | IN_SOURCE | src/worlds.js |
| Forward/share to multiple chats | AUDIT_NEXT | confirm composer UX and permissions |
| Message delivery/read state detail | AUDIT_NEXT | do not imply recipient delivery from server acceptance |

### 03. Media, content and attachments

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| Attachment chooser | V3_LAYER | public/luo-chat-v2.js |
| Photo preview before send | IN_SOURCE | src/image-editor.js |
| Photo crops, markup, sticker creator | IN_SOURCE | src/image-editor.js; src/sticker-tools.js |
| Gallery and album picker | AUDIT_NEXT | confirm albums are keyboard/touch friendly |
| Multi-photo album viewer | IN_SOURCE | src/albums.js |
| Video attachment player | IN_SOURCE | src/media.js |
| Audio playback/speed | IN_SOURCE | src/media.js; src/suite.js |
| Offline transcription panel | AUDIT_NEXT | browser speech pack dependency |
| Media viewer | V3_LAYER | public/index.html #mediaViewer |
| Media zoom / pan / pinch | IN_SOURCE | src/image-gestures.js |
| Shared media search/filter | V3_LAYER | public/index.html #sharedDialog |
| Files and links search | IN_SOURCE | src/search.js |
| Sticker maker drawing and export | IN_SOURCE | src/sticker-tools.js |
| GIF search unavailable state | AUDIT_NEXT | key-free fallback and retry |
| Image upload timeout/retry | AUDIT_NEXT | partial uploads and failed network states |
| Video compression before send | AUDIT_NEXT | device-budget and consent constraints |
| Media privacy / signed URL expiry | IN_SOURCE | src/media.js |
| Download and storage permission | IN_SOURCE | src/device-access.js |
| Storage manager | V3_LAYER | public/index.html #settings-storage |
| Media moderation / reporting | AUDIT_NEXT | check abuse/report entry points per surface |

### 04. Updates / status

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| Updates tab root | V3_LAYER | public/luo-updates-v2.js |
| Story rail and My Status | V3_LAYER | public/luo-updates-v2.js |
| Create status text mode | V3_LAYER | public/luo-deep-pages-v3.js |
| Create status media mode | V3_LAYER | public/luo-deep-pages-v3.js |
| Create audience/circle step | V3_LAYER | public/luo-deep-pages-v3.js |
| Saved circle recipient picker | IN_SOURCE | src/stories.js |
| Contact audience prefill | IN_SOURCE | src/stories.js |
| 24-hour status expiration | IN_SOURCE | src/stories.js |
| Status owner vs recipient controls | IN_SOURCE | src/stories.js |
| Story viewer progress | IN_SOURCE | public/luo-updates-v2.js |
| Advance/tap/swipe status | IN_SOURCE | public/luo-updates-v2.js |
| Media authorization/signed link | IN_SOURCE | src/stories.js |
| Status six supported reactions | IN_SOURCE | src/stories.js |
| Status reply opens private DM | IN_SOURCE | src/app.js; public/luo-updates-v2.js |
| My story reaction list | IN_SOURCE | src/stories.js |
| Delete own story | IN_SOURCE | src/stories.js |
| Real status media thumbnails | AUDIT_NEXT | currently styled covers, no private thumbnails |
| Pause and resume progress | AUDIT_NEXT | verify with touch, videos, document.hidden |
| Status viewed receipts and viewers | AUDIT_NEXT | requires audited server authorization/consent |
| Status mute, close friends and hide-from | AUDIT_NEXT | requires explicit audience model |
| Search and no-status state | V3_LAYER | public/luo-updates-v2.js |
| Status upload error/retry | AUDIT_NEXT | native error text exists; design retry states |
| Story accessibility / alt text | AUDIT_NEXT | caption and voice reader audit |
| Status music integration | AUDIT_NEXT | currently music link rather than hosted play |

### 05. Luonix and social surfaces

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| Luonix reels feed | IN_SOURCE | src/social-feed.js |
| Friends feed | IN_SOURCE | src/social-spaces.js |
| Public posts feed | IN_SOURCE | src/social-spaces.js |
| Written post creation | IN_SOURCE | src/social-spaces.js |
| Photo post composer | IN_SOURCE | src/social-spaces.js |
| Video reel publisher | IN_SOURCE | src/clip-composer.js |
| Camera video recording | IN_SOURCE | src/clip-camera.js |
| Clip drafts and recovery | IN_SOURCE | src/clip-drafts.js |
| Timeline editing | IN_SOURCE | src/clip-timeline.js |
| Video filters and captions | AUDIT_NEXT | test creator on low-powered Android |
| Reels full-bleed viewer | IN_SOURCE | src/social-feed.js |
| Clip pause/resume | IN_SOURCE | src/reel-features.js |
| Double-tap like | IN_SOURCE | src/social-feed.js |
| Story/feed context share | IN_SOURCE | src/reel-message-preview.js |
| Post viewer photo carousel | IN_SOURCE | src/social-feed.js |
| Post reactions | IN_SOURCE | src/social-feed.js |
| Comments full-screen/bottom sheet | V3_LAYER | public/luo-deep-pages-v3.css |
| Add/edit/delete own comment | AUDIT_NEXT | validate API and affordances |
| Clip publish progress and retry | AUDIT_NEXT | confirm optimistic/error states |
| Clip share sheet | V3_LAYER | shared dynamic dialog styling |
| Report and not interested | IN_SOURCE | src/social-feed.js |
| Follow status and requests | IN_SOURCE | src/social-spaces.js |
| Social search | IN_SOURCE | src/social-spaces.js |
| Hashtag and topic feeds | AUDIT_NEXT | query route and ranking unverified |
| Notifications/activity center | IN_SOURCE | src/social-spaces.js |
| Draft autosave and restore | IN_SOURCE | src/clip-drafts.js |
| Watch Together session | IN_SOURCE | src/social-sessions.js |
| Listen Together session | IN_SOURCE | src/social-sessions.js |
| Time capsule creator | IN_SOURCE | src/social-spaces.js |
| Time capsule reveal animation | AUDIT_NEXT | device/reduced-motion acceptance |
| Profile music external link | IN_SOURCE | src/social-spaces.js |
| Creator reporting and upload analytics | AUDIT_NEXT | validate available owner-only telemetry |
| Feed preference controls | IN_SOURCE | src/reel-features.js |
| Skeleton pending fetch | V3_LAYER | public/luo-deep-pages-v3.js |

### 06. Worlds / communities

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| Worlds tab | IN_SOURCE | src/worlds.js |
| Discover worlds and search | IN_SOURCE | src/worlds.js |
| World overview and banner | IN_SOURCE | src/worlds.js |
| Create world dialog | V3_LAYER | public/luo-deep-pages-v3.css |
| World privacy/access control | IN_SOURCE | src/worlds.js |
| Explore channels list | IN_SOURCE | src/worlds.js |
| Create text channel | IN_SOURCE | src/worlds.js |
| Channel feed and history | IN_SOURCE | src/worlds.js |
| Post in channel | IN_SOURCE | src/worlds.js |
| Channel permission state | IN_SOURCE | src/worlds.js |
| World membership application | IN_SOURCE | src/worlds.js |
| World application approval/rejection | AUDIT_NEXT | verify moderation flows |
| World owner moderation | IN_SOURCE | src/community-moderation.js |
| Group chats dedicated to Worlds | IN_SOURCE | src/worlds.js |
| New group and membership | IN_SOURCE | src/app.js; src/worlds.js |
| World roles and permissions matrix | AUDIT_NEXT | no invented Discord roles |
| World member roster and presence | SERVICE_GAP | no verified real-time member directory/count |
| World onboarding questions | AUDIT_NEXT | requires persisted member preferences |
| Forum threads and categories | AUDIT_NEXT | server model may not support threads |
| Channel announcements/pins | AUDIT_NEXT | check server action availability |
| Voice/stage channel | SERVICE_GAP | src/worlds.js states permissioned voice transport not built |
| Worlds agent enrollment | SERVICE_GAP | agent membership remains gated |
| Worlds skeleton state | V3_LAYER | public/luo-deep-pages-v3.js |

### 07. Calls and live experience

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| Calls landing | IN_SOURCE | public/luo-approved.js |
| Recent call history | IN_SOURCE | src/calls.js |
| Outgoing voice call | IN_SOURCE | src/calls.js |
| Incoming call consent/ring | IN_SOURCE | src/calls.js |
| In-call buttons / mute | IN_SOURCE | src/call-shell.js |
| Audio output selection | AUDIT_NEXT | browser feature support |
| Camera toggle and switch | IN_SOURCE | src/call-media-state.js |
| Full-screen video layout | IN_SOURCE | src/call-shell.js |
| Connection quality and fallback | IN_SOURCE | src/call-quality.js |
| Group calls | AUDIT_NEXT | validate server support before claiming |
| Screen share permission | IN_SOURCE | src/call-screen-share.js |
| AR effects picker | IN_SOURCE | src/call-ar-effects.js |
| Call error / reconnect | IN_SOURCE | src/call-recovery.js |
| Call recording with consent | AUDIT_NEXT | legal & technical review needed |
| Call background/foreground recovery | AUDIT_NEXT | physical Android acceptance |
| TURN relay fallback | SERVICE_GAP | deployment config may lack TURN service |
| Call notification outside app | AUDIT_NEXT | push depends on browser/OS |

### 08. Profiles and relationships

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| Own profile settings | V3_LAYER | public/luo-deep-pages-v3.js |
| Profile avatar crop/upload | IN_SOURCE | src/settings.js |
| View enlarged profile picture | V3_LAYER | public/luo-deep-pages-v3.css |
| Another user's profile | V3_LAYER | src/connections.js; shared modal style |
| Profile privacy and bio | IN_SOURCE | src/connections.js |
| Connection requests | IN_SOURCE | src/connections.js |
| Contact search / lookup | IN_SOURCE | src/connections.js |
| Saved contacts list | IN_SOURCE | src/connections.js |
| Blocked contacts | IN_SOURCE | src/settings.js |
| Connection QR code | IN_SOURCE | public/index.html |
| Copy profile link | IN_SOURCE | public/index.html |
| Shared themes with friend | AUDIT_NEXT | consent and persistence to verify |
| User report / abuse handling | AUDIT_NEXT | review report flow |
| User profile music | IN_SOURCE | src/social-spaces.js |
| Profile online/typing audience | IN_SOURCE | src/settings.js |

### 09. Account, privacy and settings

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| Settings landing and category tiles | V3_LAYER | public/luo-deep-pages-v3.js |
| Mobile nested settings back navigation | V3_LAYER | public/luo-deep-pages-v3.js |
| Settings category search | IN_SOURCE | src/settings.js |
| Edit profile section | IN_SOURCE | src/settings.js |
| Privacy/read receipts | IN_SOURCE | src/settings.js |
| Typing indicators opt out | IN_SOURCE | src/settings.js |
| Presence audience control | IN_SOURCE | src/settings.js |
| Blocked people list | IN_SOURCE | src/settings.js |
| Chat wallpapers and font | IN_SOURCE | src/settings.js; src/instagram-chat.js |
| Reduced motion | IN_SOURCE | src/settings.js |
| Touch controls & haptics | IN_SOURCE | src/interactions.js |
| Device camera/mic permissions | IN_SOURCE | src/device-access.js |
| Notification categories | IN_SOURCE | src/settings.js |
| Quiet hours and timezone | IN_SOURCE | src/settings.js |
| In-app sound settings | IN_SOURCE | src/settings.js |
| Storage and downloads | IN_SOURCE | src/settings.js |
| Automatic media previews | IN_SOURCE | src/settings.js |
| Edit password/email | IN_SOURCE | src/settings.js |
| Sign out other devices | IN_SOURCE | src/settings.js |
| Delete own account | V3_LAYER | public/index.html #deleteDialog |
| Support / app version | IN_SOURCE | public/index.html #settings-help |
| Shortcut references | V3_LAYER | public/index.html #shortcutDialog |
| Install and update PWA | IN_SOURCE | public/index.html |
| Account export and deletion lifecycle | AUDIT_NEXT | validate complete server cleanup audit |
| Help & report issue | AUDIT_NEXT | support integration and ticket state |

### 10. Loading, safety, responsive and growth

| Destination / state | Status | Repo evidence or next action |
|---|---|---|
| Inbox skeletons during loading | V3_LAYER | public/luo-deep-pages-v3.js |
| Profile skeletons during authorized read | V3_LAYER | public/luo-deep-pages-v3.js |
| World and channel skeletons | V3_LAYER | public/luo-deep-pages-v3.js |
| Luonix and post skeletons | V3_LAYER | public/luo-deep-pages-v3.js |
| Status skeletons | V3_LAYER | public/luo-deep-pages-v3.js |
| Error-and-retry state contract | AUDIT_NEXT | each network mutation requires verified retry path |
| Offline read-only state | IN_SOURCE | src/device-cache.js |
| Keyboard and focus management | AUDIT_NEXT | physical keyboard/screen-reader regression |
| RTL mixed-language composition | AUDIT_NEXT | Arabic + English bidi and layout audit |
| Slow Android / battery mode | AUDIT_NEXT | real-device performance and dropped frames |
| Safe area and soft keyboard | AUDIT_NEXT | Android chrome / PWA acceptance |
| Reduced motion and skeleton static mode | V3_LAYER | public/luo-deep-pages-v3.css |
| Public five-language landing pages | IN_SOURCE | scripts/generate-localized-marketing.mjs |
| Public Chats/Luonix/Worlds guides | IN_SOURCE | scripts/generate-product-pages.mjs |
| Preferred Sources Google selection link | V3_LAYER | official user choice, eligibility determined by Google |
| Indexable sitemap and robots | IN_SOURCE | public/sitemap.xml; public/robots.txt |
| SEO/AI-agent documentation | IN_SOURCE | public/agents.html; public/openapi.json |
| Agent payments and membership | SERVICE_GAP | not authorized for public launch |
| Analytics by channel and conversion | AUDIT_NEXT | Windsor.ai / owner-only workspace validation |
| Physical device acceptance | AUDIT_NEXT | screenshots, a11y, camera/mic, long stories, uploads, calls |

## Prioritized next implementation waves

### P0 · Proven inconsistencies and lifecycle
Resolve duplicated Updates launch paths in older layers; harden story author/reply/loading; consolidate DM header interactions; standardize modal keyboard/focus/close and mobile safe areas; ensure offline, error, and sign-out clear skeletons. Keep public site safe and production payment flags unchanged.

### P1 · Creators and community depth
Native-feeling status media thumbnails with permissioned signed preview and accessible fallbacks; video publisher draft/retry/progress; comments/likes/share sheets; profile edit surface; channel member lists and mod screens based on server-backed data.

### P2 · End-to-end identity and experience
Device-verified voice/video, notification permission flows, imported history, group admin, camera/file permissions, real search results, RTL and localization, verified account clean-up.

### P3 · Deferred service requirements
Worlds voice transport, agent enrollment and billing, underage account approval, verified engagement counts and reports, unsupported platform account features. These require explicit backend/security readiness and must not be simulated in the UI.

## Required release validation

- Node unit tests: modal structure and native handlers, RTL and keyboard navigation, state-preserving settings layout, skeleton appearance/removal, status audience defaults, permission boundaries, local draft preservation, SEO link/canonical.
- Browser smoke test: Android Chrome and installed PWA, 320–430 px, five-tab navigation, nested settings back, request failure and retry, story media / status reply, direct messages and attachments, Worlds, Luonix, real profile dialogs.
- Runtime guard: Vercel READY on exact commit, all tests passing, and verified domain points to that commit. Preserve production payment gates and Search Console verification.
- Postrelease: inspect client logs, real device screenshots and session restoration. Automated build tests cannot establish pixel-perfect parity.

## Research notes

- WhatsApp/Instagram *patterns*, not duplicated artwork: status cards -> full screen media viewer -> simple reply/reaction; direct chat -> tap avatar for details -> attachment actions contextual in compose; options in secondary sheets, not stacked diagnostic screens.
- Discord-style Worlds: discover -> choose world -> text channels -> membership/roles/admin; onboarding and voice are backlog unless server enforcement exists.
- Google Search Central Preferred Sources (https://developers.google.com/search/docs/appearance/preferred-sources): explicit selection link or supported widget, not a Google-approved badge. Site may not qualify for publishers' Top Stories surfaces.

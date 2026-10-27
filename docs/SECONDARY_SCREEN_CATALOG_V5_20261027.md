# Secondary-screen replacement catalog, Luo Chat V5, 27 October 2026

The previous estimate of 234 includes dialogs, interaction states, overlays
and settings flows, **not 234 independent pages already implemented**.
Do not count navigation labels as completed screens.

## First six full working secondary surfaces

1. **Shared media:** live accessible filter tabs (V4), real media cards,
   loading state from actual authorized fetch, screen-appropriate result counts,
   phone responsive grid and load-more function preserved.
2. **Poll / quiz composer:** actual question, choices, correct-answer selection,
   fully designed live preview and existing server-side submit validation.
3. **Scheduled message:** actual message preview, local delivery receipt,
   invalid-past-date warning and original durable scheduling submit path.
4. **Media viewer:** on-demand photo zoom with real image transforms, zoom
   reset on close, video/audio untouched, existing media commands preserved.
5. **Chat appearance settings:** real local preview for nickname, emoji, color,
   background theme, bubble shape and font, with original Save action.
6. **Account deletion:** explicit, accessible readiness checklist for own
   password and exact deletion phrase, no storage or logging of entered secrets,
   existing server-side account-deletion guard left intact.

Each has actual fields and controls, responsive dark/gold styling, focus rings,
contrast and reduced-motion checks. No fake data, artificial votes or new
payment behavior.

## Planned continuation for the remaining interaction surfaces

Inventory actual selectors and secondary actions first, grouping by flow:
chats/replies; people and privacy; Luonix comments and publishing; stories;
Worlds and roles; Calls; library/search; account/security; agent billing.
For each surface require: real data and handlers, loading/empty/error states,
safe keyboard/motion controls, and automated responsive acceptance.
No claim of completed 234 surfaces is made by this six-screen release.

## Ship discipline

V5 is only on GitHub feature development. Review accessibility and active-user
workflow tests before making a separate release from the currently live build.
Do not merge unrelated paid-agent or unsafe age-policy flags into this release.

## Wave two: four more functional secondary screens (GitHub V6 only)

7. **24-hour private story composer:** actual text and optional selected-file
   preview, accurate distinct audience count, privacy warning when nobody is
   listed, expiry details. Original authenticated publish remains unchanged.
8. **Message action editor:** previews the real editable message field,
   character length and current action, without submitting anything.
9. **Conversation tools:** working local search indexes existing current
   action buttons and directly calls their original click handlers; it never
   creates fictional modules or grants additional permissions.
10. **Avatar photo viewer:** actual on-device zoom and reset on close.

Wave two is not a claim of 234 finished screens or full social-network parity.
It is tested separately, and production promotion requires successful release
regression and a remaining Vercel free-tier deployment allowance.

## Wave three: four more functional surfaces (V7, GitHub staging only)

11. **Keyboard shortcuts:** working filter over the real keyboard commands,
    accessible result counts and strong mobile typography; no invented shortcuts.
12. **Direct-chat attachment picker:** large labeled action targets that invoke
    the current photo/video, camera, document, poll and schedule handlers;
    selected-file details and Escape handling, with the original upload
    authorization untouched.
13. **Worlds and group creation:** preview from the *actual* form fields,
    public/private audience explanation, distinct invitee counts, and username
    formatting errors; real server-side membership checks stay authoritative.
14. **Updates status viewer:** author reply composer counts characters,
    explicitly labeled previous/next actions, and close cleanup without
    interfering with the existing story timer, signed-media or reactions logic.

These four screens are UI enhancements to already-functional native flows.
They do not create new backends, publish content, change age policy or count
as a recreation of all remaining ~220 interface states. Preview/release builds
must pass the existing browser and mobile workflows before production.


## Wave four: four native secondary-list interactions (V8, GitHub feature branch only)

15. **Memory Vault filters:** live result count of authorized, currently rendered vault items, a clear-filters action that forwards the original query and collection change events, and no second database client or duplicate private record fetch.
16. **Scheduled message history:** local status/text filters over the **100 most recently loaded server-authorized schedules**, counts, clear action and a no-match state; existing send/cancel/open-chat handlers remain the sole source of truth. The account-bound asynchronous history loader now discards stale replies and stale errors after rapid refreshes or sign-out.
17. **People contact list:** native contact-search clearing and loaded-list feedback, without modifying or guessing server-side contact authorization.
18. **Shared media filters:** a one-tap reset for filename/type filters that invokes the original handlers and retains authorization and pagination.

All four surfaces are enhancements to the existing app shell, not standalone URLs or a claim of completing the originally proposed ~234 dialogs/states. CSS and JS are included in the current app's index; no production merge or deploy has been performed. V8 regression fixtures and scheduled-history request-order tests were committed but need execution in a build-capable environment before release.

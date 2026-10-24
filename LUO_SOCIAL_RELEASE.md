# Luo Social (October 23, 2026)

## Implemented in this release
The Social tab connects to the existing `public.luo_space` authenticated Supabase RPC. It is available in the approved five-item black-and-gold mobile navigation and the desktop navigation.

- Friends' posts and comments, six expressive reactions, friend-approved collaborative posts and post visibility
- Short-video Clips with uploaded videos, preview playback, comments and saves. Browser metadata validation checks the 90-second limit; no transcoding service is installed
- Shared interest tags and opt-in friend recommendations (the current Notes UI has been removed)
- Time Capsules addressed to approved friends with server-enforced future unlock, animated 3D-like envelope, progressively revealed letter, and up to six private photos or audio recordings
- Shared themes with recipient approval; shared cat/fox/dragon companions with interactive offline 3D mesh renderer, decoration and ownership approvals
- Memory Constellations with consent-protected conversation-history visualization and mutual star marking (recent history window)
- Profile music **Spotify track links** and visibility controls (not in-app Spotify audio playback)
- Presence states and privacy-aware interest preferences
- Luo Events with RSVP and event-chat creation
- Luo Communities with membership requests, owner approval, rooms and permission-gated room joining
- Interactive questions in conversations with server-returned follow-up messages
- Watch Together and Listen Together sessions for media **already uploaded and authorized** in Luo Chat, with host-controlled playback and participant position synchronization
- Activity Center and category notification preferences
- Social search across visible posts, Clips, communities, events and usernames, with existing profile dialog and message-search navigation

## Security boundaries
The existing `luo_internal` schema and `luo_space` RPC perform per-action identity, friendship, group membership and visibility checks. Sealed Time Capsule text and media are omitted from recipient responses until `unlock_at`. Storage reads use authorized signed URLs; the client never embeds service-role credentials. Media is not end-to-end encrypted by this implementation.

No new production database migration is applied by this pull request. The existing deployed social-space migration history must be reconciled with repository migrations before preparing fresh deployments.

## Behavior and accessibility
Text from users is inserted through DOM textContent, not arbitrary HTML. New social panels scroll on phones, movement respects reduced-motion, and the companion renderer pauses when outside the viewport. Video clips do not automatically play. Shared playback may require a user gesture due to browser media policies and polls for updates rather than making unsupported real-time guarantees.

## Verification limits and follow-up work
Vercel runs the `release:check` build and automated tests. Browser fixtures and hosted SQL checks do **not** replace testing with two real accounts on Android, iOS and desktop.

Features not yet fully delivered include service-licensed Spotify/YouTube shared playback, Snapchat-like AR camera effects, advanced Story stickers and layouts, historical constellation pagination beyond the current window, duet/remix editing, richer animated text-message effects and end-to-end media encryption. Push notifications depend on permission, a valid service worker and device/browser support. Notification category settings alone cannot guarantee delivery outside the app.

## October 23 follow-up: chat atmosphere and social polish
- New text messages containing star, heart or celebration emojis trigger short gold-toned particle effects only in the active conversation. Old history never replays effects.
- Interactive per-chat reactive gold wallpaper has Off, Subtle and Full modes, with automatic reduced-motion and data-saving suppression. Only a local setting is stored; message bodies are not copied into browser storage for effects.
- Unlocked Time Capsules animate their wax seal and envelope flap before the letter rises. Closing or signing out during the animation prevents its stale reveal.
- Capsule media is fully validated before opening a new draft to reduce orphaned drafts from invalid uploads.
- Interactive questions show a safe, animated golden answer card after a confirmed server response, rather than only a transient toast.

These refinements use existing database permissions and do not claim third-party licensed streaming, end-to-end encryption or physical-device notification delivery.

## Follow-up: Story Studio, Chats Notes, and voice replies
- **Story Studio:** private mobile-first 9:16 designer for JPG, PNG and WebP photos with up to four-photo layouts, background themes, photo filters, captions, stickers, drawing, undo and local PNG export. It integrates into the existing 24-hour Story composer, which still controls the explicit audience and publish action. The design is not uploaded when merely editing.
- **Chats Notes ribbon:** the authenticated `luo_space` Notes feed appears above conversations, filters expired Notes, deduplicates users and opens Social Notes. Only server-authorized feed results appear, and asynchronous requests cannot repopulate content after sign-out.
- **Two-second voice reactions:** tap Voice 2s on a text or media message, explicitly grant microphone permission, record a short clip, preview, and send. This uses the *existing secure audio-attachment reply RPC* and links the result to the original message. It is an audio reply rather than a new `space_voice_reactions` record. No new database migration is required.
- Audio and image capture are local until the user explicitly sends; canceled or sign-out interrupted recordings release microphone tracks. Real Android/iOS permission and media compatibility still need acceptance testing.
- The existing limits remain: social media is **not end-to-end encrypted**; interactive Story polls/quizzes and Snapchat-grade AR are not yet delivered; Spotify URLs do not permit in-app licensed music playback.

### Memory Constellations request isolation

Changing conversations now immediately clears the previous timeline and restores the Explore button even while its request is pending. Refreshing removes the old stars and letter detail before checking access again. Responses, detached star buttons, and special-mark completions are scoped to the original account, conversation, and mounted view. Repeated special-mark clicks submit only once while the request is pending. The selector has an accessible label and loading feedback is announced as status.

The Android APK and emulator workflows now watch all source modules, public assets, build scripts, and regression tests so changes to social features cannot silently miss the next GitHub-only build. This change does not deploy the website or apply database migrations.

### Social feed redesign and retired Luo Core removal

The Social landing screen now opens a black-and-gold Friends feed, a separately filtered Public feed, and a vertical, snap-scrolling Clips view. Creation forms live behind the + button and Explore more keeps the other social tools reachable. Author avatars and names open profiles. Reactions and saves update in place; comments use a bottom sheet and preserve the same operation ID on retry. Posts support six validated photos with an album viewer. Separate post/clip cursors load additional pages without duplicate cards.

Feeds use the existing `luo_space` modes and visibility checks. Public presentation additionally excludes anything whose audience is not public. Videos request authorized signed URLs only when needed, start muted after a user gesture, pause offscreen and on backgrounding, and release their sources on navigation/signout. Reduced motion and Save-Data suppress automatic next-clip playback. Browser checks cover 320, 390, 768 and 1440 px widths with synthetic backend responses and a locally generated test video; they do not prove live two-account media access.

The retired Luo Core chat-overlay code, model generator, optional GLB, and viewer are removed from this branch's build. The service worker deletes prior `luo-core-master-*` caches without deleting unrelated caches. The PWA manifest and the separate mutually approved shared companions feature remain. No production website deployment or database change is part of this release.

### Current APK: Notes removal and media creation polish

The Notes ribbon and Social Notes screen are removed; existing Notes backend records retain their normal expiry. Social is fifth in the mobile navigation. Photo/video creation now shows local previews, validates media, supports removing selected photos, and releases preview URLs on exit. Removing a photo also synchronizes the browser file selection where supported. Media comes first, with optional title/collaboration controls collapsed. Albums accept horizontal swipes without intercepting vertical scrolling. Visible photos load lazily and clips begin muted unless reduced motion or Save-Data calls for manual playback. No extra third-party services or database migration is required.

The browser suite now exercises both photo and recorded WebM publication using a synthetic storage/RPC fixture, in addition to four-width layout checks, real video decoding, inline reactions, comments, navigation cleanup and absence of Notes. This does not claim live two-account storage testing or physical-device network acceptance.

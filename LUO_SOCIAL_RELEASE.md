# Luo Social (October 23, 2026)

## Implemented in this release
The Social tab connects to the existing `public.luo_space` authenticated Supabase RPC. It is available in the approved five-item black-and-gold mobile navigation and the desktop navigation.

- Friends' posts and comments, reactions and post visibility
- Short-video Clips with uploaded videos, preview playback, comments and saves. Browser metadata validation checks the 90-second limit; no transcoding service is installed
- 24-hour Notes, shared interest tags and opt-in friend recommendations
- Time Capsules addressed to approved friends with server-enforced future unlock, animated 3D-like envelope, a revealed letter and up to six private photos or audio recordings
- Shared themes with recipient approval; shared cat/fox/dragon companions with interactive offline 3D mesh renderer, decoration and ownership approvals
- Profile music **Spotify track links** and visibility controls (not in-app Spotify audio playback)
- Presence states and privacy-aware interest preferences
- Luo Events with RSVP and event-chat creation
- Luo Communities with membership requests, owner approval, rooms and permission-gated room joining
- Interactive questions in conversations with server-returned follow-up messages
- Watch Together and Listen Together sessions for media **already uploaded and authorized** in Luo Chat, with host-controlled playback and participant position synchronization
- Activity Center and category notification preferences

## Security boundaries
The existing `luo_internal` schema and `luo_space` RPC perform per-action identity, friendship, group membership and visibility checks. Sealed Time Capsule text and media are omitted from recipient responses until `unlock_at`. Storage reads use authorized signed URLs; the client never embeds service-role credentials. Media is not end-to-end encrypted by this implementation.

No new production database migration is applied by this pull request. The existing deployed social-space migration history must be reconciled with repository migrations before preparing fresh deployments.

## Behavior and accessibility
Text from users is inserted through DOM textContent, not arbitrary HTML. New social panels scroll on phones, movement respects reduced-motion, and the companion renderer pauses when outside the viewport. Video clips do not automatically play. Shared playback may require a user gesture due to browser media policies and polls for updates rather than making unsupported real-time guarantees.

## Verification limits and follow-up work
Vercel runs the `release:check` build and automated tests. Browser fixtures and hosted SQL checks do **not** replace testing with two real accounts on Android, iOS and desktop.

Features not yet fully delivered include service-licensed Spotify/YouTube shared playback, Snapchat-like AR camera effects, advanced Story stickers and layouts, full Memory Constellations, duet/remix editing, richer animated text-message effects and end-to-end media encryption. Push notifications depend on permission, a valid service worker and device/browser support. Notification category settings alone cannot guarantee delivery outside the app.

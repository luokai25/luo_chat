# Luo Chat 15.1.0 — feature checklist

This is an implementation status ledger; it is not a claim of complete device validation or that every requested capability is finished.

| Capability | Status | Exact scope |
|---|---|---|
| Touch interactions | Implemented | Sideways swipe to select reply; hold or tap More for a large action sheet; drag its handle down to dismiss. Settings control gestures and optional haptics. |
| Interactive image viewing | Implemented | Pinch zoom, drag to pan, double-click zoom and accessible zoom/fit buttons; keyboard controls remain available. |
| Sentence replies | Implemented | Quote an exact excerpt from an accessible message; server validates the source. |
| Edit, recall, pin, quote, bookmark | Implemented | Available from message actions; vault copies are private retained snapshots. |
| Collapsible threads | Partial | Threads organize replies in loaded history; no separate channel history. |
| Scheduled sending | Implemented | Server scheduler; signed-in clients can manage scheduled messages. |
| Self-destructing messages | Implemented | Server access expires at the deadline; physical object cleanup is separate. Copies, screenshots and exports cannot be recalled. |
| Polls, quizzes, questions | Implemented | Shared voting and answer feedback; quiz answers hidden until voting. |
| Offline voice transcription | Browser dependent | Requires an installed local SpeechRecognition language pack and supported audio-track recognition; manual transcription fallback. |
| Voice speed 0.5×–3× | Implemented | Audio viewer playback controls. |
| Skip silence | Implemented | Local analysis for audio up to 20 MB / 10 minutes; device decoding support required. |
| Search voice transcripts | Implemented | Searches your private saved transcripts. |
| Text to spoken messages | Partial | Local-voice read aloud; sending synthesized audio is not built. |
| Favorite audio clips | Implemented | Trim/download WAV clips and copy supported audio to the private vault. |
| Per-conversation themes | Implemented | Luo gold, midnight and aurora themes, font, accent and bubble preferences. |
| Animated backgrounds | Implemented | Optional motion with reduced-motion support. |
| Per-contact sounds | Partial | Three built-in tones or off; uploaded sounds are not built. Browser alerts need permission. |
| Fonts, bubbles, colors | Implemented | Per-chat controls and app appearance settings. |
| Chat icons and profile frames | Implemented | Private emoji chat icons and gold, halo or double profile frames. |
| Unified filtered search | Partial | Message text, filenames, media types, links and own voice transcripts with from:, before:, after:, type:. No document-body indexing or image OCR. |
| Private memory vault | Implemented | Retained text snapshots, collections, private notes and independent file copies. |
| Vault reminders | Implemented | Private linked reminders with explicit date/time; the app must be opened to view them. |
| Live translation | Browser dependent | Explicitly prepared on-device language pairs; unsupported browsers and Egyptian Arabic dialect pairs may be unavailable. Original-text display supported. |
| App lock | Partial | Password screen lock and optional lock on background; online reauthentication. This does not encrypt local storage. |
| Biometric protection | Not built | Requires a separately designed passkey/device credential flow. |
| Hidden chats | Partial | Private inbox organization and suppressed notifications; not a cryptographic hidden vault. |
| Linked-device management | Partial | Multi-device accounts and sign out other sessions; individual device inventory/revocation not built. |
| Screenshot alerts | Unsupported on web | A PWA cannot reliably detect operating-system screenshots. |
| End-to-end encryption | Not built | Transport encryption and server access controls exist; the server can read messages. |
| Stories | Implemented | 24-hour text, photo, video, audio and supported music links for explicitly chosen recipients. |
| Private story circles | Implemented | Owner-only saved recipient lists. |
| Private status reactions | Implemented | Reactions visible to the author and their sender. |
| Shared memories and friendship timeline | Partial | Mutual consent, milestones and the earliest 100 accessible messages; no unlimited full-history timeline. |
| Presence controls | Implemented | Everyone, contacts, selected people or nobody; online, last active and typing visibility respect server audience rules. |
| Shared playlists | Not built | Music links can be shared; synchronized listening/provider integration is not built. |
| Mini-games | Implemented | Two-player in-chat tic-tac-toe with server-validated turns. |
| Custom stickers | Implemented | Local photo editing and device-local sticker packs; explicit send attaches an image. |
| Private contact nicknames | Implemented | Owner-only names in the inbox and conversation. |
| Advanced group permissions | Implemented | Text, file, reply, invite and detail-change controls; owner/admin enforcement. |
| Announcements with replies | Implemented | Admin-only root posts with optional member replies. |
| Topic channels | Not built | Reply threads exist; separate channel membership and history do not. |
| Group tasks | Implemented | Assignees, deadlines and completion permissions. |
| Event planning | Implemented | Date polls, event time/location and RSVP. |
| Group file library | Implemented | Admins retain file references beyond source-message expiry; uploader account deletion removes their files. |
| Automatic summaries | Partial | Daily/weekly counts and recent excerpts; not semantic AI summaries. |
| Temporary groups | Implemented | Server archives after the configured time and blocks further posting. |
| Community bots | Partial | Configured keyword moderation and rate-limited auto-replies, plus recap scheduling; no arbitrary bot runtime. |
| Promises to reminders | Partial | Suggest local dates from English relative times, weekdays and ISO dates, then review and save. Other languages and arbitrary date phrases use the calendar. |
| Offline message queue | Implemented | Account-scoped text queue, retries with stable server IDs while the app is open and online. No offline attachment sending. |
| One-scan connection | Partial | Profile QR opens username lookup; use the phone camera or external QR scanner. |
| Multi-device sync | Implemented | Server-backed history and reconciliation on reconnect; no end-to-end encrypted device-key sync. |
| Conversation map | Partial | Heuristic topic/question/decision/file grouping over loaded history with jump links. |
| Living messages | Implemented | Interactive checklists, countdowns, shared notes and polls; booking details can be shared as text, no booking-provider integration. |
| Conversation checkpoints | Implemented | Private saved points linking to the source while available. |
| Private annotations | Implemented | Owner-only notes linked to messages. |
| In-chat image editor | Implemented | Crop, rotate, draw, blur, solid redaction and text locally before sending. |
| Video trimming | Browser dependent | Local WebM capture/recording up to 60 seconds; native codec/capture support required. |
| Animated sticker studio | Browser dependent | Local GIF generation from supported video, up to 6 seconds; device-local packs. |
| Universal media viewer | Partial | Images, audio, video, text and PDFs where supported; other documents download. No Office-document rendering. |
| Profiles and settings | Implemented | Avatar, name, bio, frames, privacy audiences, chat appearance, alerts, storage, account controls and help. |
| Google sign-in | Integration built; activation pending | Button, provider availability checks, identity-only OAuth redirect, cancellation and stale-response handling. Google Cloud/Supabase provider setup and real sign-in remain unverified. |
| Account recovery | Unverified configuration | Recovery UI is present; hosted email delivery and redirect settings still need an end-to-end check. |


## 15.0.0 release additions

The release guide [RELEASE_15.md](RELEASE_15.md) describes the 15 newly added feature areas, their concrete behavior, and limits. This older capability ledger continues to describe the rest of the application and its previous features.


Version 15.0.1 fixes reliability defects in drawing-board switching, import preview validity, dashboard filtering and device notification transitions. See `RELEASE_15_0_1.md`.

Version 15.0.2 hardens call lifecycle handling and identifies the known conversation in call dialogs; external TURN and real-device acceptance gates remain.

Version 15.1.0 fixes mobile settings/menu containment, modal feedback and accessible names, settings/lookup session races, and stale connection indicators. See `AUDIT_15_1.md` for verification scope and open gates.

## Device storage — 15.2.0

Implemented: recent text caching (1/7/30 days), explicit temporary/kept files, 25–250 MB budget, per-file removal, temporary/all cleanup and default signout removal. Separate phone Downloads remain outside app control; no encrypted local-cache or instant offline recall guarantee. See `STORAGE_DATA.md`.

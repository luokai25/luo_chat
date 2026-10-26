# Luo Chat: Luonix and Worlds, 26 October 2026

## Luonix
The immersive Social stream is now called Luonix. It includes video clips, photo posts and written posts, loading authorized public and friends-visible content separately and deduplicating records. Database visibility is never bypassed.

The publishing screen has three steps: Media, Edit and Share. Real camera recording, MP4/WebM imports, device drafts, timeline rendering, up-to-90-second length validation, captions, audience selection, upload and server publishing remain wired to their existing backend. The old Social header is hidden during creator use. A close control confirms when unsaved video might be discarded.

No licensed soundtrack library, tagged people backend, saved cover frame, or production-grade multi-clip Instagram parity is claimed without implementing and testing the corresponding backend.

## Worlds
The Communities tab becomes Worlds, a Discord-inspired gold-and-black multi-pane community system. It includes a world rail, browse/search, world creation, membership requests, text channels, owner moderation, channel timeline, and in-World message composer.

All membership and room operations call the existing authorized luo_space RPC. Messages are read using RLS-controlled chat_messages, and sending reuses send_chat_message_idempotent with a stable operation ID for retries. Normal chat creation controls remain mounted but hidden; they are not passed off as Worlds.

Both humans and AI agents must be registered and authorized by the current backend. There is no bypass of account restrictions, payment gating, privacy rules, or child-safety requirements.

## Remaining production work
Full Discord permission matrices, roles, true voice/video channels, forum threads, push unread counts, presence, complex onboarding, server-side channel categorization and bot permission policies require further database migrations and staged runtime acceptance tests. The UI does not fake these capabilities.

## Verification
Run Node 24 release:check and Android browser acceptance for public and friends posts, publishing, World owner and non-owner permissions, joining/sending channel messages, old chat login, signout, and persistent storage. Do not enable agent billing as a side effect.
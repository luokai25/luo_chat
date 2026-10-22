# Luo Family — 14.2.0

200 original transparent PNG stickers: 10 characters × 20 moods. Artwork is defined in `src/luo-family.js`, rendered deterministically by `scripts/render-stickers.mjs`. Lettering is outlined, so device and server fonts do not change it. DejaVu lettering license is retained in `docs/sticker-art-license.txt`.

Characters: Lumi, Nori, Milo, Kiki, Boba, Sunny, Pip, Coco, Mochi and Nova.
Moods: Happy, Love, Laughing, Sad, Angry, Surprised, Sleepy, Thanks, Sorry, Celebrating, Thinking, Encouragement, Hello, Goodbye, Hungry, Busy, Shy, Cool, Confused and Calm.

Open **Stickers** beside the message field or from the chat menu. Search a mood or character; choose an emotion, Recent, Favorites, or My stickers. Tap a tile to preview; hold a tile or use the preview Favorite button to save it. Add to message stages the image; Send shares it. The tray never sends automatically.

Create opens a photo picker and existing local canvas editor: crop, rotate, draw, manual background erase, text and undo. Save as sticker keeps it in a named device-local pack; Add sticker to message stages a transparent PNG up to 512 pixels. Existing animated GIF packs remain supported. There is no automatic subject segmentation or native WhatsApp export.

Favorites, recents and personal stickers are scoped to the account on this browser, not synced across devices. Built-in stickers need an initial network fetch. Chat stickers follow existing checked attachment upload, membership, recall, expiry and signed-media URL rules. Auto-preview honors the user's media-preview setting. Presentation uses a supported image filename convention, not a new trusted message type; it grants no extra permissions. Downloading a sticker is aborted logically on tray close, signout or reauthentication; a delayed result cannot stage an attachment.

This release does not clear Google's phishing classification or complete the other open security and device acceptance gates in PROJECT_CHECKLIST.md. Native WhatsApp is a UX reference, with no affiliation or interoperability claim.

# Luo Chat Stories V9: multi-screen composer release gate

Status: **GitHub development branch only**. This checklist does not certify a production-ready build.

## Connected pages

1. **Status editor**: photo/video/audio picker, Android camera capture, native playback preview, caption, music link, 24-hour expiry, Publish loading/locking state.
2. **Audience picker**: My contacts, My contacts except…, Only share with…, Close friends, Only me, and Public when an authenticated server capability explicitly returns true.
3. **Saved contacts picker**: searchable results from the existing authenticated `get_my_chat_contacts` RPC; checkboxes with stable DOM and 100-recipient limit.
4. **Exclusions picker**: excludes individually checked contacts, including cancel/back restoration.
5. **Close friends management**: read and choose saved private circles; persist edits through `save_chat_story_circle`; warn about selected usernames outside the saved contact book.
6. **Advanced circle settings**: original private-circle forms and handlers remain mounted in a collapsible editor section.

## Privacy contract

- `create_private_chat_story` remains the current production publishing RPC.
- The public variant is **not deployed** and the staged migration `20261027140000_story_public_audience_opt_in.sql` has an operator gate **OFF by default**.
- Public Stories are never represented as private in the preview; the user sees a full-audience confirmation before public publishing if the server has explicitly opted in.
- Do not enable public distribution without reviewing moderation, age-specific visibility, abuse reporting and RLS/storage policies. Do not infer capability from client flags.
- Contacts never load from a second account after a sign-out; temporary audience DOM is cleared when navigating back.
- Legacy server-enforced expiry, storage MIME/50 MB limits and user ownership remain unchanged.

## Regression gates before merging

Run `node --test tests/story-audience-flow.test.mjs tests/secondary-v6-functional-screens.test.mjs` plus the full existing unit/integration suite, then run authenticated Android browser checks for:
- gallery, camera, audio/video previews; cancel/reopen and memory cleanup
- contact checkbox selection, scrolling, search and keyboard behavior
- save/load/rename circle and selecting an existing Close friends list
- excluding contacts, cancelling selection, and only-me content
- slow contacts/circles responses, sign-out, double tap and upload failure
- Public unavailable by default and explicitly gated after **staging** migration
- Story media access and visibility from an unrelated account

No live publish or production schema changes should occur as part of test setup.

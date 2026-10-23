# Luo Core — flagship white-kitten replacement

Approved visual: the white kitten from the October 23 conversation, not the previous gold-colored primitive rig.

## Hard acceptance gates

- **Identity:** snow-white/pearl fur with soft gray shading; large glossy gray-blue eyes; realistic whiskers; small blush-pink nose and ears; black collar with legible gold **L** emblem; adorable kitten anatomy.
- **Size:** compact character approximately three short message-line heights. Character moves within existing chats only, with zero change to message bubble layout, header, or composer.
- **Motion:** animated body rig for breathing, blinking, ear flicks, eye gaze, tail sway/curl, paw gestures, walk, idle shifts, crouch, leap, full aerial turn, and smooth landing. No teleporting. Reduced-motion mode and paused off-screen rendering.
- **Interaction:** independently movable, stays clear of composer/buttons/text selection and never blocks primary chat actions. Only in conversation screen.
- **Detail:** editable sculpt and materials; real fur treatment, good silhouette from front, profile and rear; tested animated transitions at multiple frames. Optimize for mobile separately from the offline high-res master; polycount alone is NOT visual quality.
- **Safety:** do not swap the live avatar until actual render reviews and browser navigation tests approve it. Keep backend/auth entirely unchanged.
- **Identity continuity:** same kitten across movement, no shape drift. Preserve personal companion settings across sign-in/out boundaries without leaking user data.

## Work created

- Editable Blender project: https://higgsfield.ai/3d-jutsu/277af779-b874-4dc9-a783-d420083ff214
- Current Blender scene: revision **2**, rigged blockout with named body, head, legs, tail, ears, materials, collar, keyframe sequence.
- Status **NOT READY** for production: requires fur/groom realism, ear and muzzle refinement, collision/grounding, animation auditing, visual review, GPU tests.
- Existing production 3D cat is not the approved model. Its old shape must not be presented as complete.

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

## Detailed Blender rig development (revision 6)

- Blender source project: https://higgsfield.ai/3d-jutsu/277af779-b874-4dc9-a783-d420083ff214
- 64 named bones covering cervical/thoracic/lumbar spine, pelvis, scapulae, fore/hind limbs, individual toes, ear cartilage, eye orbits, jaw, tongue, and nine caudal/tail vertebrae; bones have authored joint poses at 15 animation checkpoints.
- Separate visible controls: ears (2), eye gaze (2), elbow/wrist (2), hind knees (2), independently flexed front/hind toes (12), six linked tail section controllers, blinking eyelids, moving lower jaw and tongue, whiskers.
- Weighted skin deformation across BODY and BIB with four maximum spine influences per vertex, properly armature-parented for GLB export.
- Procedural white/pearl/silver coat: 8,000 body hairs, 9,300 head hairs, 1,900 cheek hairs, and 6,180 six-joint tail hairs. Facial and body hairs have morph-based tip motion; tail coats move with articulated joints. Total **25,380 authored strand units**, realized as strips/geometry, not true physics-simulated follicles.
- Hidden internal driver proxies: lungs, diaphragm and heart with animated breathing/pulse. **NOT** a realistic organ simulator; it does not purport to replicate veterinary anatomy or physiology.
- Generated still audit at rest and aerial apex in progress. Live website is not changed. Mesh still requires visual inspection and further corrective sculpting, testing and app integration before release.

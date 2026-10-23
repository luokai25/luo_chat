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

## Rig verification: revision 8 (2026-10-23)

- 64 Blender bones with authored keyframes, including spine, fore/hind limbs, facial and tail bones.
- 26 additional articulated visible controls for segmented tail, ears, eye gaze, wrists, hind knees and individual paws/toes.
- 25,380 authored fur strips grouped into nine animated coat meshes. Torso fur is skinned to four-nearest spine bones; other groom regions are parented to moving anatomy. These are procedural cards/morphs, **not real per-follicle physics**.
- Three facial shape keys: smile, yawn and curiosity. Blink lids, whiskers and blue-gray eye gaze move independently.
- Heart, lungs and diaphragm are **hidden motion proxies** for life-like breathing/pulsing, not accurate organ simulations.
- Ground-contact solver sampled all 168 frames, corrected penetration at 106 frames and verified sampled paw geometry never falls below z=-0.003m.
- Blender editable master about 20.6 MB and portable GLB about 11.2 MB; authored motion sequence lasts 5.96 seconds at 28 fps.
- EEVEE renders were generated for resting and aerial poses; structural audit passed but final photorealism has NOT been visually approved and is NOT deployed into live chat.
- Next gates: image-reference comparison, fur material polish, locomotion and face-motion transitions, mobile GPU benchmarks, independent named animation clips and isolated web preview.

Never deploy or replace the live cat merely because bone/poly counts and tests passed. Visual quality and realistic motions must be approved.

## New model rebuild — sculpt-first V2 (2026-10-23)

**Scene:** https://higgsfield.ai/3d-jutsu/3b9af2d1-2882-493b-b0cd-ca7dece1ce7b

**Latest settled revision:** 3.

This is a separate, from-scratch replacement instead of patching the rejected primitive/strand-heavy v1. The Blender build has a continuous sculpted kitten head and torso, curved leaf-style ears, layered storm-gray/blue eyes with catchlights, a tiny pink nose, white cheek and paw volumes, tapered tail, black collar with gold letter L, 25 named articulated animation controllers, 46 mesh components, and 12 material roles. An authored 8-second/240-frame sequence contains idle, blink, crouch, leap, midair rotation, landing, and rest. Ground check repaired 56 sampled frames and confirmed minimum paw height +0.003 meters. 

**Visual quality gate remains OPEN.** Blender produced a real rendered hero PNG but the tool connection did not provide a reliable visual inspection to the assistant; no cinematic, anime or approved-identity claim is made. Current generated model is a prototype and must not be integrated/deployed without visual approval, texture/material/rig audits and real-phone performance checks.

**Tool limitation:** connected Higgsfield 3D Jutsu accepts Blender Python scripts, not a freeform cinematic text prompt. The model catalog exposes image-to-3D models but the `generate_3d` connector method is not available. Do not represent the scene as autonomously created by that absent action.

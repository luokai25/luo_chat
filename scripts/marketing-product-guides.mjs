// Detailed, people-first English guides. Not login-gated and not misleading
// copies of the app UI. Keep claims aligned with checked backend behavior.
export const PRODUCT_GUIDES = Object.freeze({
 chats:{
  title:'Private messaging and personalized chats | Luo Chat',
  description:'Explore Luo Chat direct messages, rich Luonix shares, message tools and 100 per-chat wallpapers. Understand what is private, how sharing works and what the app currently supports.',
  eyebrow:'LUO CHAT / DIRECT MESSAGES',
  heading:'Direct messaging designed around the conversation.',
  lead:'Luo Chat puts people and their conversations first. The inbox and message view are built around direct exchanges, readable media, a gold-and-black visual identity and individual appearance settings. Shared Luonix posts can appear as previews within a chat without bypassing the original post’s audience restrictions.',
  topics:[
   ['An inbox that stays focused','Direct conversations are separate from Worlds communities and group discussions. Profile images, unread message states and an open-chat message history help you return to the right person. A community invitation is not a direct-message request.'],
   ['Rich conversations, not just text bubbles','The chat toolkit includes replies, message actions, media attachments, saved content and audio features. Where supported by your device, voice messages can be recorded, played and shared without leaving the conversation. Availability may depend on permissions and connectivity.'],
   ['100 customizable local wallpapers','The chat appearance gallery contains 100 named visual options arranged into ten families of ten patterns. Settings are kept locally per account and conversation, so changing one chat does not silently replace everyone else’s background. Device storage clearing may remove local preferences.'],
   ['Sharing Luonix with the right person','A Luonix video or written/photo post is shared as a reference, not an uncontrolled copied media URL. If a friend no longer has access, the preview must respect the updated permission rather than showing previously cached private material.'],
  ],
  how:['Create or sign in to your human Luo Chat account using the currently supported sign-in method.','Open Chats and find a direct conversation or an approved contact.','Use the composer to send messages, attach media or share a permitted Luonix post.','Open chat settings to select an individual wallpaper and manage available conversation controls.'],
  faq:[
   ['Does choosing a wallpaper upload my messages?','No. The available wallpapers are generated locally from patterns and colors. Privacy of messages still depends on the application’s access-control rules and transport.'],
   ['Can I share a private Luonix item to give someone access?','No. The recipient must already be permitted to view the item. A message preview is not an access token.'],
   ['Are chats end-to-end encrypted?','This guide makes no end-to-end-encryption claim. Review the current privacy and security information rather than assuming a feature that has not been independently verified.'],
  ],
  foot:'Chats are for direct messages. Communities and groups are organized under Worlds instead.'
 },
 luonix:{
  title:'Luonix: short videos, photos and written posts | Luo Chat',
  description:'See how Luonix combines short videos, photos and written social posts. Learn about publishing, captions, audience selection and sharing Luonix content into chats.',
  eyebrow:'LUO CHAT / LUONIX',
  heading:'More than a video feed. Your moments in one place.',
  lead:'Luonix is Luo Chat’s mixed-media social feed. It brings short videos, photographs and written moments into a single experience rather than forcing you into separate sections just to find a friend’s post. Social content stays attached to its publishing account and intended visibility.',
  topics:[
   ['Videos, photographs and thoughts','The mixed-media viewer requests published video clips and written or photo posts, combines authorized sources and orders visible entries by recency. If a post is private or no longer published, it should not become visible simply because it used to exist.'],
   ['A publishing flow with clear steps','The video creator separates Media, Edit and Share. You can import eligible video files or use device camera permission where available, make supported timeline adjustments, review the media and choose your audience before publishing. Browser and hardware restrictions still apply.'],
   ['Share the post, preserve the permissions','Share a Luonix clip or post into a direct message as a reference. The recipient sees a rich preview only if the server permits access to the original. A message never exposes a permanent signed media URL to bypass the author’s privacy setting.'],
   ['Keep conversations connected','Luonix and Chats are parts of the same app. Media comments, browsing and sharing should lead back to the real content and social context, not an unrelated third-party download service.'],
  ],
  how:['Open the Luonix tab to browse authorized videos, pictures and posts.','Use the publish control to choose a clip or create an eligible social post.','Review supported edits, captions and visibility settings before publishing.','Share a published item inside Chats; the recipient’s viewing rights are evaluated separately.'],
  faq:[
   ['Are written posts included in Luonix?','Yes. The feed combines published video clips and post records, which may be written text or include photographs.'],
   ['Does sharing unlock a private post?','No. Sharing a reference never changes the original post’s visibility rules.'],
   ['Can I use any copyrighted music automatically?','No. This guide does not claim a licensed commercial music catalog. Use only content you are permitted to publish.'],
  ],
  foot:'The current creator supports its implemented media formats and export limits. This is not a promise of every feature in another social network.'
 },
 worlds:{
  title:'Worlds: channels and communities for people and AI agents | Luo Chat',
  description:'Learn how Luo Worlds organizes human communities and openly identified AI agents with channels, membership requests, moderation and permissions separate from private chats.',
  eyebrow:'LUO CHAT / WORLDS',
  heading:'Communities deserve a world of their own.',
  lead:'Worlds is Luo Chat’s community space, separate from the direct-message inbox. Organize a shared interest, explore discussion channels, request membership and participate in a world with permission-controlled conversation rooms. Humans and identified AI agents are subject to the platform’s actual account and membership policies.',
  topics:[
   ['A home for channels, not a pile of DMs','Worlds has its own community directory, icon navigation and channel sidebar. Group discussions belong here; direct-message navigation stays focused on person-to-person chats.'],
   ['Membership and moderation enforced on the server','Community creation, joining, room browsing and owner moderation use authorized server operations. A visible channel icon does not bypass membership decisions, and private world content must remain inaccessible to outsiders.'],
   ['Text discussions in their own rooms','Text-channel history and new messages reuse the app’s authenticated messaging controls. Each permitted participant sees the channel according to server rules. An unsuccessful send should retain its draft rather than pretending it succeeded.'],
   ['People and AI agents, clearly identified','Agent integrations have public documentation, but paid agent registrations and unrestricted autonomous posting are not open. An AI agent cannot pay its way around room permissions, community moderation or account safety rules.'],
  ],
  how:['Open the Worlds tab rather than searching for group rooms in your direct-message inbox.','Browse available public Worlds, or create a world with an appropriate visibility setting.','Join or request access where required; world owners control membership approvals.','Open an authorized text channel to read and participate according to your account permissions.'],
  faq:[
   ['Do all Worlds have public channels?','No. Visibility and membership differ between communities. The backend decides which rooms you can access.'],
   ['Can I add an AI agent today?','The integration guide is available, but production automated account onboarding is still gated pending security, entitlement and payment validation.'],
   ['Are Discord-style voice rooms already fully supported?','No. Dedicated Worlds voice-stage infrastructure remains a separate development requirement. The interface does not treat unavailable voice rooms as live.'],
  ],
  foot:'Create a World for community discussion; use Chats for a private direct conversation. Worlds voice and advanced role systems remain future infrastructure work.'
 }
});

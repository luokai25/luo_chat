/* Luo Chat phone UI consolidation. No mock data, no custom call handling. */
(()=>{'use strict';
const $=id=>document.getElementById(id),app=()=>document.querySelector('.app');
function begin(){
 const root=app(),chats=$('chats'),nav=$('luoApprovedNav');
 if(!root||!chats||!nav||$('luoStatusPage'))return;
 function dedup(){
  for(const node of chats.querySelectorAll('div,section,nav')){
   if(node.id==='luoApprovedFilters'||node.closest('#luoApprovedFilters,#luoStatusPage,#luoCommunityPage'))continue;
   const direct=[...node.children].filter(x=>x.tagName==='BUTTON');
   const words=direct.map(x=>(x.textContent||'').trim().toLowerCase());
   if(words.includes('all')&&words.includes('unread')&&words.includes('groups')&&direct.length>=3)node.classList.add('luo-legacy-filter-hidden');
  }
 }
 dedup();new MutationObserver(dedup).observe(chats,{childList:true,subtree:false});
 const updates=document.createElement('section');updates.id='luoStatusPage';updates.setAttribute('aria-label','Updates and stories');
 updates.innerHTML='<header class="luo-mobile-page-head"><h2>Updates</h2><button id="luoStoryPrivacy" type="button">View stories</button></header><div class="luo-mobile-section-label">Status</div><button type="button" id="luoMyStatus" class="luo-status-choice"><span class="luo-status-icon">＋</span><span class="luo-status-description"><strong>My status</strong><small>Add a photo, video or text update</small></span></button><div class="luo-status-line"></div><div class="luo-mobile-section-label">Recent updates</div><button type="button" id="luoSharedStories" class="luo-status-choice"><span class="luo-status-icon">◉</span><span class="luo-status-description"><strong>View shared updates</strong><small>Stories from your contacts in the last 24 hours</small></span><span aria-hidden="true">›</span></button><p class="luo-status-info">These stories use Luo Chat’s existing private audience and expiry rules.</p>';
 chats.append(updates);
 function story(newOne){
  if(newOne){const b=document.querySelector('.luo-story-new');if(b){b.click();return}}
  const explore=document.querySelector('.luo-story-explore');
  if(explore){explore.click();return}
  $('openStories')?.click();
 }
 $('luoMyStatus').onclick=()=>story(true);$('luoSharedStories').onclick=()=>story(false);$('luoStoryPrivacy').onclick=()=>story(false);
 const communities=document.createElement('section');communities.id='luoCommunityPage';communities.setAttribute('aria-label','Communities');
 communities.innerHTML='<header class="luo-mobile-page-head"><h2>Communities</h2></header><div class="luo-community-hero"><div class="symbol">♧</div><h3>Bring your people together</h3><p>Create and manage private group conversations with your people.</p></div><button id="luoCreateGroupFromCommunity" class="luo-mobile-feature" type="button"><span class="luo-feature-icon">＋</span><span class="luo-feature-copy"><strong>Create a group</strong><small>Choose a group name and invite members</small></span><span>›</span></button><button id="luoFindGroupsFromCommunity" class="luo-mobile-feature" type="button"><span class="luo-feature-icon">⌕</span><span class="luo-feature-copy"><strong>Find a group chat</strong><small>Search your existing conversations</small></span><span>›</span></button><p class="luo-status-info">Open a group conversation to manage its members and settings.</p>';
 chats.append(communities);
 const tab=k=>document.querySelector('.workspace-nav [data-tab="'+k+'"]')?.click();
 function show(key){
  root.classList.toggle('luo-status-page',key==='updates');root.classList.toggle('luo-community-page',key==='group');
  for(const btn of nav.querySelectorAll('button[data-target]'))btn.setAttribute('aria-current',btn.dataset.target===key?'page':'false');
 }
 $('luoCreateGroupFromCommunity').onclick=()=>{show(null);tab('group')};
 $('luoFindGroupsFromCommunity').onclick=()=>{show(null);tab('chats');$('search')?.focus()};
 nav.addEventListener('click',e=>{
  const b=e.target.closest('button[data-target]');if(!b)return;
  if(b.dataset.target==='updates'&&window.LuoUpdatesV2)return;
  if(b.dataset.target==='updates'||b.dataset.target==='group'){
   if(b.dataset.target==='group'&&document.querySelector('#group .worlds-app')){e.preventDefault();e.stopImmediatePropagation();show(null);tab('group');return}
   e.preventDefault();e.stopImmediatePropagation();
   if(root.dataset.screen!=='home'||root.dataset.tab!=='chats')tab('chats');
   root.classList.remove('luo-calls-open');show(b.dataset.target);
  }else show(null);
 },true);
 new MutationObserver(()=>{if(root.dataset.screen==='room')show(null)}).observe(root,{attributes:true,attributeFilter:['data-screen']});
 function decorateCall(){
  const d=$('luoCall');if(!d||d.dataset.luoPhoneStyle)return;
  d.dataset.luoPhoneStyle='1';const identity=document.createElement('div');identity.id='luoCallIdentity';identity.innerHTML='<div class="luo-call-avatar" aria-hidden="true">L</div><span class="luo-call-who">Luo Chat</span>';
  const video=d.querySelector('.call-video-grid');if(video)video.before(identity);else d.append(identity);
  function sync(){const title=$('callTitle')?.textContent||'Luo Chat';const voice=!/video/i.test(title);d.classList.toggle('luo-voice-mode',voice);const who=title.replace(/^(?:Voice|Video) call\s*[·:]?\s*/i,'').trim()||'Luo Chat';identity.querySelector('.luo-call-who').textContent=who;identity.querySelector('.luo-call-avatar').textContent=who.charAt(0).toUpperCase();}
  const label=$('callTitle');if(label)new MutationObserver(sync).observe(label,{childList:true,subtree:true,characterData:true});
  new MutationObserver(sync).observe(d,{attributes:true,attributeFilter:['open']});sync();
 }
 decorateCall();new MutationObserver(()=>{if($('luoCall')&&!$('luoCall').dataset.luoPhoneStyle)decorateCall()}).observe(document.body,{childList:true});
 document.documentElement.dataset.luoPhonePolish='20261022';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
})();
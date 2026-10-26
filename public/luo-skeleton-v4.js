/* Luo Skeleton V4: shape-accurate, data-driven loading placeholders.
   Never synthesizes chats, status contacts, posts, members, or saved content.
   Source apps continue to own their network requests and error/retry controls. */
(()=>{
 'use strict';
 const doc=document, app=doc.querySelector('.app');
 if(!app||window.LuoSkeletonV4)return;
 const $=selector=>doc.querySelector(selector);
 const element=(tag,cls)=>{const n=doc.createElement(tag);if(cls)n.className=cls;return n};
 const make=(tag,cls,children=[])=>{const n=element(tag,cls);for(const child of children)n.append(child);return n};
 const bar=(cls='sk-bar')=>element('span',cls);
 const avatar=(cls='sk-avatar')=>element('span',cls);
 const meta=(cls,children)=>make('span',cls,children);
 const hasVisible=(host,query)=>!!host?.querySelector(query);
 const loadingText=(selector,pattern)=>pattern.test($(selector)?.textContent?.trim()||'');
 const requests=new Map(),controllers=new Map();
 const settings={delay:120,minimum:180,slow:12000};
 let frame=0,observer=null,stopped=false;
 const loggedIn=()=>app.dataset.screen==='home'||app.dataset.screen==='room';
 function spec(key){
  switch(key){
   case 'inbox': return {
    host:$('#chatlist'),kind:'chat',count:4,
    busy:()=>app.dataset.screen==='home'&&app.dataset.tab==='chats'&&!window.LuoUpdatesV2?.active?.()&&
      !hasVisible($('#chatlist'),'.chatrow')&&
      (requests.get('inbox')?.busy||Boolean($('#chatlist')?.dataset.luoLoadingToken)||loadingText('#chatlist .empty',/^Loading conversations/i))
   };
   case 'messages': return {
    host:$('#messages'),kind:'message',count:5,
    busy:()=>app.dataset.screen==='room'&&loadingText('#messages .empty',/^Loading (messages|history|device copy)/i)&&!hasVisible($('#messages'),'.bubble')
   };
   case 'statuses': return {
    host:$('#luoUpdatesV2Rail'),kind:'status',count:3,
    busy:()=>app.dataset.screen==='home'&&window.LuoUpdatesV2?.active?.()&&
      !hasVisible($('#luoUpdatesV2Rail'),'.luo-status-v2-tile:not(.luo-status-v2-my)')&&
      loadingText('#storyFeedStatus',/^Loading stories/i)
   };
   case 'status-media': return {
    host:$('#luoUpdatesV2Viewer .luo-status-v2-media'),kind:'media',count:1,
    busy:()=>Boolean($('#luoUpdatesV2Viewer[open]'))&&loadingText('#luoUpdatesV2Viewer .luo-status-v2-view-message',/^Opening private media/i)
   };
   case 'profile': return {
    host:$('#personBody'),kind:'profile',count:1,
    busy:()=>Boolean($('#personDialog[open]'))&&loadingText('#personStatus',/^Loading profile/i)&&!$('#personBody')?.children.length
   };
   case 'contacts': return {
    host:$('#connectionList'),kind:'chat',count:3,
    busy:()=>loadingText('#connectionStatus',/^Loading/i)&&!hasVisible($('#connectionList'),'.connection-row')&&
      !$('#new')?.classList.contains('hidden')
   };
   case 'worlds': return {
    host:$('.worlds-content'),kind:'world',count:3,
    busy:()=>app.dataset.tab==='group'&&loadingText('.worlds-status',/^Loading Worlds/i)&&
      !hasVisible($('.worlds-content'),'.worlds-discover-card,.worlds-welcome,.worlds-channel-history')
   };
   case 'channels': return {
    host:$('.worlds-channels'),kind:'channel',count:5,
    busy:()=>app.dataset.tab==='group'&&loadingText('.worlds-status',/^Loading channels/i)&&
      !hasVisible($('.worlds-channels'),'.worlds-channel')
   };
   case 'feed': {
    const host=$('.luo-feed-list'),reels=Boolean(host?.closest('.luo-feed-reels'));
    return {
     host,kind:reels?'reel':'post',count:reels?1:2,
     busy:()=>app.dataset.tab==='social'&&loadingText('.luo-feed-feedback',/^Finding your next moment/i)&&
       !hasVisible(host,'.luo-feed-card')
    };
   }
   case 'social': return {
    host:$('.luo-social-content'),kind:'post',count:2,
    busy:()=>app.dataset.tab==='social'&&loadingText('.luo-social-content .luo-social-empty',/^Loading/i)&&
      !hasVisible($('.luo-social-content'),'.luo-social-card')
   };
   case 'shared': return {
    host:$('#sharedList'),kind:'shared',count:4,
    busy:()=>Boolean($('#sharedDialog[open]'))&&!!$('#sharedList')&&
      !hasVisible($('#sharedList'),'img,video,audio,.shared-item,.shared-media-card')&&
      (loadingText('#sharedList',/^Loading (shared|media|files|attachments)/i)||
       $('#sharedList')?.dataset.luoLoadingToken!==undefined)
   };
   case 'search': return {
    host:$('#globalSearchResults'),kind:'search',count:3,
    busy:()=>app.dataset.screen==='home'&&
      !hasVisible($('#globalSearchResults'),'.global-result,.search-result,.chatrow')&&
      (loadingText('#globalSearchResults',/^(Searching|Loading results)/i)||
       $('#globalSearchResults')?.dataset.luoLoadingToken!==undefined)
   };
   case 'comments': return {
    host:$('.luo-feed-comments[open] .luo-feed-comment-list'),kind:'comment',count:4,
    busy:()=>Boolean($('.luo-feed-comments[open]'))&&
      loadingText('.luo-feed-comments[open] .luo-feed-feedback',/^Loading comments/i)&&
      !hasVisible($('.luo-feed-comments[open] .luo-feed-comment-list'),'.luo-feed-comment')
   };
  }
  return null;
 }
 const keys=['inbox','messages','statuses','status-media','profile','contacts','worlds','channels','feed','social','comments','shared','search'];
 function chatRow(i){
  const b=make('span','sk-lines',[bar('sk-bar sk-primary'),bar('sk-bar sk-secondary')]);
  const time=make('span','sk-meta',[bar('sk-bar sk-time')]);
  if(i===0)time.append(bar('sk-bar sk-count'));
  return make('span','luo-skeleton-tile sk-chat-row',[avatar(),b,time]);
 }
 function messageRow(i){
  const mine=i%3===1||i%3===2;
  const wrap=element('span','luo-skeleton-tile sk-message'+(mine?' sk-own':' sk-theirs'));
  const lines=make('span','sk-bubble-lines',[bar('sk-bar sk-message-line')]);
  if(i===0||i===3)lines.append(bar('sk-bar sk-message-line sk-short'));
  lines.append(bar('sk-bar sk-message-time'));
  wrap.append(lines);
  return wrap;
 }
 function statusCard(i){
  const t=make('span','luo-skeleton-tile sk-status-card',[avatar('sk-avatar sk-status-avatar')]);
  const cover=make('span','sk-status-cover');
  t.append(cover,bar('sk-bar sk-status-label'));
  return t;
 }
 function postCard(i,reel=false){
  const t=element('span','luo-skeleton-tile sk-post-card'+(reel?' sk-reel-card':''));
  if(!reel)t.append(make('span','sk-post-header',[avatar('sk-avatar sk-feed-avatar'),make('span','sk-lines',[bar('sk-bar sk-primary'),bar('sk-bar sk-secondary')])]));
  t.append(make('span','sk-post-media',[bar('sk-bar sk-post-media-mark')]));
  if(reel){
   t.append(make('span','sk-reel-info',[avatar('sk-avatar sk-feed-avatar'),bar('sk-bar sk-reel-name'),bar('sk-bar sk-reel-caption')]));
   t.append(make('span','sk-reel-actions',[bar('sk-bar'),bar('sk-bar'),bar('sk-bar')]));
  }else t.append(make('span','sk-post-footer',[bar('sk-bar sk-post-actions'),bar('sk-bar sk-post-caption')]));
  return t;
 }
 function worldCard(i){
  return make('span','luo-skeleton-tile sk-world-row',[avatar('sk-avatar sk-world-avatar'),make('span','sk-lines',[bar('sk-bar sk-primary'),bar('sk-bar sk-secondary'),bar('sk-bar sk-tertiary')]),bar('sk-bar sk-world-action')]);
 }
 function channelCard(i){
  return make('span','luo-skeleton-tile sk-channel-row',[bar('sk-bar sk-channel-icon'),bar('sk-bar sk-channel-title')]);
 }
 function profileCard(){
  return make('span','luo-skeleton-tile sk-profile-card',[avatar('sk-avatar sk-profile-avatar'),bar('sk-bar sk-profile-name'),bar('sk-bar sk-profile-username'),bar('sk-bar sk-profile-bio'),make('span','sk-profile-actions',[bar('sk-bar'),bar('sk-bar')])]);
 }
 function sharedCard(i){
  return make('span','luo-skeleton-tile sk-shared-card',[
   make('span','sk-shared-thumb',[bar('sk-bar sk-shared-glyph')]),
   bar('sk-bar sk-shared-title'),
   bar('sk-bar sk-shared-caption')
  ]);
 }
 function searchCard(i){
  return make('span','luo-skeleton-tile sk-search-row',[
   avatar('sk-avatar sk-search-avatar'),
   make('span','sk-lines',[bar('sk-bar sk-primary'),bar('sk-bar sk-secondary')]),
   bar('sk-bar sk-search-time')
  ]);
 }
 function commentCard(i){
  return make('span','luo-skeleton-tile sk-comment-row',[avatar('sk-avatar sk-comment-avatar'),make('span','sk-lines',[bar('sk-bar sk-primary'),bar('sk-bar sk-secondary')])]);
 }
 function createStage(key,rule){
  const stage=element('div','luo-skeleton-stage luo-skeleton-v4');
  stage.dataset.loading=key;stage.dataset.kind=rule.kind;stage.setAttribute('aria-hidden','true');
  for(let i=0;i<rule.count;i++){
   const tile=rule.kind==='chat'?chatRow(i):
    rule.kind==='message'?messageRow(i):
    rule.kind==='status'?statusCard(i):
    rule.kind==='post'?postCard(i):
    rule.kind==='reel'?postCard(i,true):
    rule.kind==='world'?worldCard(i):
    rule.kind==='channel'?channelCard(i):
    rule.kind==='profile'?profileCard(i):
    rule.kind==='comment'?commentCard(i):
    rule.kind==='shared'?sharedCard(i):
    rule.kind==='search'?searchCard(i):
    make('span','luo-skeleton-tile sk-media-placeholder',[bar('sk-bar sk-media-glyph')]);
   stage.append(tile);
  }
  return stage;
 }
 function clearTimers(entry){
  if(entry?.openTimer)clearTimeout(entry.openTimer);
  if(entry?.closeTimer)clearTimeout(entry.closeTimer);
  if(entry?.slowTimer)clearTimeout(entry.slowTimer);
  if(entry){entry.openTimer=null;entry.closeTimer=null;entry.slowTimer=null}
 }
 function remove(key,force=false){
  const entry=controllers.get(key);
  if(!entry)return;
  if(!force&&entry.visibleSince&&Date.now()-entry.visibleSince<settings.minimum){
   if(!entry.closeTimer)entry.closeTimer=setTimeout(()=>remove(key,true),settings.minimum-(Date.now()-entry.visibleSince));
   return;
  }
  clearTimers(entry);
  entry.stage?.remove();entry.warning?.remove();
  if(entry.host){
   entry.host.classList.remove('luo-skeleton-active');
   entry.host.removeAttribute('aria-busy');
  }
  controllers.delete(key);
 }
 function purge(){
  for(const key of [...controllers.keys()])remove(key,true);
  requests.clear();
  for(const stage of doc.querySelectorAll('.luo-skeleton-v4'))stage.remove();
 }
 function activate(key,rule){
  const host=rule.host;if(!host)return;
  let entry=controllers.get(key);
  if(entry&&entry.host!==host){remove(key,true);entry=null}
  if(!entry){
   entry={host,stage:null,warning:null,started:Date.now(),visibleSince:0,openTimer:null,closeTimer:null,slowTimer:null};
   controllers.set(key,entry);
  }
  if(entry.closeTimer){clearTimeout(entry.closeTimer);entry.closeTimer=null}
  host.setAttribute('aria-busy','true');
  if(entry.stage&&entry.stage.isConnected)return;
  if(entry.openTimer)return;
  const begin=()=>{entry.openTimer=null;if(stopped||controllers.get(key)!==entry||!loggedIn())return;
   const current=spec(key);if(!current||current.host!==host||!current.busy())return;
   entry.stage=createStage(key,current);
   // Reserve the measured viewport width, not a guessed phone size.
   // Avoids horizontal skeleton overflow on compact Android windows.
   const width=host.getBoundingClientRect?.().width||host.clientWidth||0;
   if(width>0)entry.stage.style.setProperty('--sk-host-width',Math.round(width)+'px');
   host.append(entry.stage);host.classList.add('luo-skeleton-active');
   entry.visibleSince=Date.now();
   if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||navigator.connection?.saveData)entry.stage.classList.add('sk-static');
   entry.slowTimer=setTimeout(()=>{
    if(controllers.get(key)!==entry||!entry.stage?.isConnected)return;
    entry.stage.classList.add('sk-slow');
    entry.warning=element('p','luo-skeleton-slow-message');
    entry.warning.setAttribute('role','status');
    entry.warning.textContent='Still loading. Check your connection if this continues.';
    host.append(entry.warning);
   },settings.slow);
  };
  entry.openTimer=setTimeout(begin,settings.delay);
 }
 function sync(){
  frame=0;if(stopped)return;
  if(!loggedIn()){purge();return}
  for(const key of keys){
   const current=spec(key);
   const pending=current?.host&&current.busy();
   if(pending)activate(key,current);
   else remove(key);
  }
 }
 const schedule=()=>{if(frame||stopped)return;frame=requestAnimationFrame(sync)};
 function loadingEvent(event){
  const {key,pending,id}=event.detail||{};
  if(key!=='chats'&&key!=='inbox')return;
  const name='inbox',previous=requests.get(name);
  if(pending){requests.set(name,{busy:true,id});schedule()}
  else if(previous&&previous.id===id){requests.delete(name);schedule()}
 }
 function start(){
  if(stopped||observer)return;
  window.addEventListener('luo:loading-state',loadingEvent);
  observer=new MutationObserver(()=>schedule());
  observer.observe(doc.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-screen','data-tab','open','hidden','class']});
  window.addEventListener('pagehide',stop,{once:true});
  schedule();
 }
 function stop(){
  stopped=true;if(frame)cancelAnimationFrame(frame);frame=0;
  observer?.disconnect();observer=null;
  window.removeEventListener('luo:loading-state',loadingEvent);
  purge();
 }
 window.LuoSkeletonV4={refresh:schedule,stop,config:{...settings},layout:key=>spec(key)?.kind||null};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

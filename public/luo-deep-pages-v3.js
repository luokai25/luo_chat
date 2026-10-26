/* Luo Chat V3: secondary screens, native workflow preservation, honest skeleton loading.
   All server actions and validation stay in the underlying app modules. */
(()=>{
 'use strict';
 const doc=document,$=id=>doc.getElementById(id),app=doc.querySelector('.app');
 if(!app||window.LuoDeepPagesV3)return;
 const make=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
 const action=(name,callback,cls='luo-deep-button')=>{const b=make('button',cls,name);b.type='button';b.addEventListener('click',callback);return b};
 const safeFocus=el=>{try{el?.focus({preventScroll:true})}catch{el?.focus?.()}};
 const auth=()=>app.dataset.screen==='home'||app.dataset.screen==='room';
 let settingsDepth=false,domObserver=null,settingsObserver=null;
 // Install the category router before hydration. Native settings may bind its
 // own onclick later; capture never replaces its validation or save handlers.
 doc.addEventListener('click',event=>{
  const item=event.target.closest?.('#settingsNav [data-setting]');
  if(!item||app.dataset.screen==='auth')return;
  const root=$('profile');if(!root)return;
  settingsDepth=true;root.classList.add('luo-settings-v3','luo-settings-deep');
  root.dataset.luoSection=item.dataset.setting;
 },true);
 function settings(){
  const root=$('profile'),panels=$('settingsPanels'),nav=$('settingsNav'),search=$('settingsSearch');
  if(!root||!panels||!nav||root.dataset.luoDeepReady)return;
  root.dataset.luoDeepReady='true';root.classList.add('luo-settings-v3');
  const returnBtn=action('‹  Settings',backSettings,'luo-settings-v3-back');returnBtn.id='luoSettingsReturn';returnBtn.setAttribute('aria-label','Back to settings categories');
  panels.prepend(returnBtn);
  for(const btn of nav.querySelectorAll('[data-setting]')){
   const k=btn.dataset.setting,section=$('settings-'+k);
   if(!section)continue;
   const copy=btn.querySelector('strong')?.textContent||btn.textContent.trim();
   const glyph={profile:'♙',privacy:'◈',chats:'◉',permissions:'◇',notifications:'♧',storage:'▣',account:'♢',help:'?'};
   btn.prepend(make('span','luo-settings-v3-icon',glyph[k]||'✦'));
   const panelHeading=section.querySelector('.settings-panel-title,h3');
   if(panelHeading)panelHeading.classList.add('luo-deep-section-heading');
   btn.addEventListener('click',()=>{
    settingsDepth=true;root.classList.add('luo-settings-deep');root.dataset.luoSection=k;
    returnBtn.setAttribute('aria-label','Back to settings from '+copy);
    returnBtn.dataset.section=copy;
    const p=section.querySelector('input,select,textarea,button');
    if(winSmall())setTimeout(()=>safeFocus(returnBtn),0);
   });
  }
  // Capture delegated category activation even when future native settings code
  // replaces individual category buttons during a rerender.
  nav.addEventListener('click',event=>{
   const btn=event.target.closest?.('[data-setting]');if(!btn||!nav.contains(btn))return;
   settingsDepth=true;root.classList.add('luo-settings-deep');
   root.dataset.luoSection=btn.dataset.setting;
   returnBtn.dataset.section=btn.querySelector('strong')?.textContent||btn.textContent.trim();
  },true);
  search.addEventListener('input',()=>{if(search.value.trim())backSettings(false)});
  const edit=$('editProfileShortcut');edit?.addEventListener('click',()=>{
   root.classList.add('luo-settings-deep');root.dataset.luoSection='profile';settingsDepth=true;
  });
  settingsObserver=new MutationObserver(()=>{
   // Reopening Settings starts at the category list on phones, not a stale child screen.
   if(!auth()||app.dataset.tab!=='profile'){if(settingsDepth)backSettings(false)}
  }).observe(app,{attributes:true,attributeFilter:['data-screen','data-tab']});
 }
 function winSmall(){return (window.innerWidth||1000)<=730}
 function backSettings(focus=true){
  const root=$('profile');if(!root)return;
  settingsDepth=false;root.classList.remove('luo-settings-deep');delete root.dataset.luoSection;
  if(focus)safeFocus($('settingsSearch'));
 }
 function storyComposer(){
  const dialog=$('storyComposer'),form=$('storyForm');
  if(!dialog||!form||form.dataset.luoComposerV3)return;
  form.dataset.luoComposerV3='true';dialog.classList.add('luo-story-composer-v3');
  const heading=form.querySelector('.dialog-heading');
  const hero=make('div','luo-story-v3-hero');
  hero.append(make('span','luo-story-v3-symbol','◉'),make('div','luo-story-v3-heading','My status'));
  hero.append(make('p','luo-story-v3-description','A moment for the people you choose. Visible for 24 hours.'));
  const toolbar=make('div','luo-story-v3-tabs');toolbar.setAttribute('role','tablist');toolbar.setAttribute('aria-label','Status composer views');
  const panels=make('div','luo-story-v3-panels');
  const names=[['media','Photo / video'],['text','Text'],['audience','Audience']];
  const views={};
  const buttons={};
  for(const [key,label] of names){
   const page=make('section','luo-story-v3-pane');page.dataset.step=key;page.id='luoStoryV3'+key;
   page.setAttribute('role','tabpanel');
   const tab=action(label,()=>storyMode(key),'luo-story-v3-tab');
   tab.id='luoStoryTab'+key;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',page.id);
   page.setAttribute('aria-labelledby',tab.id);toolbar.append(tab);panels.append(page);
   views[key]=page;buttons[key]=tab;
  }
  views.media.append(make('h3','','Share a photo or video'),make('p','luo-story-v3-help','Keep the moment the focus. Video, image, audio and optional music links use the existing uploader.'));
  views.text.append(make('h3','','Write a status'),make('p','luo-story-v3-help','Text can accompany a photo or stand alone.'));
  views.audience.append(make('h3','','Who can see this?'),make('p','luo-story-v3-help','Only selected Luo Chat accounts will receive this status. Blank means only you.'));
  const move=(id,to)=>{
   const field=$(id);if(!field)return;
   const label=form.querySelector('label[for="'+id+'"]');if(label)to.append(label);
   to.append(field);
  };
  move('storyMedia',views.media);
  const existingPreview=$('luoStoryUploadPreview');if(existingPreview)views.media.append(existingPreview);
  move('storyMusic',views.media);
  move('storyBody',views.text);
  for(const id of ['storyAudience','storyUseContacts','storyCircle','storyCircleName','saveStoryCircle'])move(id,views.audience);
  const privacyHelper=$('luoStoryPrivacyHint');if(privacyHelper)views.audience.append(privacyHelper);
  const note=[...form.querySelectorAll('p.tiny.muted')].find(p=>/leaving the audience blank|Stories are visible only/i.test(p.textContent));
  if(note)views.audience.append(note);
  const bar=make('div','luo-story-v3-audience-bar');
  const who=make('span','luo-story-v3-audience-count','Only you');
  const edit=action('Change audience  ›',()=>storyMode('audience'),'luo-story-v3-audience-button');
  bar.append(make('span','luo-story-v3-lock','♧'),who,edit);
  function updateAudience(){
   const names=($('storyAudience')?.value||'').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
   who.textContent=names.length===0?'Only you':names.length===1?'1 selected account':names.length+' selected accounts';
  }
  $('storyAudience')?.addEventListener('input',updateAudience);
  form.addEventListener('input',event=>{if(event.target.id==='storyAudience')updateAudience()});
  form.addEventListener('change',event=>{if(event.target.id==='storyAudience')updateAudience()});
  $('storyCircle')?.addEventListener('change',updateAudience);
  $('storyUseContacts')?.addEventListener('click',()=>{setTimeout(updateAudience,200);setTimeout(updateAudience,900)});
  const publish=$('publishStory'),feedback=$('storyStatus');
  if(heading)heading.after(hero,toolbar,panels,bar);else form.prepend(hero,toolbar,panels,bar);
  if(feedback)form.append(feedback);
  if(publish)form.append(publish);
  function storyMode(key){
   const mode=views[key]?key:'media';
   for(const [k,pane] of Object.entries(views)){
    pane.hidden=k!==mode;pane.setAttribute('aria-hidden',String(k!==mode));
    buttons[k].setAttribute('aria-selected',String(k===mode));buttons[k].tabIndex=k===mode?0:-1;
   }
   dialog.dataset.luoStoryMode=mode;
   updateAudience();
   if(mode==='audience')safeFocus($('storyAudience'));
  }
  toolbar.addEventListener('keydown',e=>{
   const keys=names.map(([k])=>k),idx=keys.indexOf(dialog.dataset.luoStoryMode);
   if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
    e.preventDefault();const next=(idx+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
    storyMode(keys[next]);safeFocus(buttons[keys[next]]);
   }
  });
  dialog.addEventListener('close',()=>{storyMode('media')});
  storyMode(dialog.dataset.luoPendingStoryMode||'media');
  window.LuoDeepPagesV3=window.LuoDeepPagesV3||{};
  window.LuoDeepPagesV3.storyMode=storyMode;
 }
 function decorate(dialog){
  if(!dialog||dialog.dataset.luoSurfaceV3||/^(luoStatusViewer|luoUpdatesV2Viewer)$/.test(dialog.id))return;
  dialog.dataset.luoSurfaceV3='true';
  const heading=dialog.querySelector('.dialog-heading');
  if(heading){heading.classList.add('luo-deep-modal-heading');const title=heading.querySelector('h2');if(title)title.classList.add('luo-deep-title')}
  if(dialog.id==='personDialog')dialog.classList.add('luo-deep-person');
  if(dialog.id==='personPhotoDialog'||dialog.id==='avatarDialog')dialog.classList.add('luo-deep-photo');
 }
 const kinds={
  chats:{host:'#chatlist',state:()=>{const list=$('chatlist');return !!list?.querySelector('.empty')&&/loading conversations/i.test(list.querySelector('.empty').textContent)},type:'chat',count:4},
  messages:{host:'#messages',state:()=>{const el=$('messages');return !!el?.querySelector('.empty')&&/loading (messages|history|device copy)/i.test(el.querySelector('.empty').textContent)},type:'message',count:4},
  person:{host:'#personBody',state:()=>/^Loading profile/.test($('personStatus')?.textContent||''),type:'profile',count:1},
  connections:{host:'#connectionList',state:()=>/^Loading/i.test($('connectionStatus')?.textContent||'')&&!($('connectionList')?.querySelector('.connection-row')),type:'chat',count:3},
  worlds:{host:'.worlds-content',state:()=>/^Loading (Worlds|channels)/i.test(doc.querySelector('.worlds-status')?.textContent||'')&&!doc.querySelector('.worlds-content .worlds-discover-card'),type:'world',count:3},
  luonix:{host:'.luo-feed-list',state:()=>/^Finding your next moment/i.test(doc.querySelector('.luo-feed-feedback')?.textContent||'')&&!doc.querySelector('.luo-feed-list .luo-feed-card'),type:'post',count:2},
  social:{host:'.luo-social-content',state:()=>{const v=doc.querySelector('.luo-social-content');return !!v?.querySelector('.luo-social-empty')&&/^Loading/i.test(v.querySelector('.luo-social-empty').textContent)},type:'post',count:2},
  stories:{host:'#luoUpdatesV2Rail',state:()=>/Loading stories/i.test($('storyFeedStatus')?.textContent||''),type:'story',count:4}
 };
 let raf=0,lastActive=false;
 function ensureSkeleton(host,key,kind,rows,on){
  const found=host.querySelector(':scope > .luo-skeleton-stage[data-loading="'+key+'"]');
  if(!on){if(found)found.remove();if(!host.querySelector(':scope > .luo-skeleton-stage')){host.removeAttribute('aria-busy');host.classList.remove('luo-skeleton-active')}return}
  if(found)return;
  const stage=make('div','luo-skeleton-stage');stage.dataset.loading=key;stage.setAttribute('aria-hidden','true');stage.dataset.kind=kind;
  for(let i=0;i<rows;i++){
   const card=make('div','luo-skeleton-tile');
   card.append(make('span','luo-skeleton-avatar'),make('span','luo-skeleton-lines'));
   stage.append(card);
  }
  host.append(stage);host.setAttribute('aria-busy','true');host.classList.add('luo-skeleton-active');
 }
 function syncSkeletons(){
  raf=0;
  if(app.dataset.screen==='auth'){
   for(const node of doc.querySelectorAll('.luo-skeleton-stage'))node.remove();
   for(const node of doc.querySelectorAll('.luo-skeleton-active')){node.classList.remove('luo-skeleton-active');node.removeAttribute('aria-busy')}
   return;
  }
  for(const [key,rule] of Object.entries(kinds)){
   const host=doc.querySelector(rule.host);if(!host)continue;
   ensureSkeleton(host,key,rule.type,rule.count,Boolean(rule.state()));
  }
 }
 const scheduleSkeleton=()=>{if(raf)return;raf=requestAnimationFrame(syncSkeletons)};
 function syncDialogs(root){
  if(root?.matches?.('dialog'))decorate(root);
  for(const el of root?.querySelectorAll?.('dialog')||[])decorate(el);
 }
 function start(){
  storyComposer();settings();syncDialogs(doc.body);scheduleSkeleton();
  domObserver=new MutationObserver(mutations=>{
   for(const rec of mutations)for(const added of rec.addedNodes){
    if(added.nodeType!==1)continue;
    if(added.matches?.('dialog')||added.querySelector?.('dialog'))syncDialogs(added);
   }
   scheduleSkeleton();
  });
  domObserver.observe(doc.body,{childList:true,subtree:true,characterData:true});
  app.addEventListener('click',e=>{
   if(e.target.closest('[data-tab="profile"]')&&!winSmall())backSettings(false);
  });
  doc.addEventListener('keydown',e=>{
   if(e.key!=='Escape'||!settingsDepth||!winSmall()||doc.querySelector('dialog[open]'))return;
   if(app.dataset.tab==='profile'){e.preventDefault();backSettings()}
  });
  window.addEventListener('pagehide',()=>{domObserver?.disconnect();settingsObserver?.disconnect();if(raf)cancelAnimationFrame(raf);raf=0},{once:true});
 }
 const api=window.LuoDeepPagesV3||{};api.backSettings=backSettings;api.syncSkeletons=syncSkeletons;if(!api.storyMode)api.storyMode=key=>{const dialog=$('storyComposer');if(dialog)dialog.dataset.luoPendingStoryMode=key};window.LuoDeepPagesV3=api;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
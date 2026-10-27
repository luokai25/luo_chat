// Luo Chat Messenger: Instagram-inspired DM ergonomics over the existing trusted chat handlers.
// Wallpapers are local, per-account/per-conversation settings. They contain no remote resources.
// Ten deliberately designed interactive scenes replace the old 100 pattern combinations.
// All backgrounds are generated locally, with no remote image loads.
export const WALLPAPER_SCENES=[
 ['Golden Orbit',39,12,78,'Radial light follows your finger'],
 ['Midnight Nebula',256,29,64,'Drifting violet galaxies'],
 ['Ocean Current',196,20,67,'Soft blue currents'],
 ['Emerald Canopy',155,21,66,'A luminous forest atmosphere'],
 ['Rose Lanterns',339,27,68,'Warm floating rose light'],
 ['Solar Eclipse',28,14,74,'Gold around a dark sun'],
 ['Aurora Veil',169,24,68,'Northern-light ribbons'],
 ['Starlit Desert',36,29,63,'Sand and distant constellations'],
 ['Royal Prism',275,27,70,'Amethyst light refractions'],
 ['Moonlit Clouds',219,16,64,'Calm moonlight in the clouds']
];
export function createChatWallpapers(){
 return WALLPAPER_SCENES.map(([name,hue,x,y,description],id)=>{
  const background=[
   'radial-gradient(circle at '+x+'% '+y+'%,hsla('+hue+',85%,72%,.34),transparent 36%)',
   'radial-gradient(ellipse at 84% 84%,hsla('+((hue+70)%360)+',67%,42%,.25),transparent 60%)',
   'repeating-radial-gradient(circle at 47% 58%,transparent 0 34px,#ffffff06 35px 36px)',
   'linear-gradient(145deg,#080a12,#16101e 57%,#0d0b12)'
  ].join(',');
  return {id,name,description,background,animated:true};
 });
}
export function installInstagramChats({win,db,getUser,getCurrent,getChats,openRoom}){
 const doc=win.document,app=doc.querySelector('.app'),room=doc.getElementById('room'),chats=doc.getElementById('chats'),messages=doc.getElementById('messages');
 if(!app||!room||!chats||!messages)return {onRoom(){},onTab(){},signedOut(){}};
 const wallpapers=createChatWallpapers(),byId=new Map(wallpapers.map(x=>[x.id,x]));
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const button=(label,act,cls)=>{const b=el('button',cls,label);b.type='button';b.addEventListener('click',act);return b};
 const options=el('dialog','luo-dm-settings');options.setAttribute('aria-label','Chat appearance and actions');app.append(options);
 const head=el('div','luo-dm-settings-head');head.append(el('h2','','Chat details'),button('✕',()=>options.close(),'luo-dm-dismiss'));options.append(head);
 const active=()=>getCurrent()?.id&&getUser()?.id;
 const storageKey=()=>active()?'luo-dm-theme-v1:'+getUser().id+':'+getCurrent().id:'';
 const preference=()=>{try{const p=JSON.parse(win.localStorage.getItem(storageKey())||'{}');return {theme:Number.isInteger(p.theme)&&byId.has(p.theme)?p.theme:0,motion:p.motion!==false}}catch{return {theme:0,motion:true}}};
 const save=p=>{try{win.localStorage.setItem(storageKey(),JSON.stringify(p))}catch{notice.textContent='Theme applied for this session. Browser storage is unavailable.'}};
 const notice=el('p','luo-dm-settings-note');notice.setAttribute('role','status');
 const profile=el('section','luo-dm-profile'),actions=el('div','luo-dm-quick-actions'),gallery=el('section','luo-dm-wallpapers');
 const wallpaperTitle=el('h3','','Interactive backgrounds · 10 original scenes'),filter=el('input','luo-dm-wallpaper-search');filter.type='search';filter.placeholder='Search wallpapers';filter.setAttribute('aria-label','Find a wallpaper');
 const grid=el('div','luo-dm-wallpaper-grid'),motion=el('label','luo-dm-motion'),toggle=el('input');toggle.type='checkbox';motion.append(toggle,el('span','','Animate subtle backgrounds'));const guidance=el('p','luo-dm-wallpaper-intro','Choose a living scene for this conversation. Movement follows your pointer, with reduced-motion support.');gallery.append(wallpaperTitle,guidance,filter,motion,grid);
 options.append(profile,actions,gallery,notice);
 const openExisting=id=>{options.close();doc.getElementById(id)?.click()};
 const shortcuts=[['⌕ Search','roomSearchToggle'],['▣ Media','openMedia'],['♧ Pins','openPins'],['♧ Personalize','openPersonalize'],['⋯ More','roomMenu']];
 for(const [label,id] of shortcuts){const b=button(label,()=>{if(id==='roomMenu'){options.close();doc.querySelector('#roomMenu summary')?.click()}else openExisting(id)},'luo-dm-action');actions.append(b)}
 const headerButton=button('Chat details',()=>{}, 'luo-dm-info');headerButton.setAttribute('aria-label','Open chat details and 10 interactive backgrounds');
 // Chat-details cannot become a competing top-layer modal over someone’s profile.
 const profileDialogOpen=()=>Boolean(doc.getElementById('personDialog')?.open||doc.getElementById('personPhotoDialog')?.open);
 headerButton.onclick=()=>{if(!active()||profileDialogOpen())return;fill();options.showModal()};
 const modalObserver=new win.MutationObserver(()=>{if(profileDialogOpen()&&options.open)options.close()});
 modalObserver.observe(doc.body,{subtree:true,attributes:true,attributeFilter:['open']});
 const roomHead=room.querySelector('.roomhead'),tools=room.querySelector('.roomtools');if(tools)tools.before(headerButton);else roomHead?.append(headerButton);
 function apply(theme,motionEnabled){
  const item=byId.get(theme)||wallpapers[0];
  room.style.setProperty('--luo-dm-wallpaper',item.background);
  room.dataset.luoTheme=String(item.id);
  room.classList.toggle('luo-dm-animated',motionEnabled&&item.animated&&!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  for(const choice of grid.querySelectorAll('.luo-dm-wallpaper'))choice.setAttribute('aria-pressed',String(choice.dataset.theme===String(item.id)));
 }
 function fill(){
  if(!active())return;
  const p=preference(),c=getCurrent();
  profile.replaceChildren(el('div','luo-dm-profile-icon',(c?.title||c?.person?.display_name||c?.person?.username||'L').charAt(0).toUpperCase()),el('div','luo-dm-profile-copy',c?.kind==='group'?(c?.title||'Group chat'):(c?.person?.display_name||c?.person?.username||'Direct messages')));
  notice.textContent='Themes are stored only on this device for the current account and chat.';
  toggle.checked=p.motion;
  filter.value='';renderGallery();apply(p.theme,p.motion);
 }
 function renderGallery(){
  const search=filter.value.trim().toLowerCase();const selected=active()?preference().theme:0;
  grid.replaceChildren();
  for(const item of wallpapers.filter(w=>w.name.toLowerCase().includes(search))){
   const b=button('',()=>{}, 'luo-dm-wallpaper');b.dataset.theme=String(item.id);b.setAttribute('aria-label',item.name);b.setAttribute('aria-pressed',String(item.id===selected));
   const art=el('span','luo-dm-wallpaper-art');art.style.background=item.background;
   b.append(art,el('span','luo-dm-wallpaper-name',item.name),el('small','luo-dm-wallpaper-caption',item.description));
   b.onclick=()=>{if(!active())return;const p=preference();p.theme=item.id;save(p);apply(p.theme,p.motion);notice.textContent=item.name+' applied to this conversation.'};
   grid.append(b);
  }
  if(!grid.children.length)grid.append(el('p','luo-dm-none','No matching wallpapers.'));
 }
 filter.oninput=renderGallery;
 toggle.onchange=()=>{if(!active())return;const p=preference();p.motion=toggle.checked;save(p);apply(p.theme,p.motion)};
 let lastRoom=null;
 const movement=event=>{if(event.pointerType==='touch'||event.pointerType==='pen')return;if(!room.classList.contains('luo-dm-animated'))return;const bounds=messages.getBoundingClientRect();if(!bounds.width||!bounds.height)return;const x=(event.clientX-bounds.left)/bounds.width,y=(event.clientY-bounds.top)/bounds.height;messages.style.setProperty('--luo-pointer-x',Math.max(0,Math.min(100,x*100)).toFixed(1)+'%');messages.style.setProperty('--luo-pointer-y',Math.max(0,Math.min(100,y*100)).toFixed(1)+'%')};
 messages.addEventListener('pointermove',movement,{passive:true});
 function onRoom(){
  if(!active()){lastRoom=null;room.style.removeProperty('--luo-dm-wallpaper');room.classList.remove('luo-dm-animated');delete room.dataset.luoTheme;messages.style.removeProperty('--luo-pointer-x');messages.style.removeProperty('--luo-pointer-y');return}
  const id=getUser().id+':'+getCurrent().id;if(lastRoom!==id){lastRoom=id;messages.style.removeProperty('--luo-pointer-x');messages.style.removeProperty('--luo-pointer-y');if(options.open)options.close()}
  const p=preference();apply(p.theme,p.motion);
 }
 const obs=new win.MutationObserver(()=>{if(app.dataset.screen==='room')onRoom()});
 obs.observe(app,{attributes:true,attributeFilter:['data-screen']});
 function onTab(tab){if(tab==='chats'){if(options.open)options.close()}if(app.dataset.screen==='room')onRoom()}
 function signedOut(){lastRoom=null;if(options.open)options.close();room.style.removeProperty('--luo-dm-wallpaper');room.classList.remove('luo-dm-animated');delete room.dataset.luoTheme;messages.style.removeProperty('--luo-pointer-x');messages.style.removeProperty('--luo-pointer-y')};
 return {onRoom,onTab,signedOut,wallpaperCount:wallpapers.length};
}

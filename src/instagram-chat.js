// Luo Chat Messenger: Instagram-inspired DM ergonomics over the existing trusted chat handlers.
// Wallpapers are local, per-account/per-conversation settings. They contain no remote resources.
export const WALLPAPER_FAMILIES=[
 ['Midnight','223','58','38'],['Aurora','181','72','45'],['Rose','342','74','48'],
 ['Nebula','267','78','51'],['Ocean','201','82','42'],['Emerald','151','66','40'],
 ['Sunset','19','89','51'],['Stardust','243','52','48'],['Royal','282','69','46'],['Amber','39','88','47']
];
export const WALLPAPER_PATTERNS=['Cosmos','Silk','Glass','Prism','Dream','Waves','Bloom','Halo','Comets','Eclipse'];
const clip=(n,min,max)=>Math.max(min,Math.min(max,n));
export function createChatWallpapers(){
 const list=[];
 for(let family=0;family<10;family++)for(let pattern=0;pattern<10;pattern++){
  const [name,hue,_,light]=WALLPAPER_FAMILIES[family],h=Number(hue),l=Number(light),s=70;
  const a='hsla('+((h+pattern*7)%360)+','+s+'%,'+clip(l+pattern%4*3,28,65)+'%,.34)';
  const b='hsla('+((h+58+pattern*13)%360)+',83%,50%,.19)';
  const c='hsla('+((h+158)%360)+',72%,55%,.12)';
  const x=10+pattern*8,y=12+(pattern*17)%77;
  const textures=[
   'radial-gradient(circle at 23% 18%,#fff6 1px,transparent 2px) 0 0/46px 52px,',
   'repeating-linear-gradient(114deg,transparent 0 29px,#ffffff09 31px 32px),',
   'linear-gradient(45deg,#ffffff08 25%,transparent 25% 75%,#ffffff08 75%) 0 0/37px 37px,',
   'conic-gradient(from '+(pattern*34)+'deg at 65% 38%,transparent,#ffffff09,transparent),',
   'repeating-radial-gradient(circle at 40% 70%,#ffffff0a 0 1px,transparent 3px 37px),',
   'repeating-linear-gradient(155deg,transparent 0 46px,#ffffff0e 47px,transparent 48px),',
   'radial-gradient(ellipse at 80% 75%,#ffffff1a,transparent 31%),',
   'radial-gradient(circle at 50% 60%,transparent 21%,#ffffff0c 22%,transparent 23%),',
   'repeating-linear-gradient(45deg,transparent 0 70px,#ffffff0c 71px 73px,transparent 74px),',
   'conic-gradient(from 180deg at 50% 30%,#ffffff0a,transparent 90deg,#ffffff0a,transparent 240deg),'
  ];
  const background=textures[pattern]+'radial-gradient(ellipse at '+x+'% '+y+'%,'+a+',transparent 62%),radial-gradient(circle at '+(100-x)+'% '+(100-y)+'%,'+b+',transparent 55%),linear-gradient(145deg,#08090f,'+c+' 49%,#0a090e)';
  list.push({id:family*10+pattern,name:name+' '+WALLPAPER_PATTERNS[pattern],background,animated:[0,3,4,5,7,8].includes(pattern)});
 }
 return list;
}
export function installInstagramChats({win,db,getUser,getCurrent,getChats,openRoom}){
 const doc=win.document,app=doc.querySelector('.app'),room=doc.getElementById('room'),chats=doc.getElementById('chats'),messages=doc.getElementById('messages');
 if(!app||!room||!chats||!messages)return {onRoom(){},onTab(){},signedOut(){}};
 const wallpapers=createChatWallpapers(),byId=new Map(wallpapers.map(x=>[x.id,x]));
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const button=(label,act,cls)=>{const b=el('button',cls,label);b.type='button';b.addEventListener('click',act);return b};
 const options=el('dialog','luo-dm-settings');options.setAttribute('aria-label','Chat appearance and actions');doc.body.append(options);
 const head=el('div','luo-dm-settings-head');head.append(el('h2','','Chat details'),button('✕',()=>options.close(),'luo-dm-dismiss'));options.append(head);
 const active=()=>getCurrent()?.id&&getUser()?.id;
 const storageKey=()=>active()?'luo-dm-theme-v1:'+getUser().id+':'+getCurrent().id:'';
 const preference=()=>{try{const p=JSON.parse(win.localStorage.getItem(storageKey())||'{}');return {theme:Number.isInteger(p.theme)&&byId.has(p.theme)?p.theme:0,motion:p.motion!==false}}catch{return {theme:0,motion:true}}};
 const save=p=>{try{win.localStorage.setItem(storageKey(),JSON.stringify(p))}catch{notice.textContent='Theme applied for this session. Browser storage is unavailable.'}};
 const notice=el('p','luo-dm-settings-note');notice.setAttribute('role','status');
 const profile=el('section','luo-dm-profile'),actions=el('div','luo-dm-quick-actions'),gallery=el('section','luo-dm-wallpapers');
 const wallpaperTitle=el('h3','','Chat wallpapers · 100 original looks'),filter=el('input','luo-dm-wallpaper-search');filter.type='search';filter.placeholder='Search wallpapers';filter.setAttribute('aria-label','Find a wallpaper');
 const grid=el('div','luo-dm-wallpaper-grid'),motion=el('label','luo-dm-motion'),toggle=el('input');toggle.type='checkbox';motion.append(toggle,el('span','','Animate subtle backgrounds'));gallery.append(wallpaperTitle,filter,motion,grid);
 options.append(profile,actions,gallery,notice);
 const openExisting=id=>{options.close();doc.getElementById(id)?.click()};
 const shortcuts=[['⌕ Search','roomSearchToggle'],['▣ Media','openMedia'],['♧ Pins','openPins'],['♧ Personalize','openPersonalize'],['⋯ More','roomMenu']];
 for(const [label,id] of shortcuts){const b=button(label,()=>{if(id==='roomMenu'){options.close();doc.querySelector('#roomMenu summary')?.click()}else openExisting(id)},'luo-dm-action');actions.append(b)}
 const headerButton=button('Chat details',()=>{}, 'luo-dm-info');headerButton.setAttribute('aria-label','Open chat details and 100 wallpapers');
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
   b.append(art,el('span','luo-dm-wallpaper-name',item.name));
   b.onclick=()=>{if(!active())return;const p=preference();p.theme=item.id;save(p);apply(p.theme,p.motion);notice.textContent=item.name+' applied to this conversation.'};
   grid.append(b);
  }
  if(!grid.children.length)grid.append(el('p','luo-dm-none','No matching wallpapers.'));
 }
 filter.oninput=renderGallery;
 toggle.onchange=()=>{if(!active())return;const p=preference();p.motion=toggle.checked;save(p);apply(p.theme,p.motion)};
 let lastRoom=null;
 function onRoom(){
  if(!active()){lastRoom=null;room.style.removeProperty('--luo-dm-wallpaper');return}
  const id=getCurrent().id;if(lastRoom!==id){lastRoom=id;if(options.open)options.close()}
  const p=preference();apply(p.theme,p.motion);
 }
 const obs=new win.MutationObserver(()=>{if(app.dataset.screen==='room')onRoom()});
 obs.observe(app,{attributes:true,attributeFilter:['data-screen']});
 function onTab(tab){if(tab==='chats'){if(options.open)options.close()}if(app.dataset.screen==='room')onRoom()}
 function signedOut(){lastRoom=null;if(options.open)options.close();room.style.removeProperty('--luo-dm-wallpaper')};
 return {onRoom,onTab,signedOut,wallpaperCount:wallpapers.length};
}

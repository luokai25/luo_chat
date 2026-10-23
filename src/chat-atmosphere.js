// Lightweight, opt-in-by-chat atmosphere. Never persists message content.
export function classifyMessageEffect(message) {
 if (!message || (message.message_type && message.message_type !== 'text')) return null;
 const value=String(message.body||'');
 if (/🎆|🎇|🎉|🎊|🎈/u.test(value)) return {kind:'fireworks',symbols:['✦','✧','✺','⋆']};
 if (/❤️|♥️|💛|🧡|💕|💖|💗|💓/u.test(value)) return {kind:'hearts',symbols:['♥','♡','♥']};
 if (/✨|⭐|🌟|💫|🌠/u.test(value)) return {kind:'stars',symbols:['✦','✧','⋆']};
 return null;
}
export function installChatAtmosphere({win,getUser,getRoom}) {
 const doc=win.document,room=doc.getElementById('room'),messages=doc.getElementById('messages'),menu=doc.querySelector('#roomMenu .room-menu-items');
 if(!room||!messages||!menu)return {onRoom(){},onMessage(){},signedOut(){}};
 const overlay=doc.createElement('div');overlay.className='luo-atmosphere-overlay';overlay.setAttribute('aria-hidden','true');room.append(overlay);
 const style=doc.createElement('style');style.dataset.luoAtmosphere='true';
 style.textContent=[
 '#room{position:relative}',
 '#messages.luo-reactive-wallpaper{background-image:radial-gradient(circle at var(--luo-glow-x,50%) var(--luo-glow-y,50%),rgba(221,177,94,.095),transparent 47%);}',
 '.luo-atmosphere-overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2;contain:paint}',
 '.luo-atmosphere-particle{position:absolute;left:var(--x);top:var(--y);font-size:var(--size);font-family:Georgia,serif;color:#f3c66f;text-shadow:0 0 9px rgba(246,183,82,.72);opacity:0;animation:luo-particle-float 1450ms ease-out forwards;will-change:transform,opacity}',
 '.luo-atmosphere-particle[data-kind="hearts"]{color:#e7ae72}',
 '.luo-atmosphere-particle[data-kind="fireworks"]{color:#ffe8a4}',
 '@keyframes luo-particle-float{0%{opacity:0;transform:translate(-50%,-20%) scale(.5) rotate(-12deg)}20%{opacity:.88}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-100% + var(--dy))) scale(1.3) rotate(var(--rot))}}',
 '@media(prefers-reduced-motion:reduce){.luo-atmosphere-overlay{display:none!important}.luo-reactive-wallpaper{background-image:none!important}}'
 ].join('\n');doc.head.append(style);
 const modes=['off','subtle','full'];let current=null,lastBurst=0,lastPointer=0,epoch=0;
 const button=doc.createElement('button');button.type='button';button.className='ghost luo-atmosphere-toggle';
 menu.append(button);
 const key=()=>{const actor=getUser()?.id,id=getRoom();return actor&&id?'luo-chat-effects:'+actor+':'+id:null};
 const preference=()=>{try{return win.localStorage.getItem(key())||'subtle'}catch{return 'subtle'}};
 const reduced=()=>!!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const saveData=()=>!!win.navigator?.connection?.saveData;
 const effective=()=>reduced()||saveData()?'off':modes.includes(current)?current:'subtle';
 function clear(){epoch++;overlay.replaceChildren()}
 function label(){button.textContent='Chat effects: '+(current==='off'?'Off':current==='full'?'Full':'Subtle');button.setAttribute('aria-label',button.textContent+'. Tap to change.');button.title='Animated messages and reactive wallpaper. Reduced motion and data saver always override.'}
 function onRoom(){clear();current=modes.includes(preference())?preference():'subtle';label();messages.classList.toggle('luo-reactive-wallpaper',effective()!=='off');}
 button.onclick=()=>{current=modes[(modes.indexOf(current)+1)%modes.length];const k=key();if(k)try{win.localStorage.setItem(k,current)}catch{};clear();label();messages.classList.toggle('luo-reactive-wallpaper',effective()!=='off')};
 const pointer=e=>{if(effective()==='off'||doc.visibilityState==='hidden'||!getRoom())return;const now=Date.now();if(now-lastPointer<80)return;lastPointer=now;const rect=messages.getBoundingClientRect();if(!rect.width||!rect.height)return;messages.style.setProperty('--luo-glow-x',Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100)).toFixed(1)+'%');messages.style.setProperty('--luo-glow-y',Math.max(0,Math.min(100,(e.clientY-rect.top)/rect.height*100)).toFixed(1)+'%')};
 messages.addEventListener('pointermove',pointer,{passive:true});
 function onMessage(message){
  const effect=classifyMessageEffect(message);
  if(!effect||!getUser()?.id||!getRoom()||message.conversation_id!==getRoom()||doc.visibilityState==='hidden'||effective()==='off'||!room.classList.contains('active'))return false;
  const now=Date.now();if(now-lastBurst<550)return false;lastBurst=now;
  clear();const seq=epoch,number=current==='full'?15:7;
  for(let i=0;i<number;i++){
   const spark=doc.createElement('span');spark.className='luo-atmosphere-particle';spark.dataset.kind=effect.kind;spark.textContent=effect.symbols[i%effect.symbols.length];
   const spread=(i*137.508)%360,angle=spread*Math.PI/180;
   const radius=45+(i%5)*20;
   spark.style.setProperty('--x',(35+(i*19)%33)+'%');
   spark.style.setProperty('--y',(48+(i*11)%32)+'%');
   spark.style.setProperty('--dx',Math.round(Math.cos(angle)*radius)+'px');
   spark.style.setProperty('--dy',Math.round(Math.sin(angle)*radius-90)+'px');
   spark.style.setProperty('--rot',((i%2)?'-':'')+(20+i*17)+'deg');
   spark.style.setProperty('--size',(13+i%4*3)+'px');
   overlay.append(spark);
  }
  win.setTimeout(()=>{if(seq===epoch)overlay.replaceChildren()},1550);
  return true;
 }
 const visibility=()=>{if(doc.visibilityState==='hidden')clear()};
 doc.addEventListener('visibilitychange',visibility);
 onRoom();
 return {onRoom,onMessage,signedOut(){clear();current='off';messages.classList.remove('luo-reactive-wallpaper');messages.style.removeProperty('--luo-glow-x');messages.style.removeProperty('--luo-glow-y');label()}};
}

// Compact 24-hour Notes ribbon on the Chats tab.
// All note visibility is decided by the authenticated luo_space feed RPC.
export function installChatNotesRibbon({win,db,getUser,openNotes}) {
 const doc=win.document,chatList=doc.getElementById('chatlist');
 if(!chatList)return {onTab(){},refresh(){},signedOut(){}};
 const mk=(tag,cls,txt)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
 const strip=mk('section','luo-chat-notes');
 strip.setAttribute('aria-label','Friends notes, available for 24 hours');
 const header=mk('div','luo-chat-notes-head'),title=mk('strong','','Notes'),add=mk('button','luo-chat-notes-add','+ Add note');
 add.type='button';add.setAttribute('aria-label','Write a 24-hour Luo Note');header.append(title,add);
 const rail=mk('div','luo-chat-notes-rail');rail.setAttribute('role','list');
 const notice=mk('p','luo-chat-notes-hint','Share a thought or a song for 24 hours.');
 strip.append(header,rail,notice);chatList.before(strip);
 const css=mk('style');css.textContent=[
 '.luo-chat-notes{padding:12px 13px 14px;margin:0 0 12px;border:1px solid #9f743d55;border-radius:16px;background:radial-gradient(circle at 95% 10%,#e2b35619,transparent 45%),linear-gradient(145deg,#1a1818,#141316);color:#f2ddad;min-width:0}',
 '.luo-chat-notes-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px}',
 '.luo-chat-notes-head strong{letter-spacing:.02em;font-size:14px;color:#eac27b}',
 '.luo-chat-notes-add{padding:7px 11px;border:1px solid #98794e;border-radius:30px;background:#2b2219;color:#ffe6b2;min-height:38px;cursor:pointer}',
 '.luo-chat-notes-rail{display:flex;gap:9px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:thin;padding:3px 2px}',
 '.luo-chat-notes-card{flex:none;width:126px;min-height:112px;scroll-snap-align:start;background:#28211f;border:1px solid #73562f;border-radius:15px;display:grid;grid-template-columns:34px 1fr;grid-template-rows:auto 1fr;align-items:start;text-align:left;gap:6px;padding:10px;color:#f7e0ad;cursor:pointer;box-sizing:border-box}',
 '.luo-chat-notes-avatar{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(140deg,#9b6930,#302218);border:1px solid #d8aa5e;color:#fff3d2;font-weight:800}',
 '.luo-chat-notes-name{font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:8px}',
 '.luo-chat-notes-text{font-size:12px;line-height:1.4;grid-column:1/-1;min-height:40px;max-height:52px;overflow:hidden;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}',
 '.luo-chat-notes-card:focus-visible,.luo-chat-notes-add:focus-visible{outline:2px solid #f9d98e;outline-offset:3px}',
 '.luo-chat-notes-hint{color:#bfa87e;font-size:11px;margin:8px 0 0}',
 '@media(prefers-reduced-motion:reduce){.luo-chat-notes-rail{scroll-behavior:auto}}'
 ].join('\n');doc.head.append(css);
 let seq=0,last=0,lastOwner=null,tab='chats';
 const current=()=>getUser()?.id||null;
 const available=row=>{if(row.kind&&row.kind!=='note')return false;const expiry=row.expires_at||row.expires;return !expiry||Number.isFinite(new Date(expiry).valueOf())&&new Date(expiry)>new Date()};
 const actorLabel=row=>String(row.author?.display_name||row.author?.username||'Friend').slice(0,60);
 function addCard(note) {
  const name=actorLabel(note),text=String(note.body||'').slice(0,120),card=mk('button','luo-chat-notes-card');card.type='button';card.setAttribute('role','listitem');card.setAttribute('aria-label',name+' shared a note: '+text+'. Open Notes.');
  const avatar=mk('span','luo-chat-notes-avatar',name.trim().charAt(0).toUpperCase()||'L');avatar.setAttribute('aria-hidden','true');
  const title=mk('span','luo-chat-notes-name',name),snippet=mk('span','luo-chat-notes-text',text||'Shared a new note');card.append(avatar,title,snippet);
  card.addEventListener('click',()=>{if(current())openNotes()});
  rail.append(card);
 }
 async function refresh(force=false) {
  const actor=current();if(!actor){seq++;rail.replaceChildren();strip.hidden=true;return}
  strip.hidden=false;
  if(!force&&actor===lastOwner&&Date.now()-last<30000)return;
  const ticket=++seq;lastOwner=actor;last=Date.now();
  notice.textContent='Checking your friends’ latest Notes…';
  try {
   const r=await db.rpc('luo_space',{action:'feed',input:{kind:'note'}});
   if(r.error)throw r.error;if(seq!==ticket||actor!==current()||tab!=='chats')return;
   const rows=Array.isArray(r.data)?r.data:[];
   const dedup=new Set();rail.replaceChildren();
   for(const item of rows){
    if(!available(item))continue;
    const key=item.author?.id||item.owner_id||item.id;
    if(dedup.has(key))continue;dedup.add(key);addCard(item);if(dedup.size>=20)break;
   }
   notice.textContent=dedup.size?'Tap a note to read and respond in Luo Social.':'No new Notes yet. Share a thought with your friends.';
  }catch(e){if(seq!==ticket||actor!==current())return;rail.replaceChildren();last=0;notice.textContent='Notes are temporarily unavailable. Your chats are unaffected.'}
 }
 add.onclick=()=>{if(current())openNotes()};
 function onTab(name){tab=name;if(name==='chats'){if(current())refresh().catch(()=>{});else signedOut()}else{seq++;last=0}}
 function signedOut(){seq++;last=0;lastOwner=null;rail.replaceChildren();strip.hidden=true;notice.textContent=''}
 strip.hidden=true;
 return {onTab,refresh,signedOut};
}

// Private Luonix cards in direct messages. Database visibility checked for EACH reader.
// Never send signed media URLs through messages, and never persist private content in this UI.
export function parseLuoShare(text){
 const match=/^Luo (Clip|Post)\n([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(text||'');
 return match?{kind:match[1].toLowerCase(),id:match[2].toLowerCase()}:null;
}
export function installReelMessagePreviews({win,container,getUser,db,openClip}){
 if(!container)return ()=>{};
 const doc=win.document,done=new WeakSet();let generation=0,disposed=false;
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 async function preview(body,share){
  const actor=getUser()?.id;
  if(!actor||!body.isConnected||disposed)return;
  const card=el('button','luo-reel-message-preview luo-share-rich');
  card.type='button';card.setAttribute('aria-label','Open shared Luo '+(share.kind==='clip'?'Luonix video':'post'));
  const label=el('span','luo-share-type',share.kind==='clip'?'▶ LUONIX':'▧ LUO POST'),title=el('strong','luo-share-title','Shared '+(share.kind==='clip'?'video':'post')),caption=el('span','luo-share-caption','Only people with permission can view this content.');
  card.append(label,title,caption);body.replaceChildren(card);
  card.onclick=()=>{if(!disposed&&getUser()?.id===actor)openClip?.(share.id)};
  if(!db)return;
  try{
   const response=await db.rpc('luo_space',{action:'entry.get',input:{id:share.id}});
   if(disposed||getUser()?.id!==actor||!card.isConnected)return;
   if(response.error||!response.data||response.data.published!==true||!['clip','post'].includes(response.data.kind))throw Error('Not accessible');
   const entry=response.data;title.textContent=entry.title||'@'+(entry.author?.username||'Luo')+' · '+(entry.kind==='clip'?'Luonix':'Post');
   caption.textContent=(entry.body||'Open to view this moment').slice(0,180);
   const media=Array.isArray(entry.media)?entry.media:[],first=media[0];
   if(first?.path&&entry.owner_id===String(first.path).split('/')[0]&&String(first.path).startsWith(entry.owner_id+'/'+entry.id+'/')&&!String(first.path).includes('..')){
    const signed=await db.storage.from('luo-social').createSignedUrl(first.path,240);
    if(disposed||getUser()?.id!==actor||!card.isConnected)return;
    if(!signed.error&&signed.data?.signedUrl){
     const container=el('div','luo-share-media'),src=signed.data.signedUrl;
     if(entry.kind==='clip'){
      const video=el('video');video.src=src;video.playsInline=true;video.muted=true;video.preload='metadata';video.setAttribute('aria-label','Luonix video preview');container.append(video);
     }else{
      const img=el('img');img.src=src;img.loading='lazy';img.alt='Shared post photo';container.append(img);
     }
     card.insertBefore(container,label);
    }
   }
  }catch{if(!disposed&&card.isConnected&&getUser()?.id===actor){title.textContent='Content unavailable';caption.textContent='This item is private, removed or no longer shared with you.';card.disabled=true;}}
 }
 function scan(){
  if(disposed)return;
  for(const body of container.querySelectorAll('.bubble-body')){
   if(done.has(body))continue;
   const shared=parseLuoShare(body.textContent);
   if(!shared)continue;
   done.add(body);void preview(body,shared);
  }
 }
 const observer=new win.MutationObserver(scan);observer.observe(container,{subtree:true,childList:true});
 scan();
 return ()=>{disposed=true;generation++;observer.disconnect()};
}

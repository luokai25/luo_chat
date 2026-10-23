// Shared playback sessions for media that members already uploaded to a chat.
// The existing luo_space RPC controls membership, visibility and host updates.
export function installSocialSessions({win,db,note,getUser,getChats}) {
 const doc=win.document;
 const el=(tag,text,css)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=text;if(css)node.className=css;return node};
 const button=(text,cb)=>{const node=el('button',text,'ghost');node.type='button';node.onclick=async()=>{if(node.disabled)return;node.disabled=true;try{await cb()}catch(e){if(getUser())note(e.message||'Could not complete this action.')}finally{node.disabled=false}};return node};
 const rpc=async(action,input)=>{const r=await db.rpc('luo_space',{action,input});if(r.error)throw Error(r.error.message);return r.data};
 let timer=null,currentVideo=null,sessionId=null,request=0;
 function stop(){request++;win.clearInterval(timer);timer=null;try{currentVideo?.pause()}catch{}currentVideo=null;sessionId=null}
 async function render(output) {
  stop();const actor=getUser()?.id,seq=request;if(!actor)return;
  const panel=el('section',null,'luo-social-card');panel.append(el('h3','Watch or listen together'),el('p','Start a synchronized session with an audio or video file already shared in a conversation. Media remains accessible only to that chat’s members.','muted'));
  const room=el('select',null,'field'),track=el('select',null,'field');
  for(const [v,title] of [['','Choose a conversation'],...(getChats()||[]).map(x=>[x.id,x.title||x.name||x.person?.display_name||'Conversation'])]){if(!v&&room.children.length)continue;const o=el('option',title);o.value=v;room.append(o)}
  const choice=el('select',null,'field');for(const [value,title]of [['watch','Watch video'],['listen','Listen to audio']]){const o=el('option',title);o.value=value;choice.append(o)}
  const label=(name,value)=>{const l=el('label',name,'luo-social-label');l.append(value);return l};
  const choose=async()=>{track.replaceChildren();const empty=el('option','Choose an uploaded file');empty.value='';track.append(empty);if(!room.value)return;const r=await db.from('chat_attachments').select('message_id,file_name,mime_type').eq('conversation_id',room.value).order('created_at',{ascending:false}).limit(60);if(r.error)throw Error(r.error.message);if(getUser()?.id!==actor||seq!==request||!panel.isConnected)return;for(const item of r.data||[]){if(!item.mime_type?.startsWith(choice.value==='watch'?'video/':'audio/'))continue;const o=el('option',item.file_name||'Shared '+choice.value);o.value=item.message_id;track.append(o)}};
  room.onchange=()=>choose().catch(e=>note(e.message));choice.onchange=()=>choose().catch(e=>note(e.message));
  panel.append(label('Conversation',room),label('Media type',choice),label('Shared file',track));
  panel.append(button('Start together',async()=>{if(!room.value||!track.value)throw Error('Choose a conversation and a shared audio/video file first.');const id=win.crypto.randomUUID();await rpc('entry.create',{id,kind:'session',audience:'room',room_id:room.value,data:{source_message:track.value,mode:choice.value}});if(getUser()?.id!==actor)return;await rpc('entry.publish',{id,media:[]});await render(output)}));
  output.append(panel);
  const collection=el('section',null,'luo-social-card');collection.append(el('h3','Shared sessions'));output.append(collection);
  const items=await rpc('feed',{kind:'session'});if(getUser()?.id!==actor||seq!==request)return;
  if(!items?.length)collection.append(el('p','No watch or listen sessions yet.','muted'));
  for(const session of items||[]){const card=el('article',null,'luo-social-session'),title=el('h4',session.data?.mode==='listen'?'Listen together':'Watch together');card.append(title,el('p',(session.author?.display_name||session.author?.username||'Friend')+' · shared media session','luo-social-meta'));const container=el('div',null,'luo-social-player');card.append(button('Join session',()=>join(session,container)),container);collection.append(card,el('hr'))}
 }
 async function join(session,container){
  stop();const actor=getUser()?.id,seq=request,id=session.id;
  const current=await rpc('entry.get',{id});if(getUser()?.id!==actor||seq!==request||!container.isConnected)return;
  const path=current.data?.path,mime=current.data?.mime;
  if(typeof path!=='string'||!path||!/^audio\/|^video\//.test(mime||''))throw Error('This session has no playable media.');
  const r=await db.storage.from('chat-media').createSignedUrl(path,1800);
  if(r.error)throw Error(r.error.message);
  if(getUser()?.id!==actor||seq!==request||!container.isConnected)return;
  const url=new URL(r.data.signedUrl,win.location.href);
  if(url.origin!==new URL('https://byjixqwpjvsgmqilmzbm.supabase.co').origin)throw Error('Unexpected media source.');
  sessionId=id;const media=el(mime.startsWith('video/')?'video':'audio');media.src=url.href;media.controls=true;media.preload='metadata';media.playsInline=true;media.className='luo-synced-player';
  const status=el('p','Connected. Press Enable playback to sync on this device.','muted'),controls=el('div',null,'luo-social-actions');
  container.replaceChildren(media,status,controls);currentVideo=media;
  let enabled=false,updating=false,latest=current;
  const apply=async()=>{if(!enabled||!media.isConnected||getUser()?.id!==actor||sessionId!==id)return;const s=latest.data||{},position=Number(s.position)||0,anchor=Date.parse(s.anchor)||Date.now(),expected=Math.max(0,position+(s.playing?Math.max(0,(Date.now()-anchor)/1000):0));if(Number.isFinite(media.duration)&&media.duration>0&&Math.abs(media.currentTime-Math.min(expected,media.duration))>1.5)media.currentTime=Math.min(expected,media.duration);if(s.playing){try{await media.play()}catch{status.textContent='Tap Play on your device to enable audio playback.'}}else media.pause();status.textContent=s.playing?'Playing together · synced to host':'Paused together'};
  controls.append(button('Enable playback',async()=>{enabled=true;await apply()}));
  if(current.owner_id===actor){controls.append(button('Play for everyone',async()=>change(true)),button('Pause for everyone',async()=>change(false)),button('Sync to this position',async()=>change(!media.paused)))}
  async function change(playing){const r=await rpc('session.control',{id,version:latest.data?.version,position:media.currentTime||0,playing});if(sessionId===id&&getUser()?.id===actor){latest=r;await apply()}}
  timer=win.setInterval(async()=>{if(updating||sessionId!==id||!media.isConnected||getUser()?.id!==actor){if(sessionId===id)stop();return}if(doc.visibilityState==='hidden')return;updating=true;try{const updated=await rpc('entry.get',{id});if(getUser()?.id===actor&&sessionId===id){latest=updated;await apply()}}catch(e){if(sessionId===id)status.textContent=e.message||'Connection interrupted. Trying again…'}finally{updating=false}},2500)
 }
 return {render,signedOut:stop,leave:stop};
}

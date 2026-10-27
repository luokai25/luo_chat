/* Luo Luonix media publisher V10. Real local previews, privacy choices, and server-backed publishing. */
export const LUONIX_MEDIA_RULES={maxFiles:6,maxTotalBytes:20*1024*1024,maxImageBytes:8*1024*1024,maxVideoBytes:20*1024*1024,types:{'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}};
export function validateLuonixMedia(files){
 const list=Array.from(files||[]),rule=LUONIX_MEDIA_RULES;
 if(list.length>rule.maxFiles)throw Error('Choose no more than 6 photos and videos.');
 let total=0;
 for(const file of list){
  const video=file.type?.startsWith('video/');
  if(!Object.prototype.hasOwnProperty.call(rule.types,file.type)||!Number.isFinite(file.size)||file.size<1||file.size>(video?rule.maxVideoBytes:rule.maxImageBytes))
   throw Error('Use JPG, PNG, WebP, MP4 or WebM. Images: 8 MB each; videos: 20 MB each.');
  total+=file.size;
 }
 if(total>rule.maxTotalBytes)throw Error('Media total must be 20 MB or less. Trim or remove large videos.');
 return list;
}
export function mountLuonixMediaPublisher({win,db,output,getUser,note,onPublished,onCancel,onAdvanced}){
 const doc=win.document,owner=getUser()?.id;let removed=false,stage='gallery',files=[],urls=[],selected=0,publishing=false,operation=null,duration=0;
 const valid=()=>!removed&&!!owner&&getUser()?.id===owner&&root.isConnected;
 const el=(tag,cls,value)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n};
 const btn=(text,fn,cls='')=>{const n=el('button',cls,text);n.type='button';n.addEventListener('click',fn);return n};
 const root=el('section','luonix-v10'),top=el('header','luonix-v10-head'),heading=el('h2','','New Luonix'),exit=btn('×',leave,'luonix-v10-close');
 exit.setAttribute('aria-label','Close Luonix composer');
 top.append(btn('‹',()=>navigate(stage==='audience'?'preview':stage==='preview'?'gallery':'exit'),'luonix-v10-back'),heading,exit);
 const state=el('p','luonix-v10-hint'),screens=el('div','luonix-v10-screens');
 const gallery=el('section','luonix-v10-screen luonix-v10-gallery'),preview=el('section','luonix-v10-screen luonix-v10-preview'),audiencePage=el('section','luonix-v10-screen luonix-v10-audience'),uploadPage=el('section','luonix-v10-screen luonix-v10-upload');
 screens.append(gallery,preview,audiencePage,uploadPage);
 const footer=el('footer','luonix-v10-footer'),back=btn('Back',()=>navigate(stage==='audience'?'preview':'gallery')),next=btn('Next',forward,'luonix-v10-next');
 const message=el('p','luonix-v10-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 footer.append(back,message,next);root.append(top,state,screens,footer);output.append(root);
 let addMode=false;
 const picker=el('input','luonix-v10-file');picker.type='file';picker.multiple=true;picker.accept='image/jpeg,image/png,image/webp,video/mp4,video/webm';picker.setAttribute('aria-label','Choose photos and videos from gallery');
 const choose=btn('Choose from gallery',()=>picker.click(),'luonix-v10-gallery-button');
 const camera=btn('Camera photo',()=>{
  picker.accept='image/*';picker.setAttribute('capture','environment');picker.click();
 },'luonix-v10-camera');
 const edit=btn('Advanced video editing',()=>{if(files.length&&!win.confirm('Open the video studio? This post selection will be discarded.'))return;onAdvanced?.()},'luonix-v10-advanced');
 gallery.append(el('h3','','Choose media'),el('p','','Select up to six photos and videos. They can appear together in one post.'),choose,camera,picker,edit);
 const selectedFiles=el('div','luonix-v10-selected');
 gallery.append(selectedFiles);
 const stageMedia=el('div','luonix-v10-stage'),thumbs=el('div','luonix-v10-thumbs');
 const controls=el('div','luonix-v10-media-controls'),left=btn('‹ Previous',()=>showMedia(selected-1)),right=btn('Next ›',()=>showMedia(selected+1)),remove=btn('Remove',removeCurrent);
 const addMore=btn('+ Add media',()=>{addMode=true;picker.click()},'luonix-v10-add');
 controls.append(left,right,remove,addMore);preview.append(stageMedia,thumbs,controls);
 const title=el('input','luonix-v10-title');title.placeholder='Add a title (optional)';title.maxLength=160;title.setAttribute('aria-label','Post title');
 const caption=el('textarea','luonix-v10-caption');caption.placeholder='Add a caption…';caption.maxLength=12000;caption.setAttribute('aria-label','Post caption');
 const count=el('small','luonix-v10-counter','0 / 12,000');caption.addEventListener('input',()=>count.textContent=caption.value.length.toLocaleString()+' / 12,000');
 preview.append(el('label','','Title'),title,el('label','','Caption'),caption,count);
 const audienceOptions=el('div','luonix-v10-audience-options');
 const choices=[['friends','Friends only','Only approved Luo Chat friends can see it'],['public','Public','Visible to everyone who can access public Luonix posts'],['private','Only me','Save it privately on your account']];
 let audience='friends';
 for(const [value,label,description] of choices){
  const item=btn('',()=>{audience=value;renderAudience()},'luonix-v10-audience-item');
  item.dataset.value=value;item.append(el('strong','',label),el('small','',description),el('span','luonix-v10-check','✓'));audienceOptions.append(item);
 }
 const review=el('p','luonix-v10-review'),approve=el('p','luonix-v10-warning','Audience is enforced by the server. Changing it later requires a separate authorized action.');
 audiencePage.append(el('h3','','Who can see this Luonix?'),audienceOptions,review,approve);
 const loading=el('div','luonix-v10-loading'),bar=el('progress','luonix-v10-progress'),uploadLabel=el('strong','luonix-v10-upload-label','Preparing media…');
 bar.max=1;bar.value=0;bar.setAttribute('aria-label','Files uploaded');bar.setAttribute('aria-valuetext','0 of 0 files uploaded');
 loading.append(uploadLabel,bar,el('small','','During each file upload, exact byte progress is unavailable. File completion is counted accurately.'));
 uploadPage.append(el('h3','','Publishing your Luonix'),loading);
 const size=bytes=>(bytes/1048576).toFixed(1)+' MB';
 const release=()=>{for(const u of urls)if(u)win.URL.revokeObjectURL?.(u);urls=[]};
 const clearMedia=()=>{stageMedia.querySelector('video')?.pause();stageMedia.replaceChildren();thumbs.replaceChildren()};
 const setInfo=text=>message.textContent=text||'';
 function renderSelected(){
  selectedFiles.replaceChildren();
  selectedFiles.append(el('p','',files.length+' of 6 selected · '+size(files.reduce((n,f)=>n+f.size,0))+' of 20 MB'));
  files.forEach((file,i)=>selectedFiles.append(btn((i+1)+'. '+file.name.slice(0,65)+' · '+size(file.size),()=>{selected=i;navigate('preview')},'luonix-v10-file-item')));
 }
 function showMedia(index){
  if(!files.length){clearMedia();return}
  selected=(index+files.length)%files.length;clearMedia();
  const file=files[selected],url=urls[selected];
  if(file.type.startsWith('image/')){
   const picture=el('img','');picture.src=url;picture.alt='Selected photo '+(selected+1)+' of '+files.length;
   stageMedia.append(picture);
  }else{
   const video=el('video','');video.src=url;video.controls=true;video.playsInline=true;video.preload='metadata';
   video.setAttribute('aria-label','Selected video '+(selected+1)+' of '+files.length);
   video.addEventListener('loadedmetadata',()=>{if(files.length===1&&selected===0&&Number.isFinite(video.duration))duration=video.duration});
   stageMedia.append(video);
  }
  for(let i=0;i<files.length;i++){
   const media=btn('',()=>showMedia(i),'luonix-v10-thumb');media.setAttribute('aria-label','View selected media '+(i+1));
   if(files[i].type.startsWith('image/')){const pic=el('img');pic.src=urls[i];pic.alt='';pic.setAttribute('aria-hidden','true');media.append(pic)}
   else media.append(el('span','', '▶'));
   media.setAttribute('aria-pressed',String(i===selected));thumbs.append(media);
  }
  left.disabled=right.disabled=files.length===1;
  state.textContent='Preview '+(selected+1)+' of '+files.length+' · '+file.name;
 }
 function updateFiles(values){
  const incoming=validateLuonixMedia(addMode?[...files,...Array.from(values||[])]:values);if(!incoming.length)return;
  if(publishing)return;
  release();files=incoming;urls=files.map(f=>win.URL.createObjectURL(f));selected=addMode?files.length-1:0;operation=null;duration=0;
  renderSelected();showMedia(0);setInfo('');navigate('preview');
 }
 picker.addEventListener('change',()=>{
  try{updateFiles(picker.files)}
  catch(e){setInfo(e.message||'Unsupported selection')}
  finally{addMode=false;picker.value='';picker.removeAttribute('capture');picker.accept='image/jpeg,image/png,image/webp,video/mp4,video/webm'}
 });
 function removeCurrent(){
  if(publishing||!files.length)return;
  const chosen=files.filter((_,i)=>i!==selected);
  release();files=chosen;urls=files.map(f=>win.URL.createObjectURL(f));selected=Math.min(selected,files.length-1);
  operation=null;renderSelected();
  if(!files.length)navigate('gallery');else showMedia(selected);
 }
 function renderAudience(){
  for(const item of audienceOptions.children)item.dataset.selected=String(item.dataset.value===audience);
  review.textContent=audience==='public'?'Public: anyone allowed to view public Luonix can see this post.':
   audience==='friends'?'Friends: only approved friends can see this post.':'Only me: this post is private to your account.';
 }
 function navigate(nextStage){
  if(publishing)return;
  if(nextStage==='exit')return leave();
  if(!['gallery','preview','audience','upload'].includes(nextStage))return;
  if(nextStage!=='gallery'&&!files.length){setInfo('Choose media first.');return}
  stage=nextStage;root.dataset.stage=stage;for(const panel of screens.children)panel.hidden=!panel.classList.contains('luonix-v10-'+stage);
  if(stage!=='preview')stageMedia.querySelector('video')?.pause();
  if(stage==='preview')showMedia(selected);
  if(stage==='audience')renderAudience();
  heading.textContent=stage==='gallery'?'New Luonix':stage==='preview'?'Preview your media':stage==='audience'?'Post audience':'Publishing';
  state.textContent=stage==='gallery'?'Choose photos, videos, or both.':
   stage==='preview'?'Swipe through each selected item. Tap a video to play.':
   stage==='audience'?'Choose who can see the finished post.':'Keep this screen open while media uploads.';
  back.hidden=stage==='gallery'||stage==='upload';next.textContent=stage==='gallery'?'Choose media':stage==='preview'?'Next · Audience':stage==='audience'?'Send · Publish':'Publishing…';
  next.disabled=stage==='upload';setInfo('');
 }
 async function forward(){
  if(stage==='gallery')return picker.click();
  if(stage==='preview')return navigate('audience');
  if(stage==='audience'||stage==='upload')return publish();
 }
 function leave(){
  if(publishing){setInfo('Publishing is in progress. Please keep this screen open.');return}
  if(files.length||caption.value.trim()||title.value.trim())if(!win.confirm('Discard this unfinished Luonix post?'))return;
  dispose();onCancel?.();
 }
 function dispose(){removed=true;clearMedia();release();files=[];root.remove()}
 async function rpc(action,input){
  const result=await db.rpc('luo_space',{action,input});
  if(result.error)throw Error(result.error.message);return result.data;
 }
 async function publish(){
  if(publishing||!valid())return;
  try{validateLuonixMedia(files)}catch(e){setInfo(e.message);return}
  if(!files.length&&!caption.value.trim()){setInfo('Choose photos or videos and add a caption.');return}
  const singleClip=files.length===1&&files[0].type.startsWith('video/');
  if(singleClip&&(!Number.isFinite(duration)||duration<=0||duration>90)){setInfo('Video clips need a readable duration of 90 seconds or less. Use Advanced video editing to trim longer clips.');return}
  if(win.navigator?.onLine===false){setInfo('You are offline. Reconnect and tap Send again. Your selection is still here.');return}
  if(audience==='public'&&!win.confirm('Make this Luonix visible publicly?'))return;
  publishing=true;stage='upload';root.dataset.stage='upload';for(const panel of screens.children)panel.hidden=panel!==uploadPage;
  next.disabled=true;exit.disabled=true;back.disabled=true;heading.textContent='Publishing';setInfo('');
  const ownerAtStart=owner;const originals=files.slice();
  const kind=files.length===1&&files[0].type.startsWith('video/')?'clip':'post';
  const identity=JSON.stringify([kind,title.value.trim(),caption.value.trim(),audience,files.map(f=>[f.name,f.size,f.lastModified,f.type])]);
  if(operation?.identity!==identity){
   operation={id:win.crypto.randomUUID(),identity,completed:new Map(),created:false,published:false,kind};
  }
  const tx=operation,done=tx.completed;bar.max=originals.length;bar.value=done.size;
  bar.setAttribute('aria-valuetext',done.size+' of '+originals.length+' files uploaded');
  const current=()=>valid()&&getUser()?.id===ownerAtStart;
  try{
   if(!tx.created){uploadLabel.textContent='Saving post securely…';await rpc('entry.create',{id:tx.id,kind:tx.kind,title:title.value.trim(),body:caption.value.trim(),audience});tx.created=true}
   if(!current())return;
   for(let i=0;i<originals.length;i++){
    if(done.has(i))continue;
    const file=originals[i],ext=LUONIX_MEDIA_RULES.types[file.type];
    const path=owner+'/'+tx.id+'/'+String(i)+'-'+tx.id+'.'+ext;
    uploadLabel.textContent='Uploading '+(i+1)+' of '+originals.length+' · '+file.name.slice(0,70);
    const storage=db.storage.from('luo-social');
    const result=await storage.upload(path,file,{upsert:false,contentType:file.type});
    if(!current())return;
    if(result.error){
     // A lost acknowledgement can leave a successful upload on the server.
     // Accept a retry only when the authorized object exists with the exact file size.
     let confirmed=false;
     if(typeof storage.info==='function'){
      try{const remote=await storage.info(path);if(!current())return;
       const size=Number(remote.data?.metadata?.size??remote.data?.size);
       confirmed=!remote.error&&Number.isFinite(size)&&size===file.size;
      }catch{}
     }
     if(!confirmed)throw Error('Upload interrupted at file '+(i+1)+'. Retry to continue. '+result.error.message);
    }
    done.set(i,{path});bar.value=done.size;bar.setAttribute('aria-valuetext',done.size+' of '+originals.length+' files uploaded');
   }
   if(!current())return;
   uploadLabel.textContent='Finalizing your post…';
   if(!tx.published){await rpc('entry.publish',{id:tx.id,media:originals.map((f,i)=>tx.kind==='clip'?{...done.get(i),duration}:done.get(i))});tx.published=true}
   if(!current())return;
   uploadLabel.textContent='Luonix published!';setInfo('Your post is now available to the selected audience.');
   dispose();await onPublished?.();
  }catch(e){if(current()){setInfo(e.message||'Could not publish. Retry without losing your selection.');uploadLabel.textContent='Upload interrupted · safe to retry'}}
  finally{
   publishing=false;
   if(current()&&root.isConnected){exit.disabled=false;back.disabled=false;next.disabled=false;next.textContent='Retry publishing'}
  }
 }
 renderAudience();renderSelected();navigate('gallery');
 return {dispose,getState:()=>({stage,files:files.length,audience,publishing,completed:operation?.completed.size||0})};
}

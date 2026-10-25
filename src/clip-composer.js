export function validateClipEdit({duration,start,end,speed=1}){
 if(![duration,start,end,speed].every(Number.isFinite)||duration<=0||start<0||end>duration+.02||end<=start||![.5,1,1.5,2].includes(speed)||(end-start)/speed>90)throw Error('Choose a valid clip of 0–90 seconds after speed adjustment.');
 return {start,end,speed,duration:(end-start)/speed};
}

// Real media capture/export. No server upload until the user chooses Publish.
export function mountClipComposer({win,output,getUser,db,note,onPublished}){
 const doc=win.document,owner=getUser()?.id;let disposed=false,revision=0,stream=null,recorder=null,timer=null,file=null,objectURL=null,duration=0,exporting=false;
 const valid=()=>!disposed&&getUser()?.id===owner&&root.isConnected;
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const root=el('section','luo-clip-composer'),header=el('header'),preview=el('video','luo-clip-preview'),status=el('p','luo-feed-feedback'),progress=el('progress','luo-clip-progress');progress.max=90;progress.value=0;progress.hidden=true;progress.setAttribute('aria-label','Recording duration');status.setAttribute('role','status');preview.controls=true;preview.playsInline=true;preview.muted=true;preview.preload='metadata';preview.setAttribute('aria-label','Clip preview');
 header.append(el('h2','','Create a Luo Reel'),el('p','','Record or import. Preview, trim and choose who can see it.'));root.append(header,preview,progress,status);output.append(root);
 const button=(title,fn)=>{const b=el('button','luo-clip-tool',title);b.type='button';b.onclick=async()=>{if(!valid()||b.disabled)return;b.disabled=true;try{await fn(b)}catch(e){if(valid())status.textContent=e.message||'Please retry.'}finally{if(valid())b.disabled=b.dataset.locked==='true'}};return b};
 function stopCamera(){if(timer)win.clearInterval(timer);timer=null;if(recorder?.state==='recording')recorder.stop();for(const track of stream?.getTracks()||[])track.stop();stream=null;preview.srcObject=null}
 function releaseURL(){if(objectURL)win.URL.revokeObjectURL(objectURL);objectURL=null}
 const choose=el('input');choose.type='file';choose.accept='video/mp4,video/webm';choose.setAttribute('aria-label','Import video');
 const tools=el('div','luo-clip-tools'),record=button('Record',startRecording),stop=button('Stop recording',()=>{if(recorder?.state==='recording')recorder.stop()}),camera=button('Open camera',async()=>{
  if(!win.navigator.mediaDevices?.getUserMedia||!win.MediaRecorder)throw Error('This browser cannot record video. Use Import video instead.');
  const ticket=++revision;stopCamera();file=null;send.disabled=true;edit.disabled=true;releaseURL();const acquired=await win.navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:1280}},audio:true});
  if(!valid()||ticket!==revision){acquired.getTracks().forEach(t=>t.stop());return}stream=acquired;preview.removeAttribute('src');preview.srcObject=stream;await preview.play();record.disabled=false;record.dataset.locked='false';status.textContent='Camera ready. Recording starts only when you tap Record.';
 });record.disabled=true;record.dataset.locked='true';stop.disabled=true;stop.dataset.locked='true';tools.append(choose,camera,record,stop);root.append(tools);
 const edit=el('fieldset','luo-clip-edit'),legend=el('legend','','Edit clip');edit.append(legend);const control=(title,node)=>{const label=el('label','',title);label.append(node);edit.append(label);return node};
 const start=el('input'),end=el('input'),speed=el('select');for(const n of [start,end]){n.type='number';n.min='0';n.step='.1'}start.value='0';end.value='0';start.setAttribute('aria-label','Trim start in seconds');end.setAttribute('aria-label','Trim end in seconds');control('Start (seconds)',start);control('End (seconds)',end);
 for(const value of [.5,1,1.5,2]){const option=el('option','',value+'×');option.value=String(value);option.selected=value===1;speed.append(option)}control('Playback / export speed',speed);
 const previewSelection=button('Preview selection',async()=>{const values=validateClipEdit({duration,start:Number(start.value),end:Number(end.value),speed:Number(speed.value)});preview.currentTime=values.start;preview.playbackRate=values.speed;preview.muted=false;await preview.play()});edit.append(previewSelection);preview.ontimeupdate=()=>{if(!exporting&&file&&preview.currentTime>=Number(end.value)&&Number(end.value)>Number(start.value))preview.pause()};
 const exportButton=button('Apply trim and speed',applyEdit);edit.append(exportButton);edit.disabled=true;root.append(edit);
 const publish=el('form','luo-clip-publish'),caption=el('textarea'),audience=el('select');caption.maxLength=12000;caption.placeholder='Write a caption…';caption.setAttribute('aria-label','Clip caption');audience.setAttribute('aria-label','Clip audience');for(const [value,title]of [['friends','Friends'],['public','Public'],['private','Only me']]){const option=el('option','',title);option.value=value;audience.append(option)}const send=el('button','primary','Publish Reel');send.type='submit';send.disabled=true;publish.append(caption,audience,send);root.append(publish);
 async function selectFile(selected){
  if(!selected||!['video/mp4','video/webm'].includes(selected.type)||selected.size<1||selected.size>50*1024*1024)throw Error('Choose MP4 or WebM, up to 50 MB.');
  const ticket=++revision;stopCamera();releaseURL();file=null;send.disabled=true;edit.disabled=true;objectURL=win.URL.createObjectURL(selected);preview.src=objectURL;
  await new Promise((resolve,reject)=>{const timeout=win.setTimeout(()=>reject(Error('Video metadata timed out.')),10000);preview.onloadedmetadata=()=>{win.clearTimeout(timeout);resolve()};preview.onerror=()=>{win.clearTimeout(timeout);reject(Error('This video format cannot be played here.'))}});
  if(!valid()||ticket!==revision)return;
  if(!Number.isFinite(preview.duration)){await new Promise((resolve,reject)=>{const timeout=win.setTimeout(()=>{preview.removeEventListener('timeupdate',check);reject(Error('This recording has no readable duration. Please import a finalized MP4 or WebM.'))},5000);const check=()=>{if(Number.isFinite(preview.duration)&&preview.duration>0){win.clearTimeout(timeout);preview.removeEventListener('timeupdate',check);preview.currentTime=0;resolve()}};preview.addEventListener('timeupdate',check);preview.currentTime=1e10})}
  if(!valid()||ticket!==revision)return;duration=preview.duration;if(!Number.isFinite(duration)||duration<=0)throw Error('Could not determine the video duration.');file=selected;start.value='0';end.value=String(Math.min(duration,90));speed.value='1';edit.disabled=false;send.disabled=duration>90;status.textContent=duration>90?'Trim to 90 seconds before publishing.':'Preview ready. Review the video and visibility before publishing.';
 }
 choose.onchange=()=>{if(exporting||recorder?.state==='recording'){status.textContent='Finish the current operation first.';return}selectFile(choose.files?.[0]).catch(e=>{if(valid())status.textContent=e.message})};
 async function startRecording(){
  if(!stream)throw Error('Open the camera first.');const mime=['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>win.MediaRecorder.isTypeSupported(t));if(!mime)throw Error('Recording is unsupported here. Import a video instead.');
  const chunks=[];let bytes=0;const ticket=revision;recorder=new win.MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000});const began=Date.now();record.disabled=true;record.dataset.locked='true';stop.disabled=false;stop.dataset.locked='false';camera.disabled=true;choose.disabled=true;
  recorder.ondataavailable=ev=>{if(ev.data.size){chunks.push(ev.data);bytes+=ev.data.size;if(bytes>50*1024*1024&&recorder.state==='recording')recorder.stop()}};
  recorder.onerror=()=>{if(valid())status.textContent='Recording failed. Import a video or try again.';stopCamera()};
  recorder.onstop=async()=>{if(timer)win.clearInterval(timer);timer=null;for(const track of stream?.getTracks()||[])track.stop();stream=null;preview.srcObject=null;if(!valid()||ticket!==revision)return;progress.hidden=true;camera.disabled=false;choose.disabled=false;stop.disabled=true;stop.dataset.locked='true';if(bytes>50*1024*1024){status.textContent='Recording exceeded 50 MB. Please record a shorter clip.';return}try{await selectFile(new win.File(chunks,'luo-recording.'+(mime.includes('mp4')?'mp4':'webm'),{type:mime.includes('mp4')?'video/mp4':'video/webm'}))}catch(e){if(valid())status.textContent=e.message}};
  recorder.start(250);progress.hidden=false;progress.value=0;timer=win.setInterval(()=>{if(!valid()){stopCamera();return}const seconds=Math.floor((Date.now()-began)/1000);progress.value=Math.min(seconds,90);status.textContent='Recording · '+seconds+' / 90 seconds';if(seconds>=90&&recorder.state==='recording')recorder.stop()},250);
 }
 async function applyEdit(){
  if(!file||exporting)return;const values=validateClipEdit({duration,start:Number(start.value),end:Number(end.value),speed:Number(speed.value)});
  if(!preview.captureStream||!win.MediaRecorder)throw Error('Trimming is not supported by this browser. You can still publish an unchanged video up to 90 seconds.');
  const mime=['video/webm;codecs=vp8,opus','video/webm'].find(t=>win.MediaRecorder.isTypeSupported(t));if(!mime)throw Error('This browser cannot export edited video.');
  exporting=true;edit.disabled=true;send.disabled=true;choose.disabled=true;camera.disabled=true;const ticket=revision;let captured=null,encoder=null,timeout=null,frame=null;
  try{
   preview.pause();preview.currentTime=values.start;preview.playbackRate=values.speed;preview.muted=true;await preview.play();captured=preview.captureStream();if(!captured.getVideoTracks().length)throw Error('The browser did not provide a video track for export.');
   const chunks=[];let bytes=0,tooLarge=false,completed=false;encoder=new win.MediaRecorder(captured,{mimeType:mime,videoBitsPerSecond:3000000});
   const result=new Promise((resolve,reject)=>{encoder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>50*1024*1024){tooLarge=true;if(encoder.state==='recording')encoder.stop()}}};encoder.onerror=()=>reject(Error('Video export failed.'));encoder.onstop=()=>tooLarge?reject(Error('Edited clip exceeds 50 MB.')):resolve(new win.File(chunks,'luo-edited.webm',{type:'video/webm'}))});
   encoder.start(200);status.textContent='Exporting your selection. Keep this screen open…';
   const check=()=>{if(!valid()||ticket!==revision||preview.currentTime>=values.end||preview.ended){completed=preview.currentTime>=values.end-.1||preview.ended;if(encoder.state==='recording')encoder.stop();return}frame=win.requestAnimationFrame(check)};frame=win.requestAnimationFrame(check);
   timeout=win.setTimeout(()=>{if(encoder.state==='recording')encoder.stop()},(values.duration+12)*1000);const rendered=await result;if(valid()&&!completed)throw Error('Export did not finish. Your original video is still available.');
   if(valid()&&ticket===revision){preview.pause();exporting=false;await selectFile(rendered);if(valid())status.textContent='Edited clip ready. Review it before publishing.'}
  }finally{if(timeout)win.clearTimeout(timeout);if(frame)win.cancelAnimationFrame(frame);if(encoder?.state==='recording')encoder.stop();captured?.getTracks().forEach(t=>t.stop());exporting=false;if(valid()){preview.pause();edit.disabled=!file;send.disabled=!file||duration>90;choose.disabled=false;camera.disabled=false}}
 }
 for(const control of [start,end,speed])control.onchange=()=>{send.disabled=true;status.textContent='Apply your trim and speed changes before publishing.'};
 let uploadOperation=null,uploadPath=null,uploaded=false,submitted=false;const call=async(action,input)=>{const r=await db.rpc('luo_space',{action,input});if(r.error)throw Error(r.error.message);return r.data};
 publish.onsubmit=async ev=>{ev.preventDefault();if(!valid()||send.disabled||!file||exporting)return;send.disabled=true;status.textContent='Publishing securely…';const snapshot=file,body=caption.value.trim(),visibility=audience.value,ticket=revision;try{
  if(duration>90||Number(start.value)!==0||Math.abs(Number(end.value)-duration)>.02||Number(speed.value)!==1)throw Error('Apply your trim and speed changes before publishing.');
  // A selected-file change resets this operation. Retries keep the same draft and object.
  const identity=[snapshot,body,visibility];if(!uploadOperation||uploadOperation.identity.some((x,i)=>x!==identity[i])){uploadOperation={id:win.crypto.randomUUID(),identity};uploadPath=owner+'/'+uploadOperation.id+'/'+win.crypto.randomUUID()+'.'+(file.type==='video/mp4'?'mp4':'webm');uploaded=false;submitted=false}
  await call('entry.create',{id:uploadOperation.id,kind:'clip',body,audience:visibility});if(!valid()||ticket!==revision)return;
  if(!uploaded){const r=await db.storage.from('luo-social').upload(uploadPath,file,{upsert:false,contentType:file.type});if(r.error){uploadPath=owner+'/'+uploadOperation.id+'/'+win.crypto.randomUUID()+'.'+(file.type==='video/mp4'?'mp4':'webm');throw Error('Upload failed. Your draft is retained; retry publishing.')}uploaded=true}if(!valid()||ticket!==revision)return;
  await call('entry.publish',{id:uploadOperation.id,media:[{path:uploadPath,duration}]});submitted=true;if(valid()&&ticket===revision){status.textContent='Reel published.';await onPublished()}
 }catch(e){if(valid()&&ticket===revision)status.textContent=e.message||'Publishing failed. Please retry.'}finally{if(valid())send.disabled=submitted||!file||duration>90}};
 return ()=>{disposed=true;revision++;stopCamera();preview.pause();preview.removeAttribute('src');preview.load();releaseURL();root.remove()};
}

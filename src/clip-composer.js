import {installClipTimeline} from './clip-timeline.js';
import {renderClipTimeline} from './clip-timeline-export.js';
import {installClipCamera} from './clip-camera.js';
export function validateClipEdit({duration,start,end,speed=1}){
 if(![duration,start,end,speed].every(Number.isFinite)||duration<=0||start<0||end>duration+.02||end<=start||![.5,1,1.5,2].includes(speed)||(end-start)/speed>90)throw Error('Choose a valid clip of 0–90 seconds after speed adjustment.');
 return {start,end,speed,duration:(end-start)/speed};
}

// Real media capture/export. No server upload until the user chooses Publish.
export function mountClipComposer({win,output,getUser,db,note,onPublished,onCancel,drafts}){
 const doc=win.document,owner=getUser()?.id;let cameraUI=null,timeline=null,timelineAbort=null;let disposed=false,revision=0,stream=null,recorder=null,timer=null,file=null,objectURL=null,duration=0,exporting=false,draftId=null,restoring=false,savingDraft=false,publishing=false;
 const valid=()=>!disposed&&getUser()?.id===owner&&root.isConnected;
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const root=el('section','luo-clip-composer'),header=el('header'),preview=el('video','luo-clip-preview'),status=el('p','luo-feed-feedback'),progress=el('progress','luo-clip-progress');progress.max=90;progress.value=0;progress.hidden=true;progress.setAttribute('aria-label','Recording duration');status.setAttribute('role','status');preview.controls=true;preview.playsInline=true;preview.muted=true;preview.preload='metadata';preview.setAttribute('aria-label','Clip preview');
 header.append(el('h2','','Create Luonix'),el('p','','A real three-step flow: select media, edit your video, and choose who can watch. Publishing requires your confirmation.'));const closeCreator=el('button','luonix-close','×');closeCreator.type='button';closeCreator.setAttribute('aria-label','Close Luonix creator');closeCreator.onclick=()=>{if((file||stream)&&!win.confirm('Discard this editing session? Save a device draft first if you want to keep it.'))return;onCancel?.()};header.append(closeCreator);root.append(header,preview,progress,status);output.append(root);
 const button=(title,fn)=>{const b=el('button','luo-clip-tool',title);b.type='button';b.onclick=async()=>{if(!valid()||b.disabled)return;b.disabled=true;try{await fn(b)}catch(e){if(valid())status.textContent=e.message||'Please retry.'}finally{if(valid())b.disabled=b.dataset.locked==='true'}};return b};
 function stopCamera(){if(timer)win.clearInterval(timer);timer=null;const encoder=recorder;recorder=null;if(encoder){encoder.ondataavailable=encoder.onstop=encoder.onerror=null;if(encoder.state!=='inactive')try{encoder.stop()}catch{}}cameraUI?.stop();for(const track of stream?.getTracks()||[])track.stop();stream=null;preview.srcObject=null}
 function releaseURL(){if(objectURL)win.URL.revokeObjectURL(objectURL);objectURL=null}
 const choose=el('input');choose.type='file';choose.accept='video/mp4,video/webm';choose.setAttribute('aria-label','Import video');
 const tools=el('div','luo-clip-tools'),record=button('Record',startRecording),stop=button('Stop recording',()=>{if(recorder?.state==='recording')recorder.stop()}),camera=button('Open camera',async()=>{
  if(savingDraft||publishing||restoring)throw Error('Finish the current operation first.');if(!win.navigator.mediaDevices?.getUserMedia||!win.MediaRecorder)throw Error('This browser cannot record video. Use Import video instead.');
  if(file&&!win.confirm('Replace the open clip with a new camera recording? Unsaved changes will be lost.'))return;const ticket=++revision;stopCamera();timeline?.clear();file=null;send.disabled=true;edit.disabled=true;releaseURL();status.textContent='Waiting for camera and microphone permission…';try{const acquired=await win.navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:1280},frameRate:{ideal:24,max:30}},audio:{echoCancellation:{ideal:true},noiseSuppression:{ideal:true},autoGainControl:{ideal:true}}});
  if(!valid()||ticket!==revision){acquired.getTracks().forEach(t=>t.stop());return}stream=acquired;preview.muted=true;preview.removeAttribute('src');preview.srcObject=stream;await preview.play();if(!valid()||ticket!==revision)return;await cameraUI.attach();if(!valid()||ticket!==revision)return;record.disabled=false;record.dataset.locked='false';status.textContent='Camera ready. Tap the gold shutter, or hold and slide up to lock recording.';}catch(error){if(valid()&&ticket===revision){stopCamera();record.disabled=true;record.dataset.locked='true';}throw error}
 });record.disabled=true;record.dataset.locked='true';stop.disabled=true;stop.dataset.locked='true';tools.append(choose,camera,record,stop);root.append(tools);
 const edit=el('fieldset','luo-clip-edit'),legend=el('legend','','Edit clip');edit.append(legend);const control=(title,node)=>{const label=el('label','',title);label.append(node);edit.append(label);return node};
 const start=el('input'),end=el('input'),speed=el('select');for(const n of [start,end]){n.type='number';n.min='0';n.step='.1'}start.value='0';end.value='0';start.setAttribute('aria-label','Trim start in seconds');end.setAttribute('aria-label','Trim end in seconds');control('Start (seconds)',start);control('End (seconds)',end);
 for(const value of [.5,1,1.5,2]){const option=el('option','',value+'×');option.value=String(value);option.selected=value===1;speed.append(option)}control('Playback / export speed',speed);
 const previewSelection=button('Preview selection',async()=>{const values=validateClipEdit({duration,...(timeline?.dirty?timeline.selectedRange:{start:Number(start.value),end:Number(end.value),speed:Number(speed.value)})});preview.currentTime=values.start;preview.playbackRate=values.speed;preview.muted=false;await preview.play()});edit.append(previewSelection);preview.ontimeupdate=()=>{if(!exporting&&file&&preview.currentTime>=(timeline?.dirty?timeline.selectedRange.end:Number(end.value))&&Number(end.value)>Number(start.value))preview.pause()};
 const exportButton=button('Apply trim and speed',applyEdit);edit.append(exportButton);edit.disabled=true;root.append(edit);
 const publish=el('form','luo-clip-publish'),caption=el('textarea'),audience=el('select');caption.maxLength=12000;caption.placeholder='Write a caption…';caption.setAttribute('aria-label','Clip caption');audience.setAttribute('aria-label','Clip audience');for(const [value,title]of [['friends','Friends'],['public','Public'],['private','Only me']]){const option=el('option','',title);option.value=value;audience.append(option)}const send=el('button','primary','Share Luonix');send.type='submit';send.disabled=true;
 const shareHeading=el('div','luonix-share-head');shareHeading.append(el('h3','','Share your Luonix'),el('p','','Write a caption, add #hashtags, choose your audience and review your video before sharing.'));
 const captionLabel=el('label','luonix-caption-label','Caption and hashtags');captionLabel.append(caption);
 const audienceLabel=el('label','luonix-audience-label','Who can view?');audienceLabel.append(audience);
 publish.append(shareHeading,captionLabel,audienceLabel,send);root.append(publish);
 const wizard=el('nav','luonix-publishing-steps');wizard.setAttribute('aria-label','Video publishing steps');
 const stepLinks={};
 for(const [step,title] of [['media','1 · Media'],['edit','2 · Edit'],['share','3 · Share']]){
  const b=el('button','luonix-step',title);b.type='button';b.dataset.step=step;
  b.onclick=()=>setPublishStep(step);wizard.append(b);stepLinks[step]=b;
 }
 header.after(wizard);
 const navActions=el('div','luonix-publish-actions');
 const back=el('button','luonix-back','‹ Back');back.type='button';
 const next=el('button','luonix-next','Next ›');next.type='button';
 const stepHint=el('p','luonix-step-hint','Choose a video or record with the camera.');
 navActions.append(back,stepHint,next);root.append(navActions);
 let publishStep='media';root.dataset.luonixStep=publishStep;
 function setPublishStep(nextStep){
  if(!valid())return;
  if(!['media','edit','share'].includes(nextStep))return;
  if(nextStep!=='media'&&!file){status.textContent='Import or record a video first.';return}
  if(nextStep==='share'&&(needsExport()||exporting||publishing||restoring||savingDraft)){status.textContent='Apply all timeline and speed edits before sharing.';return}
  if(root.classList.contains('luo-camera-live')||recorder?.state==='recording'){status.textContent='Finish recording before moving to the next step.';return}
  publishStep=nextStep;root.dataset.luonixStep=nextStep;
  for(const [key,btn] of Object.entries(stepLinks)){btn.setAttribute('aria-current',String(key===nextStep?'step':'false'));btn.disabled=key!=='media'&&!file;}
  back.hidden=nextStep==='media';next.hidden=nextStep==='share';
  next.textContent=nextStep==='media'?'Next: Edit ›':'Next: Share ›';
  stepHint.textContent=nextStep==='media'?'1 of 3 · Import or record a video':nextStep==='edit'?'2 of 3 · Edit and preview your video':'3 of 3 · Caption, audience and final review';
 }
 back.onclick=()=>setPublishStep(publishStep==='share'?'edit':'media');
 next.onclick=()=>setPublishStep(publishStep==='media'?'edit':'share');

 let draftList=null,saveDraft=null,expiry=null,draftRun=0;
 if(drafts){
  const panel=el('details','luo-clip-drafts'),summary=el('summary','','Luonix drafts on this device'),help=el('p','','Saved locally, not encrypted or synced. Cleared on sign-out; your browser may also remove them. Maximum 3 drafts / 100 MB.');draftList=el('div','luo-clip-draft-list');
  expiry=el('select');expiry.setAttribute('aria-label','Draft retention');for(const days of [7,30]){const option=el('option','',days+' days');option.value=String(days);expiry.append(option)}
  saveDraft=button('Save draft on this device',async()=>{if(timeline?.dirty)throw Error('Apply timeline edits before saving a device draft.');if(!file||exporting||recorder?.state==='recording'||restoring||publishing)throw Error('Import or finish a clip before saving a draft.');const ticket=revision,snapshot=file;savingDraft=true;send.disabled=true;lockComposer(true);try{const saved=await drafts.save({id:draftId,file:snapshot,name:snapshot.name,caption:caption.value,audience:audience.value,edit:{start:Number(start.value),end:Number(end.value),speed:Number(speed.value)},days:Number(expiry.value)});if(!valid()||ticket!==revision)return;draftId=saved.id;status.textContent='Draft saved on this device.';await refreshDrafts()}finally{savingDraft=false;if(valid()){lockComposer(false);send.disabled=submitted||needsExport()}}});
  const clear=button('Delete all saved drafts',async()=>{if(!win.confirm('Delete all saved Reel drafts for this account on this device? This cannot be undone.'))return;await drafts.clear();if(valid()){draftId=null;status.textContent='Saved drafts deleted. The current open clip is unchanged.';await refreshDrafts()}});
  panel.append(summary,help,draftList,button('Refresh drafts',refreshDrafts),clear);header.after(panel);const saveRow=el('div','luo-clip-draft-save');saveRow.append(expiry,saveDraft);publish.before(saveRow);refreshDrafts();
 }
 async function refreshDrafts(){if(!drafts||!valid())return;const run=++draftRun;try{const rows=await drafts.list();if(!valid()||run!==draftRun)return;draftList.replaceChildren();if(!rows.length)draftList.append(el('p','','No saved drafts.'));for(const row of rows){const card=el('article','luo-clip-draft-row'),title=el('strong','',row.caption?.slice(0,60)||row.name||'Luo Reel');card.append(title,el('small','',(row.size/1048576).toFixed(1)+' MB · expires '+new Date(row.until).toLocaleDateString()),button('Restore draft',async()=>{
    if(exporting||recorder?.state==='recording'||restoring||savingDraft||publishing)throw Error('Finish the current operation first.');if(file&&!win.confirm('Replace the open clip with this saved draft? Unsaved changes will be lost.'))return;
    const ticket=revision;restoring=true;lockComposer(true);try{const saved=await drafts.get(row.id);if(!valid()||ticket!==revision)return;if(!saved)throw Error('This draft expired or was deleted.');await selectFile(new win.File([saved.file],saved.name,{type:saved.file.type}));if(!valid())return;draftId=saved.key;caption.value=saved.caption;audience.value=saved.audience;expiry.value=saved.until-saved.updatedAt>8*86400000?'30':'7';
     try{validateClipEdit({duration,...saved.edit});start.value=String(saved.edit.start);end.value=String(saved.edit.end);speed.value=String(saved.edit.speed)}catch{}
     send.disabled=duration>90||Number(start.value)!==0||Math.abs(Number(end.value)-duration)>.02||Number(speed.value)!==1;status.textContent=send.disabled?'Draft restored. Apply your trim before publishing.':'Draft restored. Review before publishing.';
    }finally{restoring=false;if(valid())lockComposer(false)}
   }),button('Delete draft',async()=>{if(!win.confirm('Delete this saved draft? This cannot be undone.'))return;await drafts.remove(row.id);if(valid()){if(draftId===row.id)draftId=null;status.textContent='Saved draft deleted. The open clip is unchanged.';await refreshDrafts()}}));draftList.append(card)}}catch(e){if(valid()&&run===draftRun){draftList.replaceChildren(el('p','',e.message||'Draft storage unavailable.'));status.textContent='Device drafts unavailable. You can still record or import and publish without saving a draft.'}}}
 async function selectFile(selected){
  if(!selected||!['video/mp4','video/webm'].includes(selected.type)||selected.size<1||selected.size>50*1024*1024)throw Error('Choose MP4 or WebM, up to 50 MB.');
  const ticket=++revision;if(!restoring&&!exporting)draftId=null;stopCamera();timeline?.clear();releaseURL();file=null;send.disabled=true;edit.disabled=true;preview.pause();preview.playbackRate=1;objectURL=win.URL.createObjectURL(selected);preview.src=objectURL;
  await new Promise((resolve,reject)=>{const timeout=win.setTimeout(()=>reject(Error('Video metadata timed out.')),10000);preview.onloadedmetadata=()=>{win.clearTimeout(timeout);resolve()};preview.onerror=()=>{win.clearTimeout(timeout);reject(Error('This video format cannot be played here.'))}});
  if(!valid()||ticket!==revision)return;
  if(!Number.isFinite(preview.duration)){await new Promise((resolve,reject)=>{const timeout=win.setTimeout(()=>{preview.removeEventListener('timeupdate',check);reject(Error('This recording has no readable duration. Please import a finalized MP4 or WebM.'))},5000);const check=()=>{if(Number.isFinite(preview.duration)&&preview.duration>0){win.clearTimeout(timeout);preview.removeEventListener('timeupdate',check);preview.currentTime=0;resolve()}};preview.addEventListener('timeupdate',check);preview.currentTime=1e10})}
  if(!valid()||ticket!==revision)return;duration=preview.duration;if(!Number.isFinite(duration)||duration<=0)throw Error('Could not determine the video duration.');file=selected;start.value='0';end.value=String(Math.min(duration,90));speed.value='1';timeline?.load(duration);for(const input of [start,end,speed])input.disabled=false;exportButton.textContent='Apply trim and speed';edit.disabled=false;send.disabled=duration>90;status.textContent=duration>90?'Trim to 90 seconds before publishing.':'Preview ready. Review the video and visibility before publishing.';
 }
 function lockComposer(value){choose.disabled=camera.disabled=caption.disabled=audience.disabled=value;edit.disabled=value||!file;if(expiry)expiry.disabled=value}
 choose.onchange=()=>{if(exporting||recorder?.state==='recording'||restoring||savingDraft||publishing){status.textContent='Finish the current operation first.';return}selectFile(choose.files?.[0]).then(()=>{if(valid()&&file)setPublishStep('edit')}).catch(e=>{if(valid())status.textContent=e.message})};
 async function startRecording(){
  if(!stream)throw Error('Open the camera first.');if(recorder)throw Error('Wait for the previous recording to finish.');const mime=['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>win.MediaRecorder.isTypeSupported(t));if(!mime)throw Error('Recording is unsupported here. Import a video instead.');
  const chunks=[];let bytes=0;const ticket=revision,source=stream,output=cameraUI?.recordingStream()||source,encoder=new win.MediaRecorder(output,{mimeType:mime,videoBitsPerSecond:3000000});recorder=encoder;const began=win.performance.now();record.disabled=true;record.dataset.locked='true';stop.disabled=false;stop.dataset.locked='false';camera.disabled=true;choose.disabled=true;
  encoder.ondataavailable=ev=>{if(!valid()||ticket!==revision||recorder!==encoder)return;if(ev.data.size){chunks.push(ev.data);bytes+=ev.data.size;if(bytes>50*1024*1024&&encoder.state==='recording')encoder.stop()}};
  encoder.onerror=()=>{if(valid()&&ticket===revision&&recorder===encoder){stopCamera();camera.disabled=choose.disabled=false;progress.hidden=true;status.textContent='Recording failed. Import a video or try again.';}};
  encoder.onstop=async()=>{if(!valid()||ticket!==revision||recorder!==encoder){source.getTracks().forEach(track=>track.stop());return}if(timer)win.clearInterval(timer);timer=null;recorder=null;cameraUI?.stop();source.getTracks().forEach(track=>track.stop());if(stream===source)stream=null;preview.srcObject=null;progress.hidden=true;camera.disabled=false;choose.disabled=false;stop.disabled=true;stop.dataset.locked='true';if(bytes>50*1024*1024){status.textContent='Recording exceeded 50 MB. Please record a shorter clip.';return}try{await selectFile(new win.File(chunks,'luo-recording.'+(mime.includes('mp4')?'mp4':'webm'),{type:mime.includes('mp4')?'video/mp4':'video/webm'}))}catch(e){if(valid())status.textContent=e.message}};
  try{encoder.start(250)}catch{encoder.ondataavailable=encoder.onstop=encoder.onerror=null;recorder=null;record.disabled=false;record.dataset.locked='false';stop.disabled=true;stop.dataset.locked='true';camera.disabled=choose.disabled=false;cameraUI?.refresh();throw Error('Recording could not start. Try again or import a video.')}progress.hidden=false;progress.value=0;cameraUI?.refresh();timer=win.setInterval(()=>{if(ticket!==revision||recorder!==encoder)return;if(!valid()){stopCamera();return}const seconds=Math.floor((win.performance.now()-began)/1000);progress.value=Math.min(seconds,90);const text='Recording · '+seconds+' / 90 seconds';if(status.textContent!==text)status.textContent=text;cameraUI?.progress(seconds);if(seconds>=90&&encoder.state==='recording')encoder.stop()},250);
 }
 async function applyEdit(){
  if(timeline?.dirty)return applyTimeline();
  if(!file||exporting)return;if(savingDraft||publishing||restoring)throw Error('Finish the current operation first.');const values=validateClipEdit({duration,start:Number(start.value),end:Number(end.value),speed:Number(speed.value)});
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
   if(valid()&&ticket===revision){preview.pause();await selectFile(rendered);exporting=false;if(valid())status.textContent='Edited clip ready. Review it before publishing.'}
  }finally{if(timeout)win.clearTimeout(timeout);if(frame)win.cancelAnimationFrame(frame);if(encoder?.state==='recording')encoder.stop();captured?.getTracks().forEach(t=>t.stop());exporting=false;if(valid()){preview.pause();edit.disabled=!file;send.disabled=needsExport();choose.disabled=false;camera.disabled=false}}
 }
 function needsExport(){return !!timeline?.dirty||!file||duration>90||Number(start.value)!==0||Math.abs(Number(end.value)-duration)>.02||Number(speed.value)!==1}
 for(const control of [start,end,speed])control.onchange=()=>{send.disabled=exporting||restoring||needsExport();status.textContent=needsExport()?'Apply your trim and speed changes before publishing.':'Original clip ready. Review before publishing.'};
 let uploadOperation=null,uploadPath=null,uploaded=false,submitted=false;const call=async(action,input)=>{const r=await db.rpc('luo_space',{action,input});if(r.error)throw Error(r.error.message);return r.data};
 publish.onsubmit=async ev=>{ev.preventDefault();if(!valid()||send.disabled||!file||exporting||savingDraft||restoring||publishing)return;publishing=true;send.disabled=true;lockComposer(true);status.textContent='Publishing securely…';const snapshot=file,body=caption.value.trim(),visibility=audience.value,ticket=revision;try{
  if(timeline?.dirty||duration>90||Number(start.value)!==0||Math.abs(Number(end.value)-duration)>.02||Number(speed.value)!==1)throw Error('Apply your trim and speed changes before publishing.');
  // A selected-file change resets this operation. Retries keep the same draft and object.
  const identity=[snapshot,body,visibility];if(!uploadOperation||uploadOperation.identity.some((x,i)=>x!==identity[i])){uploadOperation={id:win.crypto.randomUUID(),identity};uploadPath=owner+'/'+uploadOperation.id+'/'+win.crypto.randomUUID()+'.'+(file.type==='video/mp4'?'mp4':'webm');uploaded=false;submitted=false}
  await call('entry.create',{id:uploadOperation.id,kind:'clip',body,audience:visibility});if(!valid()||ticket!==revision)return;
  if(!uploaded){const r=await db.storage.from('luo-social').upload(uploadPath,file,{upsert:false,contentType:file.type});if(r.error){uploadPath=owner+'/'+uploadOperation.id+'/'+win.crypto.randomUUID()+'.'+(file.type==='video/mp4'?'mp4':'webm');throw Error('Upload failed. Your draft is retained; retry publishing.')}uploaded=true}if(!valid()||ticket!==revision)return;
  await call('entry.publish',{id:uploadOperation.id,media:[{path:uploadPath,duration}]});submitted=true;if(valid()&&ticket===revision){if(drafts&&draftId){try{await drafts.remove(draftId)}catch{if(valid()&&ticket===revision)note?.('Luonix published. Its saved device draft could not be removed; delete it from Drafts.')}}if(valid()&&ticket===revision){status.textContent='Luonix published.';await onPublished()}}
 }catch(e){if(valid()&&ticket===revision)status.textContent=e.message||'Publishing failed. Please retry.'}finally{publishing=false;if(valid()){lockComposer(false);send.disabled=submitted||needsExport()}}};
 const cancelTimeline=button('Cancel timeline export',()=>timelineAbort?.abort());cancelTimeline.classList.add('luo-timeline-cancel');cancelTimeline.hidden=true;edit.after(cancelTimeline);
 timeline=installClipTimeline({win,edit,preview,isCurrent:valid,isLocked:()=>exporting||savingDraft||restoring||publishing||!!recorder,onStatus:message=>status.textContent=message,onChange:dirty=>{for(const input of [start,end,speed])input.disabled=dirty;exportButton.textContent=dirty?'Apply timeline edits':'Apply trim and speed';send.disabled=needsExport();status.textContent=dirty?'Timeline changed. Apply edits before publishing or saving a draft.':'Timeline restored. Review your video.';}});
 async function applyTimeline(){
  if(!file||exporting||savingDraft||restoring||publishing)return;const ticket=revision,snapshot=file,segments=timeline.segments;exporting=true;send.disabled=true;lockComposer(true);preview.pause();timelineAbort=new win.AbortController();cancelTimeline.hidden=false;const controller=timelineAbort;status.textContent='Exporting timeline. Keep this screen open…';
  try{const rendered=await renderClipTimeline({win,file:snapshot,duration,segments,isCurrent:()=>valid()&&ticket===revision,signal:controller.signal,onProgress:p=>{if(valid()&&ticket===revision){const text='Exporting segment '+p.segment+' / '+p.count+' · '+Math.floor(p.seconds)+' / '+Math.ceil(p.total)+'s';if(status.textContent!==text)status.textContent=text;}}});if(!valid()||ticket!==revision)return;await selectFile(rendered);if(valid())status.textContent='Timeline export ready. Review the assembled video before publishing.';}
  finally{if(timelineAbort===controller)timelineAbort=null;exporting=false;if(valid()){cancelTimeline.hidden=true;lockComposer(false);send.disabled=submitted||needsExport();}}
 }
 cameraUI=installClipCamera({win,root,preview,status,getStream:()=>stream,isCurrent:valid,getRecorder:()=>recorder,onRecord:startRecording,onStop:()=>{if(recorder?.state==='recording')recorder.stop()},onCancel:()=>{revision++;stopCamera();progress.hidden=true;camera.disabled=choose.disabled=false;record.disabled=true;record.dataset.locked='true';status.textContent='Camera closed. Nothing was uploaded.';},onReplaceCamera:async replacement=>{if(!replacement||!stream)throw Error('Camera unavailable.');const previous=stream.getVideoTracks()[0];if(previous){stream.removeTrack(previous);previous.stop()}stream.addTrack(replacement)}});
 setPublishStep('media');
 return ()=>{disposed=true;revision++;timelineAbort?.abort();stopCamera();cameraUI.dispose();timeline.dispose();preview.pause();preview.removeAttribute('src');preview.load();releaseURL();root.remove()};
}

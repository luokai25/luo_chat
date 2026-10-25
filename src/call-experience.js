import {CALL_AR_EFFECTS} from './call-ar-effects.js';
import {CALL_EFFECTS,createCallEffects} from './call-effects.js';
import {createCallScreenShare} from './call-screen-share.js';
import {installCallShell} from './call-shell.js';
import {installCallLensBrowser} from './call-lens-browser.js';

// No media permissions on installation. All actions remain inside the live call dialog.
export function installCallExperience({win,dialog,$,note,onEnd}){
 const doc=win.document,actions=dialog.querySelector('.device-actions');
 dialog.classList.add('luo-live-call');
 const controls=doc.createElement('div');controls.className='luo-call-tools';
 controls.innerHTML='<button type="button" id="callEffectsToggle" aria-controls="callEffectsSheet" aria-expanded="false">✧ Effects</button><button type="button" id="callAudioOutput">Audio output</button><button type="button" id="callHold" aria-pressed="false">Hold</button><button type="button" id="callFit" aria-pressed="false">Fill screen</button>';
 actions.before(controls);
 const playback=doc.createElement('button');playback.id='callPlayback';playback.type='button';playback.textContent='Play call audio';playback.hidden=true;controls.append(playback);$('callRemote').controls=false;
 playback.onclick=async()=>{if(!alive())return;const seq=revision;try{await $('callRemote').play();if(seq===revision&&alive())playback.hidden=true}catch{if(seq===revision&&alive())note('Tap Play call audio again, or check your browser sound permissions.')}};
 const network=doc.createElement('p');network.id='callNetwork';network.hidden=true;controls.before(network);
 const shareButton=doc.createElement('button');shareButton.type='button';shareButton.id='callShareScreen';shareButton.textContent='Share screen';shareButton.title='The selected screen is visible to the other participant. Stop sharing returns to your camera, preserving camera-off and mute choices.';controls.append(shareButton);
 const shareStatus=doc.createElement('p');shareStatus.id='callShareStatus';shareStatus.setAttribute('role','status');shareStatus.hidden=true;network.before(shareStatus);
 const sheet=doc.createElement('section');sheet.id='callEffectsSheet';sheet.hidden=true;sheet.setAttribute('aria-label','Live video effects');
 const heading=doc.createElement('div');heading.className='luo-effects-heading';
 const title=doc.createElement('strong');title.textContent='Live effects';
 const close=doc.createElement('button');close.type='button';close.textContent='Close effects';heading.append(title,close);
 const rail=doc.createElement('div');rail.className='luo-effects-carousel';rail.setAttribute('role','group');rail.setAttribute('aria-label','Choose an AR lens or live color effect');
 for(const effect of [...CALL_EFFECTS,...CALL_AR_EFFECTS]){const button=doc.createElement('button');button.type='button';button.dataset.effect=effect.id;button.textContent=effect.label;button.setAttribute('aria-pressed',String(effect.id==='original'));rail.append(button)}
 const hint=doc.createElement('p');hint.textContent='Face-tracked masks are drawn locally and sent in the video call. Selecting an AR lens downloads the tracking model on demand; no face data is uploaded. Original restores raw camera quality. These are Luo-designed filters, not official Snapchat or Instagram lenses.';
 sheet.append(heading,rail,hint);dialog.append(sheet);
 let current=null,engine=null,sharing=null,held=false,cameraSwitch=false,outputBusy=false,revision=0;
 const alive=()=>current?.isCurrent()===true;
 function hide(){sheet.hidden=true;lenses.stop();sheet.style.transform='';sheetDrag=null;$('callEffectsToggle').setAttribute('aria-expanded','false');}
 function selectState(){for(const button of rail.children)button.setAttribute('aria-pressed',String(button.dataset.effect===(engine?.effect||'original')));}
 function busy(value){const shareBusy=sharing?.busy||sharing?.active,locked=value||cameraSwitch;for(const button of rail.children)button.disabled=locked||shareBusy;$('switchCallCamera').disabled=locked||shareBusy;$('callEffectsToggle').disabled=locked||shareBusy;shareButton.disabled=locked||!!sharing?.busy||(!sharing?.active&&current?.peer?.connectionState!=='connected');}
 function syncEnabled(){if(!alive())return;const stream=current.getStream(),muted=$('muteCall').getAttribute('aria-pressed')==='true',cameraOff=$('cameraCall').getAttribute('aria-pressed')==='true';stream.getAudioTracks().forEach(t=>t.enabled=!held&&!muted);const enabled=!held&&!cameraOff;stream.getVideoTracks().forEach(t=>t.enabled=enabled&&!sharing?.active);engine?.setEnabled(enabled&&!sharing?.active);sharing?.setEnabled(enabled);const outgoing=current.peer.getSenders().find(sender=>sender.track?.kind==='video')?.track;shell.mediaState({video:enabled&&!!outgoing&&outgoing.enabled!==false&&outgoing.readyState!=='ended',held});$('muteCall').setAttribute('aria-label',muted?'Unmute microphone':'Mute microphone');const label=sharing?.active?(cameraOff?'Resume shared video':'Pause shared video'):(cameraOff?'Turn camera on':'Turn camera off');if($('cameraCall').getAttribute('aria-label')!==label){$('cameraCall').textContent=label;$('cameraCall').setAttribute('aria-label',label)}if(sharing?.active&&!sharing.busy&&!sharing.failed)shareStatus.textContent=enabled?'Sharing screen · your selected screen is visible to the other person.':'Screen sharing paused · resume video or leave Hold to continue.';}
 $('callEffectsToggle').onclick=()=>{if(!alive()||!engine||sharing?.active||sharing?.busy)return;shell.effectsOpened();sheet.hidden=!sheet.hidden;$('callEffectsToggle').setAttribute('aria-expanded',String(!sheet.hidden));if(!sheet.hidden){rail.querySelector('[aria-pressed="true"]')?.focus();void lenses.open()}else lenses.stop()};
 close.onclick=()=>{hide();$('callEffectsToggle').focus()};
 sheet.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.click()}if(['ArrowLeft','ArrowRight'].includes(event.key)){const buttons=[...rail.children],index=buttons.indexOf(doc.activeElement);if(index>=0){event.preventDefault();buttons[(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length].focus()}}});
 let sheetDrag=null;
 heading.addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;sheetDrag={id:event.pointerId,y:event.clientY};heading.setPointerCapture?.(event.pointerId)});
 heading.addEventListener('pointermove',event=>{if(sheetDrag?.id===event.pointerId){const dy=Math.max(0,event.clientY-sheetDrag.y);sheet.style.transform='translateY('+Math.min(120,dy)+'px)'}});
 heading.addEventListener('pointerup',event=>{if(sheetDrag?.id===event.pointerId){const dismiss=event.clientY-sheetDrag.y>60;sheetDrag=null;sheet.style.transform='';if(dismiss)close.click()}});
 heading.addEventListener('pointercancel',()=>{sheetDrag=null;sheet.style.transform=''});
 rail.onclick=async event=>{
  const button=event.target.closest('[data-effect]');if(!button||!alive()||!engine||engine.busy||sharing?.active||sharing?.busy||$('switchCallCamera').disabled)return;
  const seq=revision,activeEngine=engine;busy(true);
  try{if(await activeEngine.select(button.dataset.effect)&&seq===revision){syncEnabled();selectState();lenses.selected()}}
  catch(error){if(seq===revision){syncEnabled();$('callStatus').textContent='Could not apply this effect. Previous video source retained.';note(error.message)}}finally{if(seq===revision)busy(false)}
 };
 shareButton.onclick=async()=>{
  if(!alive()||!sharing||sharing.busy||engine?.busy)return;
  if(!sharing.active&&(current.peer.connectionState!=='connected'||$('switchCallCamera').disabled))return;
  const seq=revision,session=sharing;hide();
  try{if(session.active)await session.finish();else await session.start()}
  catch(error){if(seq===revision){const message=error.name==='NotAllowedError'?'Screen sharing was cancelled or permission was denied. Your camera call is unchanged.':error.message;$('callStatus').textContent=message;note(message)}}
  finally{if(seq===revision){syncEnabled();busy(false)}}
 };
 $('callAudioOutput').onclick=async()=>{
  if(!alive()||outputBusy)return;
  if(!win.navigator.mediaDevices?.selectAudioOutput||!$('callRemote').setSinkId)return note('Choose speaker or Bluetooth using your device’s audio controls. This browser cannot select audio outputs.');
  const seq=revision;outputBusy=true;$('callAudioOutput').disabled=true;
  try{const device=await win.navigator.mediaDevices.selectAudioOutput();if(seq===revision&&alive())await $('callRemote').setSinkId(device.deviceId)}
  catch{if(seq===revision)note('Audio output was not changed. Use your device’s audio controls.')}
  finally{if(seq===revision){outputBusy=false;$('callAudioOutput').disabled=false}}
 };
 $('callHold').onclick=()=>{if(!alive())return;held=!held;$('callHold').setAttribute('aria-pressed',String(held));$('callHold').textContent=held?'Resume':'Hold';syncEnabled();note(held?'On hold: your microphone and camera are paused. The other person is not placed on hold remotely.':'Call resumed.');};
 $('callFit').textContent='Fit Video';$('callFit').setAttribute('aria-pressed','true');
 $('callFit').onclick=()=>{const fill=dialog.classList.toggle('luo-call-cover');$('callFit').setAttribute('aria-pressed',String(fill));$('callFit').textContent=fill?'Fit Video':'Fill Screen'};
 const local=$('callLocal');
 function syncPreviewFacing(){dialog.classList.toggle('luo-selfie-preview',current?.getFacing?.()==='user'&&!sharing?.active)}
 local.tabIndex=0;local.setAttribute('aria-label','Your camera preview. Drag to move, or use arrow keys.');
 let drag=null,x=0,y=0;
 function move(dx,dy){const grid=local.parentElement.getBoundingClientRect(),box=local.getBoundingClientRect(),tray=sheet.hidden?grid.bottom:sheet.getBoundingClientRect().top,bottom=Math.min(tray,actions.getBoundingClientRect().top||grid.bottom);x=Math.min(Math.max(x+dx,-grid.width+box.width+24),0);y=Math.min(Math.max(y+dy,0),Math.max(0,bottom-(box.top-y)-box.height-12));local.style.setProperty('--call-pip-x',x+'px');local.style.setProperty('--call-pip-y',y+'px');}
 local.addEventListener('pointerdown',event=>{if(event.button!==0)return;delete local.dataset.dragged;drag={id:event.pointerId,x:event.clientX,y:event.clientY};local.setPointerCapture?.(event.pointerId);event.preventDefault()});
 local.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>3)local.dataset.dragged='true';move(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])local.addEventListener(type,()=>{if(drag&&local.dataset.dragged){const box=local.getBoundingClientRect(),grid=local.parentElement.getBoundingClientRect();move(box.left+box.width/2<grid.left+grid.width/2?-grid.width:grid.width,box.top+box.height/2<grid.top+grid.height/2?-grid.height:grid.height);}drag=null});
 local.addEventListener('keydown',event=>{const deltas={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]};if(deltas[event.key]){event.preventDefault();move(...deltas[event.key])}});
 win.addEventListener('resize',()=>move(0,0));local.addEventListener('dblclick',()=>{x=y=0;delete local.dataset.dragged});
 const shell=installCallShell({win,dialog,$,onEnd});
 const lenses=installCallLensBrowser({win,sheet,rail,getStream:()=>current?.getStream(),isCurrent:alive});
 function stop(preserveIdentity=false){if(!preserveIdentity)lenses.clear();revision++;current=null;shell.stop(preserveIdentity);sharing?.stop();sharing=null;engine?.stop();engine=null;held=false;cameraSwitch=false;outputBusy=false;drag=null;x=y=0;local.style.removeProperty('--call-pip-x');local.style.removeProperty('--call-pip-y');dialog.classList.remove('luo-screen-sharing','luo-selfie-preview');hide();controls.hidden=true;network.hidden=true;network.textContent='';shareStatus.hidden=true;shareStatus.textContent='';shareButton.textContent='Share screen';shareButton.setAttribute('aria-pressed','false');shareButton.setAttribute('aria-busy','false');busy(false);$('callHold').textContent='Hold';$('callHold').setAttribute('aria-pressed','false');$('callAudioOutput').disabled=false;local.setAttribute('aria-label','Your camera preview. Drag to move, or use arrow keys.');selectState();}
 stop();
 return{
  start(options){stop(true);current=options;syncPreviewFacing();controls.hidden=false;playback.hidden=true;const video=options.getStream().getVideoTracks().length>0;dialog.classList.toggle('luo-live-video',video);dialog.classList.toggle('luo-video-layout',video);dialog.classList.toggle('luo-audio-layout',!video);$('callEffectsToggle').hidden=$('callFit').hidden=!video;
   if(video)engine=createCallEffects({win,peer:options.peer,getStream:options.getStream,isCurrent:options.isCurrent,onPreview:stream=>{$('callLocal').srcObject=stream;$('callLocal').play().catch(()=>{})},onFailure:message=>{if(alive()){shell.mediaState({video:false,held});$('callStatus').textContent=message;note(message)}}});
   shareButton.hidden=!video||!win.navigator.mediaDevices?.getDisplayMedia;
   if(video)sharing=createCallScreenShare({win,peer:options.peer,isCurrent:options.isCurrent,
    onState:state=>{dialog.classList.toggle('luo-screen-sharing',state.active);shareStatus.hidden=!state.active&&!state.busy;shareStatus.textContent=state.failed?'Screen stopped · camera restoration needs attention.':state.busy?(state.active?'Stopping or switching shared video…':'Choose a screen in your browser. Only share content you intend the other person to see.'):'Sharing screen · your selected screen is visible to the other person.';shareButton.textContent=state.failed?'Retry camera':state.active?'Stop sharing':'Share screen';shareButton.setAttribute('aria-pressed',String(state.active));shareButton.setAttribute('aria-busy',String(state.busy));busy(false);syncEnabled()},
    onPreview:track=>{syncPreviewFacing();local.srcObject=new win.MediaStream([...options.getStream().getAudioTracks(),track]);local.setAttribute('aria-label','Your shared screen preview. Drag to move, or use arrow keys.');local.play().catch(()=>{})},
    onRestore:()=>{syncPreviewFacing();engine?.refreshPreview();local.setAttribute('aria-label','Your camera preview. Drag to move, or use arrow keys.');syncEnabled()},
    onFailure:message=>{if(alive()){$('callStatus').textContent=message;note(message)}}});
   shell.start(options);busy(false);
  },
  async replaceCamera(track){if(sharing?.active||sharing?.busy)throw Error('Stop screen sharing before switching cameras.');if(engine)return engine.replaceCamera(track);throw Error('No video call.')},
  beginCameraSwitch(){if(!alive()||cameraSwitch||engine?.busy||sharing?.active||sharing?.busy)return false;cameraSwitch=true;busy(false);return true},
  finishCameraSwitch(){cameraSwitch=false;busy(!!engine?.busy)},
  get isMinimized(){return shell.minimized},restore:()=>shell.restore(),consumeMinimizeClose:()=>shell.consumeClose(),prepare:options=>shell.prepare(options),remoteTrack:event=>shell.track(event),
  connectionState(){if(alive()){busy(!!engine?.busy);shell.connectionState()}},
  playbackBlocked(){if(alive()){playback.hidden=false;$('callStatus').textContent='Tap More → Play call audio to enable sound.'}},
  metrics(value){if(!alive())return;shell.metrics(value);const video=current.getStream().getVideoTracks().length>0,ms=n=>n===null?'unknown':Math.round(n*1000)+' ms';network.hidden=false;network.textContent=(video?value.profile+' budget':'Audio')+' · RTT '+ms(value.rtt)+' · jitter '+ms(value.jitter)+(video?' · video loss '+(value.loss===null?'unknown':Math.round(value.loss*100)+'%'):'')+' · '+value.route;},
  cameraReplaced(){syncPreviewFacing();engine?.refreshPreview();syncEnabled()},syncEnabled,stop
 };
}

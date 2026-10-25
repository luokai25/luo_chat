import {CALL_EFFECTS,createCallEffects} from './call-effects.js';

// No media permissions on installation. All actions remain inside the live call dialog.
export function installCallExperience({win,dialog,$,note}){
 const doc=win.document,actions=dialog.querySelector('.device-actions');
 dialog.classList.add('luo-live-call');
 const controls=doc.createElement('div');controls.className='luo-call-tools';
 controls.innerHTML='<button type="button" id="callEffectsToggle" aria-controls="callEffectsSheet" aria-expanded="false">✧ Effects</button><button type="button" id="callAudioOutput">Audio output</button><button type="button" id="callHold" aria-pressed="false">Hold</button><button type="button" id="callFit" aria-pressed="false">Fill screen</button>';
 actions.before(controls);
 const playback=doc.createElement('button');playback.id='callPlayback';playback.type='button';playback.textContent='Play call audio';playback.hidden=true;controls.append(playback);$('callRemote').controls=false;
 playback.onclick=async()=>{if(!alive())return;try{await $('callRemote').play();playback.hidden=true}catch{if(alive())note('Tap Play call audio again, or check your browser sound permissions.')}};
 const network=doc.createElement('p');network.id='callNetwork';network.hidden=true;controls.before(network);
 const sheet=doc.createElement('section');sheet.id='callEffectsSheet';sheet.hidden=true;sheet.setAttribute('aria-label','Live video effects');
 const heading=doc.createElement('div');heading.className='luo-effects-heading';
 const title=doc.createElement('strong');title.textContent='Live effects';
 const close=doc.createElement('button');close.type='button';close.textContent='Close effects';heading.append(title,close);
 const rail=doc.createElement('div');rail.className='luo-effects-carousel';rail.setAttribute('role','group');rail.setAttribute('aria-label','Choose a live color effect');
 for(const effect of CALL_EFFECTS){const button=doc.createElement('button');button.type='button';button.dataset.effect=effect.id;button.textContent=effect.label;button.setAttribute('aria-pressed',String(effect.id==='original'));rail.append(button)}
 const hint=doc.createElement('p');hint.textContent='These colors are sent to the other person. Original restores full camera quality. Face masks and background replacement are not installed.';
 sheet.append(heading,rail,hint);dialog.append(sheet);
 let current=null,engine=null,held=false,outputBusy=false,revision=0;
 const alive=()=>current?.isCurrent()===true;
 function hide(){sheet.hidden=true;sheet.style.transform='';sheetDrag=null;$('callEffectsToggle').setAttribute('aria-expanded','false');}
 function selectState(){for(const button of rail.children)button.setAttribute('aria-pressed',String(button.dataset.effect===(engine?.effect||'original')));}
 function busy(value){for(const button of rail.children)button.disabled=value;$('switchCallCamera').disabled=value;}
 function syncEnabled(){if(!alive())return;const stream=current.getStream();stream.getAudioTracks().forEach(t=>t.enabled=!held&&$('muteCall').getAttribute('aria-pressed')!=='true');const enabled=!held&&$('cameraCall').getAttribute('aria-pressed')!=='true';stream.getVideoTracks().forEach(t=>t.enabled=enabled);engine?.setEnabled(enabled);}
 $('callEffectsToggle').onclick=()=>{if(!alive()||!engine)return;sheet.hidden=!sheet.hidden;$('callEffectsToggle').setAttribute('aria-expanded',String(!sheet.hidden));if(!sheet.hidden)rail.querySelector('[aria-pressed="true"]')?.focus()};
 close.onclick=()=>{hide();$('callEffectsToggle').focus()};
 sheet.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.click()}if(['ArrowLeft','ArrowRight'].includes(event.key)){const buttons=[...rail.children],index=buttons.indexOf(doc.activeElement);if(index>=0){event.preventDefault();buttons[(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length].focus()}}});
 let sheetDrag=null;
 heading.addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;sheetDrag={id:event.pointerId,y:event.clientY};heading.setPointerCapture?.(event.pointerId)});
 heading.addEventListener('pointermove',event=>{if(sheetDrag?.id===event.pointerId){const dy=Math.max(0,event.clientY-sheetDrag.y);sheet.style.transform='translateY('+Math.min(120,dy)+'px)'}});
 heading.addEventListener('pointerup',event=>{if(sheetDrag?.id===event.pointerId){const dismiss=event.clientY-sheetDrag.y>60;sheetDrag=null;sheet.style.transform='';if(dismiss)close.click()}});
 heading.addEventListener('pointercancel',()=>{sheetDrag=null;sheet.style.transform=''});
 rail.onclick=async event=>{
  const button=event.target.closest('[data-effect]');if(!button||!alive()||!engine||engine.busy||$('switchCallCamera').disabled)return;
  const seq=revision,activeEngine=engine;busy(true);
  try{if(await activeEngine.select(button.dataset.effect)&&seq===revision){syncEnabled();selectState()}}
  catch(error){if(seq===revision)note(error.message)}finally{if(seq===revision)busy(false)}
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
 $('callFit').onclick=()=>{const fill=dialog.classList.toggle('luo-call-cover');$('callFit').setAttribute('aria-pressed',String(fill));$('callFit').textContent=fill?'Show full frame':'Fill screen'};
 const local=$('callLocal');local.tabIndex=0;local.setAttribute('aria-label','Your camera preview. Drag to move, or use arrow keys.');
 let drag=null,x=0,y=0;
 function move(dx,dy){const grid=local.parentElement.getBoundingClientRect(),box=local.getBoundingClientRect(),bottom=controls.hidden?grid.bottom:controls.getBoundingClientRect().top;x=Math.min(Math.max(x+dx,-grid.width+box.width+16),0);y=Math.min(Math.max(y+dy,0),Math.max(0,bottom-grid.top-box.height-28));local.style.setProperty('--call-pip-x',x+'px');local.style.setProperty('--call-pip-y',y+'px');}
 local.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};local.setPointerCapture?.(event.pointerId);event.preventDefault()});
 local.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;move(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])local.addEventListener(type,()=>drag=null);
 local.addEventListener('keydown',event=>{const deltas={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]};if(deltas[event.key]){event.preventDefault();move(...deltas[event.key])}});
 win.addEventListener('resize',()=>move(0,0));
 function stop(){revision++;current=null;engine?.stop();engine=null;held=false;outputBusy=false;drag=null;x=y=0;local.style.removeProperty('--call-pip-x');local.style.removeProperty('--call-pip-y');hide();controls.hidden=true;network.hidden=true;network.textContent='';busy(false);$('callHold').textContent='Hold';$('callHold').setAttribute('aria-pressed','false');$('callAudioOutput').disabled=false;selectState();}
 stop();
 return{
  start(options){stop();current=options;controls.hidden=false;playback.hidden=true;const video=options.getStream().getVideoTracks().length>0;dialog.classList.toggle('luo-live-video',video);dialog.classList.toggle('luo-video-layout',video);dialog.classList.toggle('luo-audio-layout',!video);$('callEffectsToggle').hidden=$('callFit').hidden=!video;
   if(video)engine=createCallEffects({win,peer:options.peer,getStream:options.getStream,isCurrent:options.isCurrent,onPreview:stream=>{$('callLocal').srcObject=stream;$('callLocal').play().catch(()=>{})},onFailure:message=>{if(alive()){$('callStatus').textContent=message;note(message)}}});
  },
  async replaceCamera(track){if(engine)return engine.replaceCamera(track);throw Error('No video call.')},
  playbackBlocked(){if(alive())playback.hidden=false},
  metrics(value){if(!alive())return;const video=current.getStream().getVideoTracks().length>0,ms=n=>n===null?'unknown':Math.round(n*1000)+' ms';network.hidden=false;network.textContent=(video?value.profile+' budget':'Audio')+' · RTT '+ms(value.rtt)+' · jitter '+ms(value.jitter)+(video?' · video loss '+(value.loss===null?'unknown':Math.round(value.loss*100)+'%'):'')+' · '+value.route;},
  cameraReplaced(){engine?.refreshPreview();syncEnabled()},syncEnabled,stop
 };
}

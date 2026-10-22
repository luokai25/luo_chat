/* Luo real in-chat voice recorder. Records only with user consent; uses native secure media upload. */
(()=>{'use strict';const $=id=>document.getElementById(id);
function setup(){
 const room=$('room'),form=$('sendform'),text=$('body'),file=$('mediaFile');if(!room||!form||!text||!file||$('luoVoiceInline'))return;
 const mic=document.createElement('button');mic.id='luoInlineMic';mic.type='button';mic.title='Hold to record voice. Slide left to cancel, slide up to lock';mic.setAttribute('aria-label','Record voice message');mic.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8.5 21h7"/></svg>';form.append(mic);
 const dock=document.createElement('div');dock.id='luoVoiceInline';dock.setAttribute('aria-label','Voice message recording');dock.innerHTML='<span class="luo-voice-dot" aria-hidden="true"></span><strong id="luoVoiceTimer">0:00</strong><div class="luo-waveform" aria-label="Recording waveform"></div><div class="luo-voice-buttons"><button id="luoVoiceDiscard" type="button">Delete</button><button id="luoVoicePause" type="button">Pause</button><button id="luoVoiceLock" type="button">Lock</button><button id="luoVoiceStop" type="button">Stop</button><button id="luoVoiceSend" type="button" hidden>Send</button><button id="luoVoiceRetry" type="button" hidden>Try again</button></div><audio id="luoVoiceAudio" controls preload="metadata" hidden></audio><small class="luo-voice-hint">Hold mic · slide left to cancel · slide up to lock</small><span id="luoVoiceFeedback" role="status" aria-live="polite"></span>';form.parentNode.insertBefore(dock,form);
 // Luo insignia, premium state badge and a real-time signal meter.
 const crest=document.createElement('div');crest.id='luoVoiceCrest';crest.innerHTML='<span class="luo-voice-sigil" aria-hidden="true">L</span><span class="luo-voice-brandname">LUO <b>VOICE</b><small>PRIVATE AUDIO MESSAGE</small></span><span id="luoVoiceStage" class="luo-voice-stage">Ready</span>';
 dock.prepend(crest);
 const activity=document.createElement('span');activity.id='luoVoiceActivity';activity.setAttribute('aria-hidden','true');activity.textContent='◈';dock.append(activity);
 for(let i=0;i<23;i++){const bar=document.createElement('span');bar.style.setProperty('--h',(6+(i*13)%23)+'px');bar.style.setProperty('--delay',(-.09*(i%8))+'s');bar.style.setProperty('--period',(.52+(i%5)*.105)+'s');dock.querySelector('.luo-waveform').append(bar)}
 let recorder=null,stream=null,chunks=[],fileToSend=null,url=null,state='idle',pausedMs=0,started=0,timer=null,version=0,roomName=null,locked=false,point=null,ignoreClick=false;
 let audioContext=null,analyser=null,meterSource=null,meterRAF=0,signalSamples=null;
 const time=n=>Math.floor(n/60000)+':'+String(Math.floor(n/1000)%60).padStart(2,'0');
 const clock=()=>window.performance?.now?.()||Date.now();
 const status=s=>$('luoVoiceFeedback').textContent=s;
 const inChat=()=>document.querySelector('.app')?.dataset.screen==='room';
 function render(){const label=state==='requesting'?'MICROPHONE ACCESS':state==='recording'?(locked?'LOCKED RECORDING':'RECORDING'):state==='paused'?'PAUSED':state==='processing'?'PROCESSING':state==='ready'?'READY TO SEND':'READY';
  dock.dataset.voiceState=state;$('luoVoiceStage').textContent=state==='error'?'MICROPHONE ERROR':label;$('luoVoiceRetry').hidden=state!=='error';$('luoVoiceDiscard').textContent=state==='error'?'Close':'Delete';
  room.classList.toggle('luo-hold-locked',locked&&['recording','paused','ready'].includes(state));room.classList.toggle('luo-voice-paused',state==='paused');room.classList.toggle('luo-voice-ready',state==='ready');
  room.classList.toggle('luo-voice-open',state!=='idle');room.classList.toggle('luo-voice-recording',state==='recording');$('luoVoicePause').hidden=!['recording','paused'].includes(state);$('luoVoicePause').textContent=state==='paused'?'Resume':'Pause';$('luoVoiceStop').hidden=!['recording','paused'].includes(state);$('luoVoiceLock').hidden=!['recording','paused'].includes(state);$('luoVoiceLock').textContent=locked?'Locked':'Lock';$('luoVoiceSend').hidden=state!=='ready';$('luoVoiceAudio').hidden=state!=='ready';dock.querySelector('.luo-voice-hint').hidden=state==='ready'}
 function closeMeter(){
   if(meterRAF){window.cancelAnimationFrame?.(meterRAF);meterRAF=0}
   try{audioContext?.close?.()?.catch?.(()=>{})}catch{}
   audioContext=null;analyser=null;meterSource=null;signalSamples=null;
   room.classList.remove('luo-voice-live-meter');
   for(const bar of dock.querySelectorAll('.luo-waveform span')){bar.style.removeProperty('height');bar.style.removeProperty('opacity')}
 }
 function closeTracks(){closeMeter();try{stream?.getTracks().forEach(t=>t.stop())}catch{}stream=null}
 function discard(message=''){version++;const old=recorder;recorder=null;if(timer)clearInterval(timer);timer=null;try{if(old&&old.state!=='inactive'){old.ondataavailable=null;old.onstop=null;old.stop()}}catch{}closeTracks();if(url){URL.revokeObjectURL(url);url=null}try{$('luoVoiceAudio').pause()}catch{}$('luoVoiceAudio').removeAttribute('src');chunks=[];fileToSend=null;state='idle';pausedMs=0;started=0;locked=false;$('luoVoiceTimer').textContent='0:00';status(message);render()}
 function fail(message){discard();state='error';status(message);render()}
 function elapsed(){return pausedMs+(state==='recording'?clock()-started:0)}
 function startMeter(live){
  const Engine=window.AudioContext||window.webkitAudioContext;
  if(!Engine||typeof window.requestAnimationFrame!=='function')return;
  try{
    audioContext=new Engine();
    meterSource=audioContext.createMediaStreamSource(live);
    analyser=audioContext.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.77;
    meterSource.connect(analyser);
    signalSamples=new Uint8Array(analyser.fftSize);
    const bars=[...dock.querySelectorAll('.luo-waveform span')];
    room.classList.add('luo-voice-live-meter');
    const frame=()=>{
      if(state!=='recording'&&state!=='paused'){meterRAF=0;return}
      if(state==='recording'){
        analyser.getByteTimeDomainData(signalSamples);
        let power=0;
        for(const sample of signalSamples){const level=(sample-128)/128;power+=level*level}
        const loudness=Math.min(1,Math.sqrt(power/Math.max(1,signalSamples.length))*7.5);
        bars.forEach((bar,index)=>{
          const variation=.52+.48*Math.abs(Math.sin(index*1.78+Date.now()/210));
          const height=5+Math.round((3+25*loudness)*variation);
          bar.style.height=height+'px';
          bar.style.opacity=String(.35+.63*Math.min(1,loudness*1.6+.08));
        });
        dock.style.setProperty('--luo-signal-power',String(loudness.toFixed(3)));
      }
      meterRAF=window.requestAnimationFrame(frame);
    };
    meterRAF=window.requestAnimationFrame(frame);
  }catch(error){closeMeter()}
 }
 async function start(){
  if(state!=='idle'||!inChat())return;
  if(typeof MediaRecorder==='undefined'||!navigator.mediaDevices?.getUserMedia){fail('Microphone recording is not supported here. Use an updated browser over HTTPS.');return}
  if(text.value.trim()||!$('fileBar')?.classList.contains('hidden')){fail('Send or remove the current message or attachment before recording.');return}
  const id=++version;roomName=$('roomtitle')?.textContent||'';state='requesting';status('Allow microphone access to begin…');render();
  try{
   const live=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(id!==version||!inChat()){live.getTracks().forEach(t=>t.stop());return}
   stream=live;const choices=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'];const mime=choices.find(t=>MediaRecorder.isTypeSupported?.(t));
   recorder=new MediaRecorder(live,mime?{mimeType:mime}:undefined);chunks=[];
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
   recorder.onerror=()=>fail('Recording interrupted. Please try again.');
   recorder.start(250);started=clock();pausedMs=0;state='recording';status('Recording…');
   timer=setInterval(()=>$('luoVoiceTimer').textContent=time(elapsed()),160);render();startMeter(live);
  }catch(error){if(id!==version)return;fail(error?.name==='NotAllowedError'||error?.name==='PermissionDeniedError'?'Microphone permission denied. Allow microphone access for Luo Chat in browser settings, then tap Try again.':'Could not start microphone: '+(error?.message||'Unknown error'))}
 }
 function pause(){if(state==='recording'&&recorder?.state==='recording'){recorder.pause();pausedMs=elapsed();state='paused';status('Paused')}else if(state==='paused'&&recorder?.state==='paused'){recorder.resume();started=clock();state='recording';status('Recording…')}render()}
 function stop(){
  if(!['recording','paused'].includes(state))return;
  pausedMs=elapsed();if(timer)clearInterval(timer);timer=null;state='processing';render();status('Preparing playback…');
  const id=version,old=recorder;if(!old)return discard('No microphone recording.');
  old.onstop=()=>{
   if(id!==version)return;closeTracks();const mime=(old.mimeType||'audio/webm').split(';')[0]||'audio/webm';
   const blob=new Blob(chunks,{type:mime});chunks=[];
   if(!blob.size)return fail('No audio was captured. Check microphone permissions, then try again.');
   if(blob.size>52428800)return fail('Voice message exceeds the 50 MB attachment limit.');
   fileToSend=new File([blob],'luo-voice-'+Date.now()+'.'+(mime.includes('ogg')?'ogg':mime.includes('mp4')?'m4a':'webm'),{type:mime});
   url=URL.createObjectURL(blob);$('luoVoiceAudio').src=url;
   state='ready';$('luoVoiceTimer').textContent=time(pausedMs);status('Listen to your recording or press Send.');render();
  };
  try{old.stop()}catch(err){fail('Unable to stop microphone: '+err.message)}
 }
 function send(){
  if(state!=='ready'||!fileToSend||!inChat()){status('Open a conversation before sending voice messages.');return}
  if(typeof DataTransfer!=='function'){status('Your browser does not support attaching recorded audio.');return}
  let d;try{d=new DataTransfer();d.items.add(fileToSend)}catch(err){status('Could not prepare this audio attachment. '+(err?.message||''));return}
  try{file.files=d.files;file.dispatchEvent(new Event('change',{bubbles:true}))}catch{status('Cannot attach recording.');return}
  if(file.files?.[0]?.size!==fileToSend.size){status('The recording was not accepted as an attachment.');return}
  discard();const button=form.querySelector('.send');
  // Existing app submits the selected audio attachment using authenticated Supabase chat-media policies.
  if(form.requestSubmit)form.requestSubmit(button||undefined);else button?.click();
 }
 $('luoVoiceDiscard').onclick=()=>discard();$('luoVoiceRetry').onclick=()=>{discard();start()};
 $('luoVoicePause').onclick=pause;$('luoVoiceStop').onclick=stop;$('luoVoiceSend').onclick=send;
 $('luoVoiceLock').onclick=()=>{locked=true;status('Locked. Tap Stop when finished.');render()};
 // One in-chat voice interaction: hold to record, release to send, left to cancel, up to lock.
 let hold=null,autoFinish=false,lastPointerUp=0;
 const minHoldMs=260;
 function preventGhostClick(){ignoreClick=true;setTimeout(()=>{ignoreClick=false},420)}
 function completeRelease(){
  if(!autoFinish)return;
  if(state==='recording'||state==='paused'){autoFinish='processing';stop();return}
  if(state==='ready'){autoFinish=false;send();return}
  if(state==='idle'||state==='error'){autoFinish=false}
 }
 new MutationObserver(completeRelease).observe(dock,{attributes:true,attributeFilter:['data-voice-state']});
 mic.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(hold||state!=='idle')return;
  hold={id:e.pointerId,x:e.clientX,y:e.clientY,start:clock(),cancelled:false};
  autoFinish=false;
  mic.dataset.holding='true';mic.setAttribute('aria-label','Hold to record. Slide left to cancel, up to lock');
  try{mic.setPointerCapture?.(e.pointerId)}catch{}
  start();
 });
 function moveHold(e){
  if(!hold||e.pointerId!==hold.id)return;
  const dx=e.clientX-hold.x,dy=e.clientY-hold.y;
  if(dx< -78){hold.cancelled=true;hold=null;autoFinish=false;preventGhostClick();discard();mic.removeAttribute('data-holding');return}
  if(dy< -75&&!locked){locked=true;render();status('Recording locked. Stop, preview, then send.')}
 }
 function releaseHold(e){
  if(!hold||e.pointerId!==hold.id)return;
  moveHold(e);if(!hold)return;
  const duration=clock()-hold.start;hold=null;mic.removeAttribute('data-holding');lastPointerUp=clock();preventGhostClick();
  if(locked){status('Locked recording. Tap Stop to preview or Delete to cancel.');render();return}
  if(duration<minHoldMs){autoFinish=false;discard();return}
  autoFinish=true;completeRelease();
 }
 document.addEventListener('pointermove',moveHold,true);
 document.addEventListener('pointerup',releaseHold,true);
 document.addEventListener('pointercancel',e=>{if(hold&&e.pointerId===hold.id&&!locked){hold=null;autoFinish=false;discard();mic.removeAttribute('data-holding')}},true);
 mic.addEventListener('click',e=>{
  if(ignoreClick||(e.detail>0&&clock()-lastPointerUp<560)){e.preventDefault();return}
  // Keyboard/switch input is an accessible alternative to the touch-and-hold gesture.
  if(state==='idle'){start()}
  else if(state==='recording'||state==='paused')stop();
  else if(state==='ready')send();
  else if(state==='error')discard();
 });
 $('luoVoiceDiscard').addEventListener('click',()=>{autoFinish=false;hold=null});
 $('luoVoiceLock').addEventListener('click',()=>{autoFinish=false});
  // Capture old voice button clicks before their modal-opening handlers run, without affecting camera capture.
 document.addEventListener('click',e=>{if(!e.target.closest?.('#recordChatVoice,#luoApprovedMic'))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(state==='idle')start();else if(['recording','paused'].includes(state))stop()},true);
 const sync=()=>{const used=!!text.value.trim()||!$('fileBar')?.classList.contains('hidden');form.classList.toggle('luo-voice-has-text',used)};
 text.addEventListener('input',sync);if($('fileBar'))new MutationObserver(sync).observe($('fileBar'),{attributes:true,attributeFilter:['class']});sync();render();
 new MutationObserver(()=>{if(!inChat()&&state!=='idle')discard()}).observe(document.querySelector('.app')||room,{attributes:true,attributeFilter:['data-screen']});
 const title=$('roomtitle');if(title)new MutationObserver(()=>{if(state!=='idle'&&title.textContent!==roomName)discard()}).observe(title,{childList:true,characterData:true,subtree:true});
 window.addEventListener('pagehide',()=>{if(state!=='idle')discard()});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&['recording','paused'].includes(state))discard()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();

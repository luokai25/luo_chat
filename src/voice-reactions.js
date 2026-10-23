// Private two-second voice reactions use the existing authenticated reply-attachment flow.
// A reaction is a linked audio reply, not an emoji-style DB record.
export function installQuickVoiceReplies({win,getUser,getRoom,onSend,note}) {
 const doc=win.document,mk=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const dialog=mk('dialog','luo-voice-reaction-dialog');dialog.id='luoQuickVoiceReply';dialog.setAttribute('aria-labelledby','luoVoiceReactionTitle');
 const header=mk('div','luo-voice-reaction-header'),title=mk('h2','','Two-second voice reaction'),close=mk('button','ghost','Close');
 title.id='luoVoiceReactionTitle';close.type='button';header.append(title,close);
 const description=mk('p','muted','React to a text or media message with a tiny audio reply. Only the people in this conversation can open the attached audio.');
 const waveform=mk('div','luo-voice-reaction-wave');waveform.setAttribute('aria-hidden','true');
 for(let i=0;i<13;i++){const bar=mk('span');bar.style.setProperty('--delay',i*40+'ms');bar.style.height=9+(i*13)%31+'px';waveform.append(bar)}
 const status=mk('p','luo-voice-reaction-status','Press Record to request the microphone. Recording stops automatically after two seconds.');status.setAttribute('role','status');
 const audio=mk('audio','luo-voice-reaction-preview');audio.controls=true;audio.preload='none';audio.hidden=true;
 const actions=mk('div','luo-voice-reaction-actions'),start=mk('button','primary','Record'),stop=mk('button','ghost','Stop'),discard=mk('button','ghost','Discard'),send=mk('button','primary','Send voice reaction');
 for(const b of [start,stop,discard,send])b.type='button';actions.append(start,stop,discard,send);
 dialog.append(header,description,waveform,status,audio,actions);doc.body.append(dialog);
 const styles=mk('style');styles.textContent=[
 '.luo-voice-reaction-dialog{width:min(92vw,440px);max-width:440px;background:radial-gradient(circle at 55% 0%,#72542a48,transparent 65%),#161416;color:#f6e9ca;border:1px solid #a58750;border-radius:21px;padding:19px;box-sizing:border-box;box-shadow:0 24px 80px #000a}',
 '.luo-voice-reaction-dialog::backdrop{background:#000b;backdrop-filter:blur(4px)}',
 '.luo-voice-reaction-header{display:flex;align-items:center;justify-content:space-between;gap:10px}.luo-voice-reaction-header h2{color:#f4ca81;font-size:20px;margin:0}',
 '.luo-voice-reaction-wave{display:flex;align-items:center;justify-content:center;gap:4px;height:92px;margin:10px 0;border-radius:15px;background:#1f1a1b;border:1px solid #645137;overflow:hidden}',
 '.luo-voice-reaction-wave span{display:block;width:5px;min-height:9px;border-radius:9px;background:#d8b071;opacity:.65}',
 '.luo-voice-reaction-dialog[data-state="recording"] .luo-voice-reaction-wave span{animation:luo-voice-react-wave .8s ease-in-out var(--delay) infinite alternate;opacity:1}',
 '@keyframes luo-voice-react-wave{from{transform:scaleY(.4)}to{transform:scaleY(1.8)}}',
 '.luo-voice-reaction-status{min-height:30px;color:#edc784;font-size:13px;line-height:1.5}',
 '.luo-voice-reaction-preview{display:block;width:100%;margin:12px 0}.luo-voice-reaction-preview[hidden]{display:none}',
 '.luo-voice-reaction-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:15px}.luo-voice-reaction-actions button{flex:1;min-height:42px}',
 '.luo-voice-reaction-action{font-size:12px;color:#dfbf88;text-align:left;min-height:30px;margin:1px 4px}',
 '@media(prefers-reduced-motion:reduce){.luo-voice-reaction-dialog[data-state="recording"] .luo-voice-reaction-wave span{animation:none!important}.luo-voice-reaction-dialog::backdrop{backdrop-filter:none}}'
 ].join('\n');doc.head.append(styles);
 let token=0,target=null,stream=null,recorder=null,timer=null,url=null,file=null;
 const match=(actor,room,seq)=>getUser()?.id===actor&&getRoom()===room&&token===seq&&dialog.open;
 const tracksOff=()=>{const old=stream;stream=null;try{for(const track of old?.getTracks?.()||[])track.stop()}catch{}};
 const revoke=()=>{if(url){try{win.URL.revokeObjectURL(url)}catch{}url=null}audio.removeAttribute('src');audio.hidden=true;try{audio.pause()}catch{}};
 const buttons=()=>{start.disabled=!!recorder||!target;stop.disabled=!recorder;discard.disabled=!file&&!recorder;send.disabled=!file||!!recorder};
 function reset(){token++;if(timer!==null)win.clearTimeout(timer);timer=null;const old=recorder;recorder=null;if(old&&old.state!=='inactive')try{old.stop()}catch{}tracksOff();revoke();file=null;target=null;dialog.dataset.state='idle';buttons()}
 function closeDialog(){reset();if(dialog.open)dialog.close()}
 close.onclick=closeDialog;dialog.addEventListener('close',reset);
 function open(message){const actor=getUser()?.id,room=getRoom();if(!actor||!room||!message?.id||!win.MediaRecorder||!win.navigator.mediaDevices?.getUserMedia){note('Two-second voice recording is not supported in this browser.');return}
  closeDialog();target={id:message.id,body:String(message.body||'Voice or media message'),room,actor};
  status.textContent='Tap Record to allow your microphone. No audio is shared until you tap Send.';
  buttons();dialog.showModal();
 }
 async function record(){
  if(!target||recorder)return;
  const actor=target.actor,room=target.room,seq=++token;
  revoke();file=null;status.textContent='Requesting microphone permission…';buttons();
  let granted;
  try{
   granted=await win.navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(!match(actor,room,seq)){for(const t of granted.getTracks())t.stop();return}
   stream=granted;
   const types=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm','audio/ogg'];
   const mime=types.find(type=>win.MediaRecorder.isTypeSupported?.(type));
   const options=mime?{mimeType:mime,audioBitsPerSecond:64000}:{audioBitsPerSecond:64000};
   const next=new win.MediaRecorder(granted,options),chunks=[];
   recorder=next;const recordingType=(next.mimeType||mime||'').split(';')[0];
   if(!['audio/webm','audio/ogg','audio/mp4'].includes(recordingType))throw Error('This browser does not provide an upload-compatible audio format.');
   next.ondataavailable=e=>{if(seq===token&&e.data?.size)chunks.push(e.data)};
   next.onerror=()=>{if(seq===token){status.textContent='Microphone recording failed. Try again.';stopRecording()}};
   next.onstop=()=>{
    if(seq!==token)return;recorder=null;tracksOff();if(timer!==null)win.clearTimeout(timer);timer=null;dialog.dataset.state='preview';
    const blob=new win.Blob(chunks,{type:recordingType});
    if(!blob.size||blob.size>512*1024){status.textContent='Clip unavailable or too large. Record again.';buttons();return}
    const suffix=recordingType==='audio/mp4'?'m4a':recordingType==='audio/ogg'?'ogg':'webm';
    file=new win.File([blob],'luo-voice-reaction-'+Date.now()+'.'+suffix,{type:recordingType});
    try{url=win.URL.createObjectURL(blob);audio.src=url;audio.hidden=false}catch{audio.hidden=true}
    status.textContent='Preview your two-second reaction, then send it as a private audio reply.';buttons();
   };
   next.start(150);
   dialog.dataset.state='recording';status.textContent='Recording… maximum two seconds';buttons();
   timer=win.setTimeout(()=>stopRecording(),1900);
  }catch(e){if(seq!==token){for(const t of granted?.getTracks?.()||[])t.stop();return}
   recorder=null;tracksOff();dialog.dataset.state='idle';status.textContent=e?.name==='NotAllowedError'?'Microphone blocked. Enable it in your browser permissions.':e.message||'Unable to record audio.';buttons()}
 }
 function stopRecording(){if(timer!==null)win.clearTimeout(timer);timer=null;const active=recorder;if(!active)return;status.textContent='Processing your recording…';try{if(active.state!=='inactive')active.stop()}catch{recorder=null;tracksOff();buttons()}}
 start.onclick=record;stop.onclick=stopRecording;
 discard.onclick=()=>{const previous=target;reset();target=previous;status.textContent='Reaction discarded. You can record again.';buttons()};
 send.onclick=async()=>{const item=target,clip=file;if(!item||!clip||!match(item.actor,item.room,token))return;send.disabled=true;
  try{const accepted=await onSend({file:clip,messageId:item.id,messageBody:item.body,roomId:item.room,ownerId:item.actor});if(accepted===false){send.disabled=false;return}closeDialog()}catch(e){if(target===item){status.textContent=e.message||'Could not send your voice reaction.';send.disabled=false}}
 };
 function decorateMessage(node,message){if(!message?.id||!node||message.deleted_at||message.recalled_at)return;
  const action=mk('button','link luo-voice-reaction-action','🎙 Voice 2s');action.type='button';action.setAttribute('aria-label','Record a two-second voice reaction to this message');action.onclick=()=>open(message);node.append(action);
 }
 return {decorateMessage,onRoom:closeDialog,signedOut:closeDialog,dialog};
}

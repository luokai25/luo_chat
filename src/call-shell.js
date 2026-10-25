import {installCallMediaState} from './call-media-state.js';
import {renderConversationAvatar} from './avatars.js';

const icons={muteCall:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>',callAudioOutput:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8q6 4 0 8"/>',cameraCall:'<rect x="2" y="6" width="14" height="12" rx="3"/><path d="m16 10 6-3v10l-6-3"/>',switchCallCamera:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 10h8l-2-2m2 6H8l2 2"/>',callEffectsToggle:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',endCall:'<path d="M3 16q9-8 18 0l-3 4-5-2h-2l-5 2z"/>'};
export function installCallShell({win,dialog,$,onEnd}){
 const doc=win.document,actions=dialog.querySelector('.device-actions'),heading=dialog.querySelector('.dialog-heading');
 dialog.classList.add('luo-immersive-call','luo-call-cover');
 const minimize=doc.createElement('button');minimize.type='button';minimize.id='callMinimize';minimize.textContent='⌄';minimize.setAttribute('aria-label','Minimize call');heading.prepend(minimize);
 const more=doc.createElement('button');more.type='button';more.id='callMore';more.textContent='•••';more.setAttribute('aria-label','More call controls');more.setAttribute('aria-controls','callMoreSheet');more.setAttribute('aria-expanded','false');heading.append(more);
 const duration=doc.createElement('span');duration.id='callDuration';duration.setAttribute('aria-label','Call duration');heading.append(duration);
 const connection=doc.createElement('span');connection.id='callConnection';connection.setAttribute('role','status');heading.append(connection);
 const setup=doc.createElement('div');setup.className='luo-call-setup';for(const id of ['beginCall','acceptCall','declineCall','closeCall'])setup.append($(id));actions.before(setup);
 const endRow=doc.createElement('div');endRow.className='luo-call-end-row';endRow.append($('endCall'));actions.after(endRow);
 const tools=dialog.querySelector('.luo-call-tools');for(const id of ['callAudioOutput','callEffectsToggle'])actions.append($(id));
 for(const id of ['muteCall','callAudioOutput','cameraCall','switchCallCamera','callEffectsToggle'])actions.append($(id));
 const extra=doc.createElement('section');extra.id='callMoreSheet';extra.hidden=true;extra.setAttribute('aria-label','More call controls');extra.innerHTML='<div class="luo-call-sheet-heading"><strong>Call controls</strong><button type="button" id="callMoreClose">Close</button></div>';
 extra.append(tools,$('callNetwork'));dialog.append(extra);
 const placeholder=doc.createElement('div');placeholder.id='callRemotePlaceholder';placeholder.innerHTML='<div class="luo-call-person-avatar" aria-hidden="true"></div><strong class="luo-call-person-name"></strong><span class="luo-call-person-status"></span>';dialog.querySelector('.call-video-grid').append(placeholder);
 const chip=doc.createElement('aside');chip.id='luoMiniCall';chip.hidden=true;const resume=doc.createElement('button');resume.type='button';resume.id='callRestore';const chipEnd=doc.createElement('button');chipEnd.type='button';chipEnd.id='callMiniEnd';chipEnd.textContent='End';chipEnd.setAttribute('aria-label','End minimized call');chip.append(resume,chipEnd);doc.body.append(chip);
 let session=null,channel=null,minimized=false,closeSkips=0,timer=null,connectedAt=null,name='Luo Chat',video=false,remoteState=null,remoteTrack=null,lastTime=-1,lastFrame=0,cleanTrack=()=>{};
 const now=()=>win.performance?.now?.()??Date.now(),alive=()=>session?.isCurrent()===true;
 const elapsed=()=>connectedAt===null?'':formatDuration((now()-connectedAt)/1000);
 function paintTime(){duration.textContent=elapsed();resume.textContent=name+' · '+(elapsed()||'Connecting…');const state=session?.peer.connectionState;connection.textContent=state==='connected'?(dialog.dataset.network==='weak'?'Weak network':'Connected'):['disconnected','failed'].includes(state)?'Reconnecting…':session?'Connecting…':'';}
 function showRemote(){
  const remote=$('callRemote'),available=video&&connectedAt!==null&&remoteState?.video!==false&&remoteTrack?.readyState!=='ended'&&!remoteTrack?.muted&&remote.readyState>=2&&now()-lastFrame<4000;
  placeholder.hidden=available;remote.classList.toggle('luo-remote-hidden',!available);
  placeholder.querySelector('.luo-call-person-status').textContent=dialog.dataset.stage==='incoming'?'Incoming '+(video?'video':'voice')+' call':!video?'Voice call':remoteState?.held?'On hold':remoteState?.video===false?'Camera off':connectedAt===null?'Waiting for connection…':'Waiting for video…';
 }
 function tick(){if(!alive())return;paintTime();const remote=$('callRemote'),stamp=remote.getVideoPlaybackQuality?.().totalVideoFrames??remote.currentTime;if(stamp!==lastTime&&remote.readyState>=2){lastTime=stamp;lastFrame=now()}showRemote();decorate();}
 function decorate(){if(!win.document||!dialog.isConnected)return;for(const [id,paths] of Object.entries(icons)){const button=$(id);if(!button||button.querySelector('.luo-call-glyph'))continue;const text=button.textContent;button.setAttribute('aria-label',button.getAttribute('aria-label')||text);button.classList.add('luo-call-button');const glyph=doc.createElement('span');glyph.className='luo-call-glyph';glyph.setAttribute('aria-hidden','true');glyph.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';const caption=doc.createElement('span');caption.className='luo-call-caption';caption.setAttribute('aria-hidden','true');caption.textContent=({muteCall:'Mic',callAudioOutput:'Audio',cameraCall:'Video',switchCallCamera:'Flip',callEffectsToggle:'Effects',endCall:'End'})[id];button.replaceChildren(glyph,caption)}}
 const decorationObserver=new win.MutationObserver(decorate);decorationObserver.observe(actions,{childList:true,subtree:true});decorationObserver.observe(endRow,{childList:true,subtree:true});
 function closeMore(focus=false){extra.hidden=true;more.setAttribute('aria-expanded','false');if(focus)more.focus();}
 more.onclick=()=>{if(!alive())return;doc.getElementById('callEffectsSheet').hidden=true;$('callEffectsToggle').setAttribute('aria-expanded','false');extra.hidden=!extra.hidden;more.setAttribute('aria-expanded',String(!extra.hidden));if(!extra.hidden)$('callMoreClose').focus()};
 $('callMoreClose').onclick=()=>closeMore(true);
 extra.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMore(true)}});
 let sheetY=null;extra.querySelector('.luo-call-sheet-heading').addEventListener('pointerdown',e=>{if(!e.target.closest('button')){sheetY=e.clientY;e.currentTarget.setPointerCapture?.(e.pointerId)}});extra.querySelector('.luo-call-sheet-heading').addEventListener('pointerup',e=>{if(sheetY!==null&&e.clientY-sheetY>60)closeMore(true);sheetY=null});extra.querySelector('.luo-call-sheet-heading').addEventListener('pointercancel',()=>sheetY=null);
 let dockY=null;actions.addEventListener('pointerdown',e=>dockY=e.clientY);actions.addEventListener('pointerup',e=>{if(dockY!==null&&dockY-e.clientY>50)more.click();dockY=null});actions.addEventListener('pointercancel',()=>dockY=null);
 minimize.onclick=()=>{if(!alive()||!dialog.open)return;closeMore();$('callEffectsSheet').hidden=true;$('callEffectsToggle').setAttribute('aria-expanded','false');minimized=true;closeSkips++;chip.hidden=false;paintTime();dialog.close()};
 function restore(){if(!minimized||!alive())return;minimized=false;chip.hidden=true;if(!dialog.open)dialog.showModal();minimize.focus();}
 resume.onclick=restore;chipEnd.onclick=()=>{if(alive())onEnd()};
 const local=$('callLocal');local.setAttribute('role','button');local.setAttribute('aria-expanded','false');function togglePreview(){local.setAttribute('aria-expanded',String(local.classList.toggle('luo-pip-expanded')))}local.addEventListener('dblclick',()=>{local.classList.remove('luo-pip-expanded');local.setAttribute('aria-expanded','false');local.style.removeProperty('--call-pip-x');local.style.removeProperty('--call-pip-y')});
 local.addEventListener('click',e=>{if(e.detail===1&&!local.dataset.dragged)togglePreview()});local.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();togglePreview()}});
 function stop(preserveIdentity=false){session=null;channel?.stop();channel=null;cleanTrack();cleanTrack=()=>{};remoteTrack=null;remoteState=null;win.clearInterval(timer);timer=null;minimized=false;chip.hidden=true;connectedAt=null;duration.textContent='';resume.textContent='';local.classList.remove('luo-pip-expanded');closeMore();placeholder.hidden=false;$('callRemote').classList.add('luo-remote-hidden');minimize.hidden=more.hidden=true;dialog.dataset.stage='ended';if(!preserveIdentity){name='Luo Chat';placeholder.querySelector('.luo-call-person-name').textContent='';placeholder.querySelector('.luo-call-person-avatar').replaceChildren();}}
 stop();
 return{
  get minimized(){return minimized},restore,
  consumeClose(){if(closeSkips){closeSkips--;return true}return false},
  prepare(options){name=options.name||'Luo Chat';video=options.video;dialog.dataset.stage=options.incoming?'incoming':'ready';dialog.classList.toggle('luo-live-video',video);dialog.classList.toggle('luo-video-layout',video);dialog.classList.toggle('luo-audio-layout',!video);dialog.classList.toggle('luo-call-incoming',!!options.incoming);dialog.classList.toggle('luo-call-ringing',true);placeholder.querySelector('.luo-call-person-name').textContent=name;renderConversationAvatar(placeholder.querySelector('.luo-call-person-avatar'),{kind:'direct',person:options.person},{label:name,lazy:false});showRemote();},
  start(options){session=options;dialog.dataset.stage='connecting';minimize.hidden=more.hidden=false;channel=installCallMediaState({peer:options.peer,initiator:options.initiator,isCurrent:options.isCurrent,onRemote:value=>{remoteState=value;showRemote()}});channel.send({video:options.getStream().getVideoTracks().length>0,held:false});if(options.peer.connectionState==='connected')this.connectionState();timer=win.setInterval(tick,500);decorate();},
  connectionState(){if(!alive())return;if(session.peer.connectionState==='connected'){dialog.dataset.stage='connected';if(connectedAt===null)connectedAt=now();dialog.classList.remove('luo-call-ringing');}else dialog.dataset.stage=session.peer.connectionState==='disconnected'||session.peer.connectionState==='failed'?'reconnecting':'connecting';tick();},
  mediaState(value){channel?.send(value)},
  track(event){cleanTrack();remoteTrack=event.streams?.[0]?.getVideoTracks?.()[0]||(event.track?.kind==='video'?event.track:null);if(remoteTrack?.addEventListener){const track=remoteTrack,update=()=>{if(alive())showRemote()};for(const kind of ['mute','unmute','ended'])track.addEventListener(kind,update);cleanTrack=()=>{for(const kind of ['mute','unmute','ended'])track.removeEventListener(kind,update)}}lastTime=-1;lastFrame=now();showRemote();},
  metrics(value){if(!alive())return;const weak=(value.loss??0)>.08||(value.rtt??0)>.55;dialog.dataset.network=weak?'weak':'normal';},
  effectsOpened(){closeMore()},stop
 };
}
export function formatDuration(seconds){const n=Math.max(0,Math.floor(seconds));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}

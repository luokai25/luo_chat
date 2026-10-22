/* Luo Chat mobile navigation, call-type presentation and session restore screen. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
function startup(){
 const app=document.querySelector('.app');if(!app||document.documentElement.dataset.luoMobileStability)return;
 document.documentElement.dataset.luoMobileStability='1550';
 // App boot starts with data-screen="auth" even while an existing Supabase token is restored.
 // Only a previously signed-in browser gets the neutral restoration surface.
 let awaiting=document.documentElement.classList.contains('luo-restoring-session');
 const showApp=()=>{if(awaiting){awaiting=false;document.documentElement.classList.remove('luo-restoring-session');}};
 function checkSession(){const screen=app.dataset.screen;if(screen==='home'||screen==='room'||screen==='recovery'){showApp()}}
 checkSession();const observer=new MutationObserver(checkSession);observer.observe(app,{attributes:true,attributeFilter:['data-screen']});
 window.addEventListener('pageshow',checkSession);
 // Never strand an expired/offline browser behind a splash forever.
 if(awaiting)setTimeout(()=>{if(app.dataset.screen==='auth')showApp()},3500);
 // The native navigation, private group manager and all message actions remain authoritative.
 // Clear visual layers only when a native target page actually replaces the chat list.
 const home=$('home');if(home){const panes=['chats','new','group','saved','scheduled','profile'];function reconcile(){
  if(app.dataset.screen!=='home')return;
  const visible=panes.filter(id=>$(id)&&!$(id).classList.contains('hidden'));
  if(visible.includes('chats')&&visible.some(x=>x!=='chats')){$('chats')?.classList.add('hidden');}
  if(visible.includes('chats')&&visible.length===1)app.classList.remove('luo-stale-native-page');
  for(const id of panes){const node=$(id);if(node&&!node.hasAttribute('aria-label'))node.setAttribute('aria-label',id==='new'?'Contacts':id[0].toUpperCase()+id.slice(1))}
 }
 const obs=new MutationObserver(reconcile);for(const id of panes){const node=$(id);if(node)obs.observe(node,{attributes:true,attributeFilter:['class']})} }
 // The native call dialog is created by calls.js. Style it by actual call kind without replacing its handlers.
 let observedDialog=null;
 function updateCall(){
  const dialog=$('luoCall');if(!dialog)return;
  if(dialog!==observedDialog){observedDialog=dialog;
   const title=$('callTitle');
   const obs=new MutationObserver(updateCall);if(title)obs.observe(title,{childList:true,characterData:true,subtree:true});
   obs.observe(dialog,{attributes:true,attributeFilter:['open']});
  }
  const title=($('callTitle')?.textContent||'').toLowerCase();
  const video=/video/.test(title),audio=/voice|audio/.test(title);
  if(video||audio){dialog.classList.toggle('luo-video-layout',video);dialog.classList.toggle('luo-audio-layout',!video)}
  const remote=$('callRemote');if(remote)remote.playsInline=true;
  const local=$('callLocal');if(local){local.playsInline=true;local.muted=true}
 }
 updateCall();if(!observedDialog)new MutationObserver(()=>{if($('luoCall'))updateCall()}).observe(document.body,{childList:true,subtree:false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startup,{once:true});else startup();
})();


/* Luo Chat integrated call buttons, contact photo and permission-respecting notifications. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const icon='/icon-192-e31a4725c0b4.png';
const glyphs={
 beginCall:'<path d="M7 4c0 8 5 13 13 13l-2 4c-9-.6-15.4-7-16-16z"/><path d="m15 4 5 0m-2-2v5"/>',
 acceptCall:'<path d="M3 12a15 15 0 0 1 18 0l-3 4-4-2-4 0-4 2z"/>',
 declineCall:'<path d="M3 16a15 15 0 0 1 18 0l-3 4-4-2-4 0-4 2z"/>',
 muteCall:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
 cameraCall:'<rect x="2" y="6" width="15" height="12" rx="3"/><path d="m17 10 5-3v10l-5-3"/>',
 switchCallCamera:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M9 10h6l-2-2m2 2-2 2M15 14H9l2-2m-2 2 2 2"/>',
 endCall:'<path d="M3 16q9-8 18 0l-3 4-5-2h-2l-5 2z"/>',
 closeCall:'<path d="m4 4 16 16M20 4 4 20"/>'
};
const captions={beginCall:'Call',acceptCall:'Answer',declineCall:'Decline',muteCall:'Mute',cameraCall:'Video',switchCallCamera:'Flip',endCall:'End',closeCall:'Close'};
function decorate(){
 const dialog=$('luoCall');if(!dialog)return;
 for(const [id,path] of Object.entries(glyphs)){
  const button=$(id);if(!button||!dialog.contains(button))continue;
  button.classList.add('luo-call-button');
  if(button.querySelector('.luo-call-glyph'))continue;
  const native=Array.from(button.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim();
  if(native)button.setAttribute('aria-label',native);
  const wrap=document.createElement('span');wrap.className='luo-call-glyph';wrap.setAttribute('aria-hidden','true');wrap.innerHTML='<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
  const cap=document.createElement('span');cap.className='luo-call-caption';cap.setAttribute('aria-hidden','true');cap.textContent=captions[id];
  button.prepend(wrap);button.append(cap);
 }
}
function avatar(){
 const dialog=$('luoCall');if(!dialog)return;
 const title=$('callTitle')?.textContent?.trim()||'',label=title.replace(/^(?:video|voice|audio)\s+call\s*[·:\\-]?\s*/i,'').trim();
 const inChat=$('roomtitle')?.textContent?.trim()||'';
 const picture=$('roomavatar');
 let identity=$('luoCallIdentity');
 if(!identity){identity=document.createElement('div');identity.id='luoCallIdentity';const grid=dialog.querySelector('.call-video-grid');if(grid)grid.before(identity);else dialog.append(identity)}
 let bubble=identity.querySelector('.luo-call-avatar');
 if(!bubble){bubble=document.createElement('div');bubble.className='luo-call-avatar';identity.prepend(bubble)}
 let text=identity.querySelector('.luo-call-name');
 if(!text){text=document.createElement('strong');text.className='luo-call-name';identity.append(text)}
 const name=label||inChat||'Luo Chat';
 text.textContent=name;
 const matching=!!(inChat&&label&&(label===inChat||label.includes(inChat)));
 const image=matching?picture?.querySelector('img'):null;
 const src=image?.currentSrc||image?.getAttribute('src');
 const nativeBg=matching?getComputedStyle(picture).backgroundImage:'none';
 let chosen=src&&/^(https?:|blob:|data:image\/|\/)/i.test(src)?src:null;
 if(!chosen&&nativeBg?.startsWith('url(')){const bg=nativeBg.slice(4,-1).replace(/^["']|["']$/g,'');if(/^https?:|^blob:/i.test(bg))chosen=bg}
 if(chosen){
  let img=bubble.querySelector('img');
  if(!img){img=document.createElement('img');img.alt='';img.className='luo-call-photo';img.onerror=()=>{img.remove();bubble.textContent=name.charAt(0).toUpperCase()||'L'};bubble.replaceChildren(img)}
  if(img.getAttribute('src')!==chosen)img.setAttribute('src',chosen);
 }else if(!bubble.querySelector('img')){bubble.textContent=name.charAt(0).toUpperCase()||'L'}
}
function callControls(){
 const dialog=$('luoCall');if(!dialog)return;
 decorate();if(dialog.open)avatar();
 const actions=dialog.querySelector('.device-actions');
 if(!actions||actions.querySelector('#luoSpeakerSelect'))return;
 const speaker=document.createElement('button');speaker.type='button';speaker.id='luoSpeakerSelect';speaker.className='luo-call-button';speaker.setAttribute('aria-label','Select speaker or audio output');speaker.innerHTML='<span class="luo-call-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4zM17 8c3 2 3 6 0 8M20 5c4 4 4 10 0 14"/></svg></span><span class="luo-call-caption">Speaker</span>';
 speaker.onclick=async()=>{
  const remote=$('callRemote');
  try{
    if(typeof remote?.setSinkId==='function'&&typeof navigator.mediaDevices?.selectAudioOutput==='function'){
      const output=await navigator.mediaDevices.selectAudioOutput();await remote.setSinkId(output.deviceId);
      speaker.setAttribute('aria-label','Audio output selected');speaker.classList.add('luo-speaker-selected');
    }else{
      const status=$('callStatus');if(status)status.textContent='Speaker routing is controlled by your phone or browser on this device.';
    }
  }catch(error){const status=$('callStatus');if(status)status.textContent='Audio output was not changed: '+(error?.message||'Permission required')}
 };
 const end=$('endCall');if(end&&actions.contains(end))actions.insertBefore(speaker,end);else actions.append(speaker);
}
function init(){
 if(window.__luoCallingAlertUpgrade)return;window.__luoCallingAlertUpgrade=true;
 const toast=document.createElement('button');toast.type='button';toast.id='luoNotificationToast';toast.hidden=true;
 const logo=document.createElement('img');logo.alt='';logo.src=icon;
 const texts=document.createElement('span');texts.className='luo-notification-text';const title=document.createElement('strong');title.textContent='Luo Chat';const summary=document.createElement('small');summary.textContent='New message';texts.append(title,summary);
 const close=document.createElement('span');close.className='luo-alert-close';close.textContent='×';close.setAttribute('aria-hidden','true');toast.append(logo,texts,close);
 toast.setAttribute('aria-label','Open Luo Chat notification');document.body.append(toast);
 let hideTimer=0,kind='message';
 function show(type){
  kind=type==='call'?'call':'message';
  summary.textContent=kind==='call'?'Incoming call':'You have a new message';
  toast.hidden=false;clearTimeout(hideTimer);hideTimer=setTimeout(()=>{toast.hidden=true},5800);
 }
 toast.addEventListener('click',()=>{
  toast.hidden=true;clearTimeout(hideTimer);
  if(kind==='call'){const incoming=document.querySelector('.incoming-call:not(.hidden) button');if(incoming){incoming.click();return}}
  const app=document.querySelector('.app');if(app?.dataset.screen==='room')$('back')?.click();
  document.querySelector('.workspace-nav button[data-tab="chats"]')?.click();
 });
 if(navigator.serviceWorker?.addEventListener){
  navigator.serviceWorker.addEventListener('message',event=>{
   if(event.origin!==location.origin)return;
   if(event.data?.type!=='LUO_PUSH_NOTICE')return;
   if(document.visibilityState==='visible')show(event.data.kind);
  });
 }
 const observer=new MutationObserver(()=>{if($('luoCall'))callControls()});
 observer.observe(document.body,{childList:true,subtree:false});
 const call=$('luoCall');
 if(call){
  const obs=new MutationObserver(()=>{callControls();if(call.open)avatar()});
  obs.observe(call,{attributes:true,attributeFilter:['open']});
  if($('callTitle'))obs.observe($('callTitle'),{childList:true,characterData:true,subtree:true});
  if($('roomavatar'))obs.observe($('roomavatar'),{childList:true,attributes:true,attributeFilter:['style','class','src']});
 }
 callControls();
 const acts=$('luoCall')?.querySelector('.device-actions');if(acts)new MutationObserver(()=>decorate()).observe(acts,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


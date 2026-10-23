import {createLuoCoreBrain,LUO_CORE_MOTIONS} from './luo-core-brain.js';
import {createLuoCoreRenderer} from './luo-core-renderer.js';
import {startInstalledLuoCoreOffline,saveLuoCoreOffline} from './luo-core-offline.js';

// This resident cat observes layout coordinates and message additions ONLY.
// It never examines message text, images, usernames or network traffic.
export function installLuoCore({win,getUser,random=Math.random}){
 const doc=win.document;
 let brain=createLuoCoreBrain({random});
 const root=doc.createElement('aside');
 root.className='luo-core-layer';
 root.setAttribute('aria-label','Luo Core cat companion');
 root.hidden=true;
 const canvas=doc.createElement('canvas');
 canvas.width=180;canvas.height=180;canvas.className='luo-core-character';
 canvas.tabIndex=0;canvas.setAttribute('role','button');
 canvas.setAttribute('aria-label','Luo Core the golden cat. Tap to pet; hold for play and sleep options.');
 canvas.title='Luo Core · Tap to pet. Hold for options.';
 const menu=doc.createElement('div');
 menu.className='luo-core-menu';menu.hidden=true;
 menu.setAttribute('role','group');menu.setAttribute('aria-label','Luo Core controls');
 const status=doc.createElement('span');
 status.className='luo-core-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const restore=doc.createElement('button');
 restore.type='button';restore.className='luo-core-restore';
 restore.textContent='Luo Core';restore.setAttribute('aria-label','Show Luo Core cat companion');
 restore.hidden=true;doc.body.append(root,restore);root.append(canvas,menu,status);
 const style=doc.createElement('style');style.id='luo-core-styles';
 style.textContent=`
 .luo-core-layer{position:fixed;inset:0;z-index:2100;pointer-events:none;overflow:hidden;contain:layout style;isolation:isolate}
 .luo-core-layer[hidden],.luo-core-menu[hidden],.luo-core-restore[hidden]{display:none!important}
 .luo-core-character{position:absolute;left:0;top:0;width:142px;height:142px;pointer-events:auto;outline:0;touch-action:none;cursor:pointer;will-change:transform;filter:drop-shadow(0 8px 10px #0007)}
 .luo-core-character:focus-visible{outline:2px solid #f5c66b;outline-offset:-3px;border-radius:40px}
 .luo-core-menu{position:fixed;z-index:2102;left:var(--luo-core-menu-x,16px);top:var(--luo-core-menu-y,20vh);pointer-events:auto;width:190px;padding:12px;border:1px solid #b28c4b;border-radius:17px;background:linear-gradient(155deg,#292018,#100e13);box-shadow:0 14px 36px #0008;color:#f5dfb8;display:grid;gap:7px}
 .luo-core-menu strong{font-size:13px;letter-spacing:.025em}
 .luo-core-menu button{min-height:39px;text-align:left;border-radius:9px;padding:7px 11px;color:#f5dfc0;border:1px solid #624b32;background:#251d17;font-size:13px}
 .luo-core-menu button:focus-visible{outline:2px solid #e7bb6b}
 .luo-core-status{position:fixed;pointer-events:none;left:var(--luo-core-status-x,50%);top:var(--luo-core-status-y,60%);transform:translate(-50%,-50%);color:#e7c384;text-shadow:0 2px 8px #000;font-size:12px}
 .luo-core-restore{position:fixed;right:9px;bottom:calc(80px + env(safe-area-inset-bottom));z-index:2101;pointer-events:auto;background:#21180e;color:#e9c681;border:1px solid #a47b43;border-radius:13px;padding:8px 10px;font-size:12px}
 @media(prefers-reduced-motion:reduce){.luo-core-character{will-change:auto}}
 `;
 doc.head.append(style);
 const renderer=createLuoCoreRenderer(canvas);
 let owner=null,enabled=true,manualUntil=0,disposed=false,frame=0,previous=0;
 let x=0,y=0,target=null,perchNode=null,nextJump=0,hopStart=0,hopFrom=null,hopTo=null,scrollDirty=true;
 let holdTimer=0,down=null,dragged=false,menuOpen=false,lastFrame=0,lastSignal=0;
 const reduced=!!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const connectionSave=!!win.navigator?.connection?.saveData;
 const animate=!reduced&&!connectionSave;
 const width=()=>win.innerWidth||390,height=()=>win.innerHeight||800;
 const active=()=>!!getUser()?.id&&doc.querySelector('.app')?.dataset.screen!=='auth'&&doc.querySelector('.app')?.dataset.screen!=='recovery';
 const pref=id=>{try{return win.localStorage.getItem('luo-core-enabled:'+id)!=='false'}catch{return true}};
 const store=()=>{if(!owner)return;try{win.localStorage.setItem('luo-core-enabled:'+owner,String(enabled))}catch{}};
 function setStatus(value){status.textContent=value||''}
 function changeOwner(){
  const id=active()?getUser().id:null;
  if(owner===id)return;
  owner=id;brain=createLuoCoreBrain({random});menu.hidden=true;menuOpen=false;target=null;perchNode=null;hopTo=null;nextJump=0;
  enabled=id?pref(id):false;
  root.hidden=!id||!enabled;restore.hidden=!id||enabled;
  if(id)startInstalledLuoCoreOffline(win);
  if(id&&enabled){x=width()-170;y=height()-260;setStatus('');renderer.render(brain.snapshot(),0,reduced)}
 }
 function showMenu(){
  if(!owner||!enabled)return;
  menu.hidden=false;menuOpen=true;
  menu.style.setProperty('--luo-core-menu-x',Math.round(Math.max(8,Math.min(width()-204,x+90)))+'px');
  menu.style.setProperty('--luo-core-menu-y',Math.round(Math.max(8,Math.min(height()-255,y-30)))+'px');
  menu.querySelector('button')?.focus();
 }
 function dismissMenu(){menuOpen=false;menu.hidden=true;}
 function typing(){return !!doc.activeElement?.matches?.('input,textarea,[contenteditable="true"]')}
 function roomVisible(){return !!doc.getElementById('room')?.classList.contains('active')}
 const buttons=[
  ['Pet Luo Core','pet','Purr...'],
  ['Play together','play','Time to play!'],
  ['Take a nap','nap','Sweet dreams...'],
  ['Jump to a message','jump','Coming over!'],
  ['Follow messages','follow','I will explore.'],
  ['Save HD model offline','offline',''],
  ['View high-detail 3D cat','gallery',''],
  ['Hide companion','hide','']
 ];
 for(const [label,command,response] of buttons){
  const button=doc.createElement('button');button.type='button';button.textContent=label;
  button.dataset.action=command;
  button.addEventListener('click',()=>{
   if(!owner)return;
   if(command==='hide'){
    enabled=false;store();root.hidden=true;restore.hidden=false;dismissMenu();return;
   }
   if(command==='offline'){
    setStatus('Saving full 3D cat offline…');dismissMenu();
    saveLuoCoreOffline(win,{force:true}).then(result=>setStatus(result.ready?'Full Luo Core model saved offline.':'Model not yet available. Check connection or storage.'));
    return;
   }
   if(command==='gallery'){
    dismissMenu();
    import('./luo-core-master-preview.js').then(module=>module.openLuoCoreMasterViewer(win)).catch(()=>setStatus('The high-detail viewer is unavailable on this device.'));
    return;
   }
   brain.command(command);setStatus(response);dismissMenu();
   if(command==='jump'||command==='follow')chooseAnchor(true);
   if(!animate)renderer.render(brain.snapshot(),0,true);
  });menu.append(button);
 }
 const title=doc.createElement('strong');title.textContent='LUO CORE · CAT COMPANION';menu.prepend(title);
 restore.addEventListener('click',()=>{
  if(!owner)return;enabled=true;store();restore.hidden=true;root.hidden=false;
  setStatus('Luo Core is back!');chooseAnchor(true);if(!animate)renderer.render(brain.snapshot(),0,true);
 });
 function candidates(){
  // Inspect only geometry of already-rendered message bubbles.
  const container=doc.getElementById('messages');if(!container||!roomVisible())return [];
  const els=container.querySelectorAll('.bubble,.message-bubble,.msg,[data-message-id],.message');
  const results=[];
  for(const node of Array.from(els).slice(-65)){
   const r=node.getBoundingClientRect?.();
   if(!r||r.width<24||r.height<10||r.top<136||r.top>height()-145||r.bottom<0)continue;
   if(results.some(a=>Math.abs(a.left-r.left)<4&&Math.abs(a.top-r.top)<4))continue;
   results.push({node,left:r.left,top:r.top,width:r.width,height:r.height});
  }
  return results;
 }
 function anchorPosition(rect){
  if(!rect)return {x:Math.max(3,width()-156),y:Math.max(8,height()-270)};
  return {x:Math.round(Math.max(3,Math.min(width()-145,rect.left+rect.width/2-73))),
          y:Math.round(Math.max(0,Math.min(height()-165,rect.top-130)))};
 }
 function chooseAnchor(force=false){
  if(!owner||!enabled||doc.visibilityState==='hidden'||menuOpen||typing())return;
  if(!force&&Date.now()<nextJump)return;
  const pool=candidates();
  const selection=pool.length?pool[Math.floor(random()*pool.length)%pool.length]:null;
  const dest=anchorPosition(selection);
  perchNode=selection?.node||null;
  nextJump=Date.now()+6500+Math.floor(random()*8000);
  if(Math.abs(dest.x-x)<10&&Math.abs(dest.y-y)<10){target=dest;return}
  if(!animate){x=dest.x;y=dest.y;target=dest;hopTo=null;brain.choose('sit');return}
  hopFrom={x,y};hopTo=dest;hopStart=Date.now();target=dest;
  brain.command('jump');
 }
 function measure(){
  if(!owner||!enabled||Date.now()<manualUntil)return;
  if(scrollDirty&&!hopTo&&perchNode){
   const bounds=perchNode.isConnected?perchNode.getBoundingClientRect?.():null;
   if(bounds&&roomVisible()&&bounds.top>=136&&bounds.top<=height()-145){
    const updated=anchorPosition(bounds);x=updated.x;y=updated.y;target=updated;
   }else{perchNode=null;nextJump=0}
  }
  if(!roomVisible()&&perchNode){perchNode=null;nextJump=0}
  scrollDirty=false;
  chooseAnchor();
 }
 function settle(t){
  if(!hopTo)return;
  const progress=Math.min(1,Math.max(0,(Date.now()-hopStart)/850));
  const ease=1-Math.pow(1-progress,3);
  x=hopFrom.x+(hopTo.x-hopFrom.x)*ease;
  y=hopFrom.y+(hopTo.y-hopFrom.y)*ease-Math.sin(progress*Math.PI)*46;
  if(progress===1){x=hopTo.x;y=hopTo.y;hopTo=null;hopFrom=null;brain.choose('land')}
 }
 function frameLoop(now){
  frame=0;if(disposed)return;
  changeOwner();
  if(owner&&enabled){
   if(doc.visibilityState!=='hidden'){
    const elapsed=previous?Math.min(150,now-previous):16;
    if(!animate||now-lastFrame>=33){
     measure();settle(now);const state=brain.tick(elapsed,{visible:true,motion:animate});
     canvas.style.transform='translate3d('+Math.round(x)+'px,'+Math.round(y)+'px,0)';
     status.style.setProperty('--luo-core-status-x',Math.round(x+71)+'px');
     status.style.setProperty('--luo-core-status-y',Math.round(Math.max(20,y-2))+'px');
     if(animate||!lastFrame)renderer.render(state,now,!animate);
     lastFrame=now;
    }
   }
  }
  previous=now;
  frame=win.requestAnimationFrame(frameLoop);
 }
 function eventScroll(){scrollDirty=true;brain.signal('scroll')}
 function additions(changes){
  if(!owner||!enabled||Date.now()-lastSignal<1400)return;
  for(const entry of changes){
   if(entry.type!=='childList'||!entry.addedNodes?.length)continue;
   if(entry.target.closest?.('#messages')||entry.target.id==='messages'){
    lastSignal=Date.now();brain.signal('new_message');scrollDirty=true;return;
   }
  }
 }
 const observer=typeof win.MutationObserver==='function'?new win.MutationObserver(additions):null;
 const messages=doc.getElementById('messages');
 if(messages)observer?.observe(messages,{childList:true,subtree:true});
 function press(e){
  if(!owner||!enabled)return;
  down={x:e.clientX,y:e.clientY};dragged=false;
  if(holdTimer)win.clearTimeout(holdTimer);
  holdTimer=win.setTimeout(()=>{holdTimer=0;if(down&&!dragged){showMenu();down=null}},540);
  try{canvas.setPointerCapture(e.pointerId)}catch{}
 }
 function move(e){
  if(!down)return;
  const dx=e.clientX-down.x,dy=e.clientY-down.y;
  if(Math.abs(dx)+Math.abs(dy)<9&&!dragged)return;
  dragged=true;
  if(holdTimer){win.clearTimeout(holdTimer);holdTimer=0}
  x=Math.max(0,Math.min(width()-145,x+dx));
  y=Math.max(0,Math.min(height()-145,y+dy));
  down={x:e.clientX,y:e.clientY};manualUntil=Date.now()+15000;hopTo=null;
 }
 function release(e){
  if(holdTimer){win.clearTimeout(holdTimer);holdTimer=0}
  if(!down)return;
  if(!dragged){brain.command('pet');setStatus('Purr...');if(!animate)renderer.render(brain.snapshot(),0,true)}
  down=null;dragged=false;
  try{canvas.releasePointerCapture(e.pointerId)}catch{}
 }
 function key(e){
  if(e.key==='Enter'){e.preventDefault();brain.command('pet');setStatus('Purr...');if(!animate)renderer.render(brain.snapshot(),0,true)}
  if(e.key===' '){e.preventDefault();showMenu()}
  if(e.key==='Escape')dismissMenu();
 }
 canvas.addEventListener('pointerdown',press);
 canvas.addEventListener('pointermove',move);
 canvas.addEventListener('pointerup',release);
 canvas.addEventListener('pointercancel',release);
 canvas.addEventListener('keydown',key);
 canvas.addEventListener('contextmenu',e=>{e.preventDefault();showMenu()});
 win.addEventListener('scroll',eventScroll,true);win.addEventListener('resize',eventScroll);
 doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='hidden')brain.signal('away')});
 const raf=win.requestAnimationFrame?.bind(win);
 if(raf)frame=raf(frameLoop);
 else changeOwner();
 return {
  get brain(){return brain},
  get mode(){return renderer.mode},
  get motionCount(){return LUO_CORE_MOTIONS.length},
  get visible(){return !root.hidden},
  refresh(){changeOwner();if(owner&&enabled)chooseAnchor(true)},
  signedOut(){owner=null;enabled=false;root.hidden=true;restore.hidden=true;dismissMenu();setStatus('')},
  dispose(){
   disposed=true;if(frame)win.cancelAnimationFrame?.(frame);
   if(holdTimer)win.clearTimeout(holdTimer);observer?.disconnect();
   win.removeEventListener('scroll',eventScroll,true);
   win.removeEventListener('resize',eventScroll);
   renderer.destroy();root.remove();restore.remove();style.remove();
  }
 };
}

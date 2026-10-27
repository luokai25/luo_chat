/* Luo secondary-screen V6. Real fields, explicit preview-only state and
   native server-authorized actions. No generated content or synthetic posts. */
(()=>{
'use strict';
const d=document,app=d.querySelector('.app');
if(!app||window.LuoSecondaryV6)return;
const $=id=>d.getElementById(id);
const make=(tag,klass,text)=>{const n=d.createElement(tag);if(klass)n.className=klass;if(text!==undefined)n.textContent=text;return n};
function storyComposer(){
 const form=$('storyForm'),body=$('storyBody'),media=$('storyMedia'),users=$('storyAudience'),music=$('storyMusic'),circle=$('storyCircle');
 if(!form||!body||!media||!users||!music||!circle||form.dataset.luoV6)return;
 form.dataset.luoV6='1';form.closest('dialog')?.classList.add('luo-v6-story');
 const preview=make('section','luo-v6-story-preview');preview.setAttribute('aria-label','Local story preview');
 const head=make('div','luo-v6-preview-header');
 const badge=make('b','','YOUR STORY · PREVIEW'),expiry=make('small','','Visible for 24 hours after publishing');
 head.append(badge,expiry);
 const mediaBox=make('div','luo-v6-story-media');const text=make('p','luo-v6-story-text');
 const attachment=make('small','luo-v6-story-file');const privacy=make('p','luo-v6-story-privacy');
 const counter=make('p','luo-v6-story-counter');counter.setAttribute('aria-live','polite');
 preview.append(head,mediaBox,text,attachment,privacy,counter);body.before(preview);
 let imageUrl=null,lastFile=undefined;
 function imageCleanup(){
  if(imageUrl&&typeof URL.revokeObjectURL==='function')URL.revokeObjectURL(imageUrl);
  imageUrl=null;lastFile=undefined;
 }
 const render=()=>{
  text.textContent=body.value.trim().slice(0,2000)||'Your story text appears here';
  const names=[...new Set(users.value.split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean))];
  const audienceMode=form.closest('dialog')?.dataset.storyAudienceMode||'onlyMe';
  privacy.textContent=audienceMode==='public'?'Public on Luo Chat · visible to signed-in members':
   audienceMode==='onlyMe'?'Only you can see this Story':
   audienceMode==='close'?'Close friends · '+names.length+' account'+(names.length===1?'':'s'):
   audienceMode==='except'?'My contacts except… · '+names.length+' eligible account'+(names.length===1?'':'s'):
   names.length?'Private audience: '+names.length+' account'+(names.length===1?'':'s')+' selected':
   'Only you can see this Story until you choose an audience';
  counter.textContent=body.value.length.toLocaleString()+' / 2,000 characters'+(music.value.trim()?' · Music link provided':'');
  const file=media.files?.[0];
  attachment.textContent=file?'Selected file: '+file.name.slice(0,120)+' · '+(file.size/1048576).toFixed(1)+' MB':'No media selected';
  if(file===lastFile&&mediaBox.childNodes.length)return;
  imageCleanup();lastFile=file||null;mediaBox.replaceChildren();
  if(file&&/^(image|video|audio)\//.test(file.type)&&typeof URL.createObjectURL==='function'){
   try{
    imageUrl=URL.createObjectURL(file);
    const tag=file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':'img';
    const preview=make(tag,'');preview.src=imageUrl;
    if(tag==='img')preview.alt='Local preview of selected image';
    else{preview.controls=true;preview.preload='metadata';}
    mediaBox.append(preview);
   }catch{mediaBox.append(make('p','','Media chosen. Preview unavailable on this device.'));}
  }else mediaBox.append(make('p','',file?'Media will be attached after you publish.':'Share a photo, short video, audio, or text.'));
 };
 for(const n of [body,users,music])n.addEventListener('input',render);
 media.addEventListener('change',render);circle.addEventListener('change',()=>queueMicrotask(render));
 form.closest('dialog')?.addEventListener('luo:story-audience-changed',render);
 form.closest('dialog')?.addEventListener('close',()=>{imageCleanup();mediaBox.replaceChildren();});
 window.addEventListener('pagehide',imageCleanup,{once:true});
 render();
}
function messageAction(){
 const dialog=$('messageActionDialog'),form=$('messageActionForm'),fields=$('messageActionFields'),heading=$('messageActionTitle');
 if(!dialog||!form||!fields||!heading||dialog.dataset.luoV6)return;
 dialog.dataset.luoV6='1';dialog.classList.add('luo-v6-action');
 const receipt=make('div','luo-v6-action-receipt');
 const caption=make('strong','','Action preview');
 const detail=make('p','','Choose a message action.');
 const count=make('small','','Only the original Save button submits changes.');
 receipt.append(caption,detail,count);fields.after(receipt);
 let pending=false;
 const refresh=()=>{
  const editable=fields.querySelector('textarea,input:not([type="password"]):not([type="hidden"])');
  const value=editable&&typeof editable.value==='string'?editable.value.trim():'';
  caption.textContent=(heading.textContent||'Message action').trim().slice(0,100);
  detail.textContent=value?value.slice(0,500):'Changes will be previewed here before you save.';
  count.textContent=editable&&editable.hasAttribute('maxlength')?(editable.value.length+' / '+editable.getAttribute('maxlength')+' characters'):'The original Save action remains responsible for saving.';
 };
 const obs=new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;refresh()})});
 obs.observe(fields,{childList:true,subtree:true});
 obs.observe(heading,{childList:true,characterData:true,subtree:true});
 fields.addEventListener('input',refresh);
 window.addEventListener('pagehide',()=>obs.disconnect(),{once:true});
 refresh();
}
function workspaceTools(){
 const dialog=$('workspaceDialog'),body=$('workspaceBody'),close=$('closeWorkspace');
 if(!dialog||!body||!close||dialog.dataset.luoV6)return;
 dialog.dataset.luoV6='1';dialog.classList.add('luo-v6-workspace');
 const search=make('input','luo-v6-tool-search');search.type='search';search.placeholder='Find a tool';search.setAttribute('aria-label','Find a conversation tool');
 const found=make('div','luo-v6-tool-results');found.setAttribute('role','list');found.setAttribute('aria-label','Matching real conversation tools');
 const note=make('p','luo-v6-tool-note','Tools shown below retain their original permissions and actions.');
 const wrap=make('section','luo-v6-tool-find');wrap.append(search,found,note);body.before(wrap);
 function render(){
  const query=search.value.toLocaleLowerCase().trim();
  found.replaceChildren();
  if(!query){note.textContent='Search existing tools in this conversation. No simulated actions.';return}
  const buttons=[...body.querySelectorAll('button,a[href]')].filter(x=>!x.disabled&&x.textContent?.toLocaleLowerCase().includes(query)).slice(0,12);
  note.textContent=buttons.length?buttons.length+' real action'+(buttons.length===1?'':'s')+' found':'No matching action in this conversation';
  for(const action of buttons){
   const hit=make('button','luo-v6-tool-hit',action.textContent.trim().slice(0,70));hit.type='button';
   hit.addEventListener('click',()=>action.click());found.append(hit);
  }
 }
 search.addEventListener('input',render);
 const observer=new MutationObserver(()=>{if(search.value.trim())render()});
 observer.observe(body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 render();
}
function avatar(){
 const dialog=$('avatarDialog'),image=$('avatarFull');
 if(!dialog||!image||dialog.dataset.luoV6)return;
 dialog.dataset.luoV6='1';dialog.classList.add('luo-v6-avatar');
 const controls=make('nav','luo-v6-avatar-controls');controls.setAttribute('aria-label','Profile photo zoom controls');
 let scale=1;const out=make('output','','100%');
 const draw=()=>{image.style.transform=scale===1?'':'scale('+scale+')';out.textContent=Math.round(scale*100)+'%'};
 for(const [label,delta] of [['Zoom out',-.25],['Zoom in',.25],['Reset zoom',0]]){
  if(label==='Zoom in')controls.append(out);
  const button=make('button','',label);button.type='button';
  button.addEventListener('click',()=>{scale=delta===0?1:Math.max(1,Math.min(3,scale+delta));draw()});
  controls.append(button);
 }
 image.after(controls);
 dialog.addEventListener('close',()=>{scale=1;draw()});
 draw();
}
function start(){storyComposer();messageAction();workspaceTools();avatar()}
window.LuoSecondaryV6={refresh:start};
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
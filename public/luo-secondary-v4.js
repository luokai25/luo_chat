/* Luo secondary screen V4. Enhances the existing server-backed workflows.
   No duplicate submit handlers and no simulated account, payment or user data. */
(()=>{
 'use strict';
 const d=document,app=d.querySelector('.app');
 if(!app||window.LuoSecondaryV4)return;
 const $=id=>d.getElementById(id);
 const node=(tag,cls,content)=>{const e=d.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e};
 const title=(parent,heading,subtitle)=>{
  if(parent.querySelector(':scope > .luo-secondary-context'))return;
  const item=node('div','luo-secondary-context');
  item.append(node('strong','',heading),node('small','',subtitle));
  parent.prepend(item);
 };
 function media(){
  const el=$('mediaViewer');if(!el||el.dataset.secondaryV4)return;el.dataset.secondaryV4='1';el.classList.add('luo-secondary-media');
  const close=$('closeMediaViewer');close?.setAttribute('aria-label','Close media viewer');
  const watcher=new MutationObserver(()=>{
   if(!el.open)return;
   const content=$('mediaContent'),image=content?.querySelector('img'),video=content?.querySelector('video'),audio=content?.querySelector('audio');
   el.dataset.luoMediaType=image?'image':video?'video':audio?'audio':'other';
  });watcher.observe(el,{attributes:true,attributeFilter:['open']});
  window.addEventListener('pagehide',()=>watcher.disconnect(),{once:true});
 }
 function shared(){
  const wrap=$('sharedFilters'),filter=$('mediaType'),dialog=$('sharedDialog');
  if(!wrap||!filter||!dialog||wrap.dataset.secondaryV4)return;
  wrap.dataset.secondaryV4='1';dialog.classList.add('luo-secondary-shared');
  const tabs=node('div','luo-shared-v4-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Shared file categories');
  const options=[['all','All'],['image/','Photos'],['video/','Videos'],['audio/','Audio'],['application/pdf','PDFs']];
  const buttons=new Map();
  for(const [value,label] of options){
   const button=node('button','luo-shared-v4-tab',label);button.type='button';button.dataset.type=value;
   button.addEventListener('click',()=>{
    filter.value=value;filter.dispatchEvent(new Event('change',{bubbles:true}));
    apply();
   });
   tabs.append(button);buttons.set(value,button);
  }
  function apply(){for(const [value,button] of buttons)button.setAttribute('aria-pressed',String(filter.value===value))}
  filter.addEventListener('change',apply);wrap.append(tabs);apply();
  const list=$('sharedList');list?.setAttribute('aria-label','Authorized conversation files and links');
 }
 function poll(){
  const dialog=$('pollDialog'),form=$('pollForm'),kind=$('pollKind'),options=$('pollOptions'),correct=$('quizCorrect');
  if(!form||!kind||!options||!correct||form.dataset.secondaryV4)return;
  form.dataset.secondaryV4='1';dialog?.classList.add('luo-secondary-poll');
  title(form,'Ask your conversation','Create a poll, quiz, or question for this chat.');
  const count=node('p','luo-secondary-meta');count.id='luoPollChoiceCount';count.setAttribute('aria-live','polite');
  options.after(count);
  function sync(){
   const rows=options.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   count.textContent=rows.length+' of 8 choices';
   const label=form.querySelector('label[for="quizCorrect"]');
   const quiz=kind.value==='quiz';correct.hidden=!quiz;if(label)label.hidden=!quiz;
   correct.disabled=!quiz;
  }
  for(const e of [kind,options])e.addEventListener(e===kind?'change':'input',sync);
  sync();
 }
 function schedule(){
  const dialog=$('scheduleDialog'),form=$('scheduleForm'),body=$('scheduledBody'),when=$('scheduledTime');
  if(!form||!body||!when||form.dataset.secondaryV4)return;
  form.dataset.secondaryV4='1';dialog?.classList.add('luo-secondary-schedule');
  title(form,'Send at the right moment','Your message stays scheduled until its delivery time.');
  const preview=node('div','luo-secondary-message-preview');
  const name=node('span','luo-secondary-meta','Message preview');
  const bubble=node('p','luo-secondary-preview-bubble','Your message will appear here.');
  preview.append(name,bubble);when.before(preview);
  function sync(){bubble.textContent=body.value.trim().slice(0,400)||'Your message will appear here.'}
  body.addEventListener('input',sync);sync();
 }
 function enhanceDialog(dialog){
  if(!dialog||dialog.nodeName!=='DIALOG'||dialog.dataset.luoSecondaryPaint)return;
  const permitted=/^(personDialog|personPhotoDialog|sharedDialog|mediaViewer|pollDialog|scheduleDialog|personalizeDialog|luoTools|deleteDialog|avatarDialog)$/.test(dialog.id)
   ||dialog.matches('.luo-feed-comments,.luo-dm-settings,.luo-capsule-dialog');
  if(!permitted)return;
  dialog.dataset.luoSecondaryPaint='1';
  dialog.classList.add('luo-secondary-v4');
  if(dialog.matches('.luo-feed-comments'))dialog.classList.add('luo-secondary-social-sheet');
  if(dialog.matches('.luo-dm-settings'))dialog.classList.add('luo-secondary-chat-detail');
  if(dialog.id==='personDialog')dialog.classList.add('luo-secondary-person');
  if(dialog.id==='pollDialog')dialog.classList.add('luo-secondary-poll');
  if(dialog.id==='scheduleDialog')dialog.classList.add('luo-secondary-schedule');
  if(dialog.id==='mediaViewer')dialog.classList.add('luo-secondary-media');
 }
 let observer=null;
 function start(){
  for(const dialog of d.querySelectorAll('dialog'))enhanceDialog(dialog);
  media();shared();poll();schedule();
  observer=new MutationObserver(records=>{
   for(const record of records)for(const added of record.addedNodes){
    if(added.nodeType!==1)continue;
    if(added.matches?.('dialog'))enhanceDialog(added);
    for(const child of added.querySelectorAll?.('dialog')||[])enhanceDialog(child);
   }
  });
  observer.observe(d.body,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>observer?.disconnect(),{once:true});
 }
 window.LuoSecondaryV4={refresh(){media();shared();poll();schedule();for(const element of d.querySelectorAll('dialog'))enhanceDialog(element)}};
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
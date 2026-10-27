/* Luo V5: working secondary screens. Only enhance authenticated, existing
   server-backed forms; never impersonate successful submissions or generate
   private records. No duplicate submit handlers. */
(()=>{
'use strict';
const d=document,app=d.querySelector('.app');
if(!app||window.LuoSecondaryV5)return;
const $=id=>d.getElementById(id);
const el=(tag,className,text)=>{const n=d.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n};
const title=(heading,small)=>{const n=el('div','luo-v5-section-header');n.append(el('b','',heading),el('small','',small));return n};
function shared(){
 const dialog=$('sharedDialog'),list=$('sharedList'),filters=$('sharedFilters');
 if(!dialog||!list||!filters||dialog.dataset.luoV5)return;
 dialog.dataset.luoV5='1';dialog.classList.add('luo-v5-shared');
 const info=el('div','luo-v5-result-count');info.setAttribute('role','status');info.setAttribute('aria-live','polite');
 list.before(info);
 let count=0;
 const refresh=()=>{
  if(!dialog.open)return;
  const loader=list.classList.contains('luo-skeleton-active')||list.getAttribute('aria-busy')==='true';
  count=[...list.children].filter(x=>!x.classList.contains('luo-skeleton-stage')&&!x.classList.contains('empty')&&!x.classList.contains('luo-skeleton-slow-message')).length;
  info.textContent=loader?'Loading shared content securely…':count?count+' loaded item'+(count===1?'':'s')+' · Only files you can access':list.textContent.trim()?list.textContent.trim().slice(0,100):'No files in this view';
 };
 let queued=false;
 const obs=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh()})});
 obs.observe(list,{childList:true,attributes:true,attributeFilter:['aria-busy','class']});
 obs.observe(dialog,{attributes:true,attributeFilter:['open']});
 filters.addEventListener('change',refresh);
 window.addEventListener('pagehide',()=>obs.disconnect(),{once:true});
 refresh();
}
function poll(){
 const form=$('pollForm'),kind=$('pollKind'),question=$('pollQuestion'),options=$('pollOptions'),correct=$('quizCorrect');
 if(!form||!kind||!question||!options||!correct||form.dataset.luoV5)return;
 form.dataset.luoV5='1';form.closest('dialog')?.classList.add('luo-v5-poll');
 const box=el('section','luo-v5-poll-preview');box.setAttribute('aria-label','Live poll preview');
 const head=title('How it will appear','Preview only. Votes are recorded after you publish.');
 const ask=el('h3','luo-v5-poll-question','Your question appears here');
 const choices=el('div','luo-v5-poll-choices');
 box.append(head,ask,choices);options.after(box);
 const sync=()=>{
  ask.textContent=question.value.trim().slice(0,500)||'Your question appears here';
  const rows=options.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,8);
  const quiz=kind.value==='quiz',index=Number(correct.value);
  choices.replaceChildren();
  for(let i=0;i<rows.length;i++){
   const button=el('button','luo-v5-poll-choice',rows[i]);button.type='button';
   button.setAttribute('aria-label',quiz?'Set option '+(i+1)+' as correct answer':'Preview option '+(i+1));
   button.setAttribute('aria-pressed',String(quiz&&index===i+1));
   if(quiz)button.addEventListener('click',()=>{correct.value=String(i+1);correct.dispatchEvent(new Event('input',{bubbles:true}));});
   else button.disabled=true;
   choices.append(button);
  }
  if(!rows.length)choices.append(el('p','luo-v5-placeholder','Add at least two choices to preview their layout.'));
  box.dataset.kind=kind.value;
 };
 for(const n of [kind,question,options,correct])n.addEventListener('input',sync);
 kind.addEventListener('change',sync);sync();
}
function schedule(){
 const form=$('scheduleForm'),time=$('scheduledTime'),body=$('scheduledBody');
 if(!form||!time||!body||form.dataset.luoV5)return;
 form.dataset.luoV5='1';form.closest('dialog')?.classList.add('luo-v5-schedule');
 const detail=el('div','luo-v5-time-receipt');detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');
 const heading=el('strong','','Delivery details');const moment=el('p','luo-v5-time-value');const length=el('p','luo-v5-time-note');
 detail.append(heading,moment,length);time.after(detail);
 const update=()=>{
  const selected=time.value?new Date(time.value):null;
  const valid=selected&&Number.isFinite(selected.getTime());
  const local=valid?new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(selected):'Choose a delivery date and time';
  moment.textContent=local;
  const seconds=valid?Math.round((selected.getTime()-Date.now())/1000):null;
  detail.dataset.state=!valid?'empty':seconds<=0?'invalid':'ready';
  length.textContent=!valid?'Time will be shown in your device’s local timezone.':
   seconds<=0?'This date is in the past. Select a future delivery time.':
   'Scheduled '+(seconds<3600?'in under an hour':seconds<86400?'later today':'for a future day')+
   ' · '+body.value.length.toLocaleString()+' characters';
 };
 for(const n of [body,time])n.addEventListener('input',update);
 time.addEventListener('change',update);update();
}
function media(){
 const dialog=$('mediaViewer'),target=$('mediaContent');
 if(!dialog||!target||dialog.dataset.luoV5)return;
 dialog.dataset.luoV5='1';dialog.classList.add('luo-v5-media');
 const tools=el('nav','luo-v5-media-zoom');tools.setAttribute('aria-label','Image viewing controls');
 const out=el('output','luo-v5-zoom-value','100%');
 let scale=1,current=null;
 const refresh=()=>{
  const img=dialog.open?target.querySelector('img'):null;
  if(img!==current){if(current)current.style.removeProperty('transform');scale=1;current=img;}
  tools.hidden=!img;
  if(img){img.style.transform='scale('+scale+')';img.style.transformOrigin='center center';out.textContent=Math.round(scale*100)+'%';}
 };
 const add=(name,delta,reset=false)=>{
  const b=el('button','luo-v5-zoom-button',name);b.type='button';
  b.setAttribute('aria-label',reset?'Reset image zoom':delta>0?'Zoom image in':'Zoom image out');
  b.addEventListener('click',()=>{
   if(!current)return;
   scale=reset?1:Math.max(1,Math.min(3,Math.round((scale+delta)*4)/4));
   refresh();
  });tools.append(b);
 };
 add('−',-.25);tools.append(out);add('+',.25);add('Reset',0,true);
 target.before(tools);
 const obs=new MutationObserver(refresh);
 obs.observe(target,{childList:true,subtree:true});
 obs.observe(dialog,{attributes:true,attributeFilter:['open']});
 dialog.addEventListener('close',()=>{if(current)current.style.removeProperty('transform');current=null;scale=1;refresh()});
 window.addEventListener('pagehide',()=>obs.disconnect(),{once:true});
 refresh();
}
function personalize(){
 const form=$('personalizeForm'),nickname=$('chatNickname'),theme=$('chatTheme'),accent=$('chatAccent'),
 font=$('chatFont'),bubble=$('chatBubbles'),emoji=$('chatEmoji');
 if(!form||!nickname||!theme||!accent||!font||!bubble||!emoji||form.dataset.luoV5)return;
 form.dataset.luoV5='1';form.closest('dialog')?.classList.add('luo-v5-personalize');
 const card=el('section','luo-v5-theme-preview');card.setAttribute('aria-label','Live local theme preview');
 const head=title('Your conversation preview','Appearance changes are saved only when you submit the original form.');
 const person=el('p','luo-v5-theme-person');
 const incoming=el('p','luo-v5-theme-incoming','This is a private chat preview.');
 const outgoing=el('p','luo-v5-theme-outgoing','Messages will look like this ✦');
 card.append(head,person,incoming,outgoing);
 const after=$('chatBubbles');after.after(card);
 const render=()=>{
  const name=nickname.value.trim().slice(0,50)||'Private conversation';
  person.textContent=(emoji.value.trim().slice(0,4)||'✦')+'  '+name;
  card.dataset.theme=['gold','midnight','aurora'].includes(theme.value)?theme.value:'gold';
  card.dataset.bubbles=['rounded','square','minimal'].includes(bubble.value)?bubble.value:'rounded';
  card.style.setProperty('--preview-accent',/^#[0-9a-f]{6}$/i.test(accent.value)?accent.value:'#e7c56f');
  card.style.fontFamily=font.value==='serif'?'Georgia,serif':font.value==='mono'?'ui-monospace,monospace':'system-ui,sans-serif';
 };
 for(const n of [nickname,theme,accent,font,bubble,emoji])n.addEventListener('input',render);
 for(const n of [theme,font,bubble])n.addEventListener('change',render);
 render();
}
function deleteAccount(){
 const form=$('deleteForm'),password=$('deletePassword'),phrase=$('deleteConfirmation');
 if(!form||!password||!phrase||form.dataset.luoV5)return;
 form.dataset.luoV5='1';form.closest('dialog')?.classList.add('luo-v5-delete');
 const panel=el('div','luo-v5-delete-gate');panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
 const a=el('p','','○ Luo Chat password entered');
 const b=el('p','','○ Confirmation phrase matches exactly');
 const note=el('small','','Account deletion is permanent. This screen does not store your password.');
 panel.append(title('Before you delete','Both requirements must be fulfilled.'),a,b,note);
 const actions=form.querySelector('.dialog-actions');actions?.before(panel);
 const sync=()=>{
  const hasPassword=password.value.length>0,confirmed=phrase.value==='DELETE MY ACCOUNT';
  a.textContent=(hasPassword?'✓ ':'○ ')+'Luo Chat password entered';
  b.textContent=(confirmed?'✓ ':'○ ')+'Confirmation phrase matches exactly';
  panel.dataset.complete=String(hasPassword&&confirmed);
 };
 password.addEventListener('input',sync);phrase.addEventListener('input',sync);sync();
}
function start(){shared();poll();schedule();media();personalize();deleteAccount();}
window.LuoSecondaryV5={refresh:start};
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
/* Luo Chat V7: enrich real secondary screens without creating submissions,
   inventing data or altering entitlement/authentication logic. */
(()=>{
'use strict';
const d=document,app=d.querySelector('.app');
if(!app||window.LuoSecondaryV7)return;
const $=id=>d.getElementById(id);
const make=(tag,className,text)=>{
 const item=d.createElement(tag);
 if(className)item.className=className;
 if(text!==undefined)item.textContent=String(text);
 return item;
};
function shortcutHelp(){
 const dialog=$('shortcutDialog'),list=dialog?.querySelector('.shortcut-list');
 if(!dialog||!list||dialog.dataset.luoV7)return;
 dialog.dataset.luoV7='1';dialog.classList.add('luo-v7-shortcuts');
 const search=make('input','luo-v7-shortcut-search');search.type='search';
 search.placeholder='Search keyboard shortcuts';search.setAttribute('aria-label','Filter keyboard shortcuts');
 const status=make('p','luo-v7-shortcut-status');status.setAttribute('aria-live','polite');
 const empty=make('p','luo-v7-shortcut-empty','No matching shortcuts. Try a different search.');
 empty.hidden=true;empty.setAttribute('role','status');
 list.before(search,status);list.after(empty);
 const rows=[...list.querySelectorAll(':scope > div')];
 function render(){
  const typed=search.value.trim().toLocaleLowerCase();const term=typed==='escape'?'esc':typed;let shown=0;
  for(const row of rows){row.hidden=!!term&&![...row.querySelectorAll('dt,dd')].some(field=>field.textContent.toLocaleLowerCase().includes(term));if(!row.hidden)shown++;}
  status.textContent=shown+' keyboard shortcut'+(shown===1?'':'s')+' available';
  empty.hidden=shown!==0;
 }
 search.addEventListener('input',render);
 search.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&search.value){event.preventDefault();event.stopPropagation();search.value='';render();}
 });
 render();
}
function attachmentPicker(){
 const sheet=$('luoDmAttachSheet'),file=$('mediaFile'),attach=$('attach');
 if(!sheet||!file||!attach||sheet.dataset.luoV7)return;
 sheet.dataset.luoV7='1';sheet.classList.add('luo-v7-attachments');
 sheet.setAttribute('role','group');sheet.setAttribute('aria-label','Choose an authorized chat attachment');
 const heading=make('div','luo-v7-attachment-head');
 heading.append(make('b','','Add to conversation'),
   make('small','','Choose media, a file, or a conversation tool.'));
 sheet.prepend(heading);
 const buttons=[...sheet.querySelectorAll('button')];
 for(const btn of buttons){
  btn.classList.add('luo-v7-attachment-action');
  const label=btn.textContent.trim();
  const glyph=make('span','luo-v7-attachment-glyph',
   label==='Camera'?'◎':label==='Document'?'▤':label==='Poll'?'≡':label==='Schedule message'?'◷':'▧');
  glyph.setAttribute('aria-hidden','true');
  btn.prepend(glyph);
 }
 const details=make('p','luo-v7-attachment-note',
 'Uploads are limited by the original file validation and chat permissions.');
 sheet.append(details);
 file.addEventListener('change',()=>{
  const selected=Array.from(file.files||[]);
  if(!selected.length){
   details.textContent='Uploads are limited by the original file validation and chat permissions.';
   return;
  }
  const bytes=selected.reduce((sum,item)=>sum+item.size,0);
  const unit=bytes>=1048576?'MB':'KB';
  const size=(bytes/(unit==='MB'?1048576:1024)).toFixed(1);
  details.textContent=selected.length===1
   ?'Selected: '+selected[0].name.slice(0,90)+' · '+size+' '+unit
   :selected.length+' files selected · '+size+' '+unit+' total';
 });
 sheet.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   event.stopPropagation();sheet.hidden=true;attach.setAttribute('aria-expanded','false');attach.focus();
  }
 });
}
function worldsCreatePanel(panel){
 if(!panel||panel.dataset.luoV7)return;
 panel.dataset.luoV7='1';panel.classList.add('luo-v7-worlds-form');
 const heading=panel.querySelector('h2')?.textContent.trim()||'Worlds';
 const fields=[...panel.querySelectorAll('.worlds-field')];
 const feedback=make('section','luo-v7-worlds-feedback');feedback.setAttribute('role','status');
 feedback.setAttribute('aria-live','polite');
 const title=make('strong','',heading+' preview');
 const detail=make('p','luo-v7-worlds-summary');
 const warnings=make('p','luo-v7-worlds-note');
 feedback.append(title,detail,warnings);
 panel.querySelector('.worlds-modal-buttons')?.before(feedback);
 const get=label=>fields.find(field=>{
  const heading=[...field.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join(' ').trim();
  return heading===label||field.querySelector(':scope > span, :scope > strong')?.textContent?.trim()===label;
 })?.querySelector('input,textarea,select');
 const name=get('World name')||get('Group name')||get('Channel name');
 const desc=get('Description');const visibility=get('Visibility');
 const members=get('Member usernames');
 function preview(){
  const label=name?.value.trim()||'Unnamed '+(heading.toLowerCase().includes('channel')?'channel':'space');
  const users=members?[...new Set(members.value.split(/[\n,;]+/).map(x=>x.trim().replace(/^@/,'').toLowerCase()).filter(Boolean))]:[];
  const invalid=users.filter(x=>!/^[a-z0-9_]{3,24}$/.test(x));
  detail.textContent=label.slice(0,100)+(desc?.value.trim()?' · '+desc.value.trim().slice(0,120):'');
  if(members)warnings.textContent=invalid.length
    ?invalid.length+' username'+(invalid.length===1?'':'s')+' need 3–24 letters, numbers or underscores.'
    :users.length+' unique invitee'+(users.length===1?'':'s')+'. Creation still requires server approval.';
  else if(visibility)warnings.textContent=visibility.value==='public'
    ?'Discoverable World. Membership and visibility are still enforced by the server.'
    :'Private World. Your server-side audience permissions remain authoritative.';
  else warnings.textContent='Your permissions will be checked when you create this channel.';
  feedback.dataset.valid=String(!invalid.length&&!!name?.value.trim());
  if(members){
   if(invalid.length){members.setAttribute('aria-invalid','true');}
   else members.removeAttribute('aria-invalid');
  }
 }
 for(const f of fields)f.querySelector('input,textarea,select')?.addEventListener('input',preview);
 for(const f of fields)f.querySelector('select')?.addEventListener('change',preview);
 preview();
}
function worldModals(){
 for(const panel of d.querySelectorAll('.worlds-modal'))worldsCreatePanel(panel);
}
function statusViewer(){
 const viewer=$('luoUpdatesV2Viewer'),reply=viewer?.querySelector('.luo-status-v2-reply');
 const input=reply?.querySelector('input');
 if(!viewer||!reply||!input||viewer.dataset.luoV7)return;
 viewer.dataset.luoV7='1';viewer.classList.add('luo-v7-status-viewer');
 const box=make('div','luo-v7-status-composer');
 const status=make('small','luo-v7-status-count');
 status.setAttribute('aria-live','polite');
 box.append(make('strong','','Reply to this status'),status);
 reply.before(box);
 const draw=()=>{const limit=input.maxLength;status.textContent=limit>0?input.value.length.toLocaleString()+' / '+limit.toLocaleString()+' characters':input.value.length.toLocaleString()+' characters';};
 input.addEventListener('input',draw);
 viewer.addEventListener('close',()=>{
  input.value='';draw();
 },{passive:true});
 const prev=viewer.querySelector('.luo-status-v2-hit-back');
 const next=viewer.querySelector('.luo-status-v2-hit-next');
 if(prev)prev.setAttribute('aria-label','View previous status');
 if(next)next.setAttribute('aria-label','View next status');
 draw();
}
let waiting=false;
function update(){shortcutHelp();attachmentPicker();worldModals();statusViewer();}
let observer;
function start(){
 update();
 observer=new MutationObserver(records=>{
  if(waiting||!records.some(x=>x.addedNodes?.length))return;
  waiting=true;queueMicrotask(()=>{waiting=false;update()});
 });
 observer.observe(d.body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>observer?.disconnect(),{once:true});
}
window.LuoSecondaryV7={refresh:update};
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

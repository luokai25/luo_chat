/* Luo secondary surfaces V8: enhance authorized lists, never replace their data handlers. */
(()=>{
 'use strict';
 const d=document,app=d.querySelector('.app');
 if(!app||window.LuoSecondaryV8)return;
 const $=id=>d.getElementById(id);
 const element=(tag,cls,label)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(label!==undefined)n.textContent=label;return n};
 const cleanups=[];
 const watch=(target,render)=>{const observer=new MutationObserver(records=>{
  if(records.some(record=>record.type==='childList'))render();
 });observer.observe(target,{childList:true});cleanups.push(()=>observer.disconnect())};
 const fire=(control,event)=>control.dispatchEvent(new Event(event,{bubbles:true}));
 const status=(label)=>{const n=element('p','luo-v8-summary',label);n.setAttribute('role','status');n.setAttribute('aria-live','polite');return n};
 const button=(label,action)=>{const n=element('button','luo-v8-clear',label);n.type='button';n.addEventListener('click',action);return n};

 function vault(){
  const panel=$('saved'),list=$('savedList'),query=$('vaultSearch'),collection=$('vaultCollection');
  if(!panel||!list||!query||!collection||panel.dataset.luoV8)return;
  panel.dataset.luoV8='1';panel.classList.add('luo-v8-vault');
  const head=element('div','luo-v8-list-tools'),summary=status('Your private vault'),reset=button('Clear filters',()=>{
   query.value='';collection.value='';
   fire(query,'input');fire(collection,'change');query.focus();render();
  });
  head.append(summary,reset);list.before(head);
  function render(){
   const count=list.querySelectorAll(':scope > article.collection-card').length;
   const filtering=!!query.value.trim()||!!collection.value;
   reset.hidden=!filtering;
   const loading=/^Loading/i.test(list.textContent.trim())&&!count;
   summary.textContent=loading?'Loading your vault…':
    count?count+' matching saved item'+(count===1?'':'s')+' in this view'+(filtering?' · Filtered':''):
    filtering?'No items match these filters':'Your private vault';
  }
  query.addEventListener('input',render);collection.addEventListener('change',render);
  watch(list,render);render();
 }

 function schedules(){
  const panel=$('scheduled'),list=$('scheduledList'),refresh=$('refreshScheduled');
  if(!panel||!list||!refresh||panel.dataset.luoV8)return;
  panel.dataset.luoV8='1';panel.classList.add('luo-v8-schedules');
  const bar=element('div','luo-v8-schedule-tools');
  const field=element('label','luo-v8-filter-label','Filter by status');
  const select=element('select','luo-v8-status-filter');
  select.setAttribute('aria-label','Filter loaded scheduled messages by status');
  for(const [value,label] of [['','All statuses'],['pending','Pending'],['sent','Sent'],['failed','Failed'],['cancelled','Cancelled']]){
   const choice=element('option','',label);choice.value=value;select.append(choice);
  }
  field.append(select);
  const search=element('input','luo-v8-schedule-search');search.type='search';
  search.placeholder='Search loaded scheduled texts';search.setAttribute('aria-label','Search loaded scheduled message texts');
  const clear=button('Reset',()=>{select.value='';search.value='';render();search.focus()});
  const summary=status('Scheduled message history');
  const empty=element('p','luo-v8-no-results','No loaded scheduled messages match. Change the filters or refresh.');
  empty.hidden=true;
  bar.append(field,search,clear);list.before(bar,summary);list.after(empty);
  const hint=element('p','luo-v8-schedule-hint','Search and status filters apply to the 100 most recent scheduled messages loaded from your account.');
  empty.after(hint);
  function render(){
   const records=[...list.querySelectorAll(':scope > article.collection-card')];
   const state=select.value,term=search.value.trim().toLocaleLowerCase();
   let shown=0;
   for(const record of records){
    const current=record.querySelector('strong[class*="status-"]');
    const kind=[...(current?.classList||[])].find(cls=>cls.startsWith('status-'))?.slice(7)||'';
    const text=record.querySelector('p')?.textContent?.toLocaleLowerCase()||'';
    const visible=(!state||kind===state)&&(!term||text.includes(term));
    record.hidden=!visible;
    if(visible)shown++;
   }
   const filtered=!!state||!!term;
   clear.hidden=!filtered;
   empty.hidden=!filtered||shown>0||records.length===0;
   const loading=/^Loading/i.test(list.textContent.trim())&&!records.length;
   summary.textContent=loading?'Loading scheduled messages…':
    records.length?shown+' of '+records.length+' scheduled message'+(records.length===1?'':'s')+' shown':
    'No scheduled messages loaded';
  }
  select.addEventListener('change',render);search.addEventListener('input',render);
  watch(list,render);render();
 }

 function people(){
  const panel=$('new'),list=$('contactList'),search=$('contactSearch');
  if(!panel||!list||!search||panel.dataset.luoV8)return;
  panel.dataset.luoV8='1';panel.classList.add('luo-v8-people');
  const row=element('div','luo-v8-contacts-tools'),summary=status('Saved contacts');
  const clear=button('Clear search',()=>{search.value='';fire(search,'input');search.focus();render()});
  row.append(summary,clear);list.before(row);
  function render(){
   clear.hidden=!search.value;
   const count=list.querySelectorAll(':scope > .contact-row').length;
   const loading=/^Loading/i.test(list.textContent.trim())&&!count;
   summary.textContent=loading?'Loading contacts…':count?count+' matching contact'+(count===1?'':'s'):(search.value.trim()?'No matching contacts':'Saved contacts');
  }
  search.addEventListener('input',render);
  watch(list,render);render();
 }

 function shared(){
  const dialog=$('sharedDialog'),search=$('mediaSearch'),kind=$('mediaType'),filter=$('sharedFilters');
  if(!dialog||!search||!kind||!filter||dialog.dataset.luoV8)return;
  dialog.dataset.luoV8='1';dialog.classList.add('luo-v8-shared');
  const reset=button('Clear media filters',()=>{
   search.value='';kind.value='all';
   fire(search,'input');fire(kind,'change');search.focus();sync();
  });
  filter.append(reset);
  const sync=()=>{reset.hidden=!search.value.trim()&&kind.value==='all'};
  search.addEventListener('input',sync);kind.addEventListener('change',sync);
  sync();
 }

 function refresh(){vault();schedules();people();shared()}
 window.LuoSecondaryV8={refresh};
 const start=()=>{refresh();window.addEventListener('pagehide',()=>{for(const done of cleanups)done()},{once:true})};
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

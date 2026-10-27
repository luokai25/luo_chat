import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html=await readFile('public/index.html','utf8');
const source=await readFile('public/luo-secondary-v8.js','utf8');
const styles=await readFile('public/luo-secondary-v8.css','utf8');
function setup(){
 const dom=new JSDOM(html,{url:'https://luo-chat-luokai25.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 w.eval(source);d.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,d,close(){w.dispatchEvent(new w.Event('pagehide'));w.close()}};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));

test('V8 enhances existing app views without replacing native actions or making network requests',()=>{
 const x=setup();try{
  for(const id of ['saved','scheduled','new','sharedDialog'])assert.equal(x.d.getElementById(id).dataset.luoV8,'1',id);
  for(const id of ['refreshSaved','refreshScheduled','refreshContacts','closeShared','loadMoreShared'])assert.ok(x.d.getElementById(id),id);
  assert.match(html,/href="\/luo-secondary-v8\.css"/);assert.match(html,/src="\/luo-secondary-v8\.js"/);
  assert.match(styles,/prefers-reduced-motion:reduce/);assert.match(styles,/\[hidden\]\{display:none/);
  assert.doesNotMatch(source,/supabase|fetch\(|billing|\.rpc\(/i);
 }finally{x.close()}
});

test('scheduled message filter preserves actual cancel and open-chat action handlers',async()=>{
 const x=setup();try{
  const d=x.d,list=d.getElementById('scheduledList'),filter=d.querySelector('.luo-v8-status-filter'),search=d.querySelector('.luo-v8-schedule-search');
  list.replaceChildren();let cancelClicks=0;
  const card=(state,body)=>{
   const row=d.createElement('article');row.className='collection-card';
   const label=d.createElement('strong');label.className='status-'+state;label.textContent=state.toUpperCase();
   const text=d.createElement('p');text.textContent=body;
   const action=d.createElement('button');action.textContent='Cancel scheduled send';action.addEventListener('click',()=>cancelClicks++);
   row.append(label,text,action);return row;
  };
  list.append(card('pending','Meet at the library'),card('sent','Call tomorrow'),card('failed','Draft follow-up'));await tick();
  filter.value='pending';filter.dispatchEvent(new x.w.Event('change',{bubbles:true}));
  assert.deepEqual([...list.querySelectorAll('article')].map(row=>row.hidden),[false,true,true]);
  assert.match(d.querySelector('.luo-v8-schedules .luo-v8-summary').textContent,/1 of 3/);
  list.querySelector('button').click();assert.equal(cancelClicks,1);
  search.value='no matching text';search.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.equal(d.querySelector('.luo-v8-no-results').hidden,false);
  d.querySelector('.luo-v8-schedules .luo-v8-clear').click();
  assert.equal(filter.value,'');assert.equal(search.value,'');
  assert.deepEqual([...list.querySelectorAll('article')].map(row=>row.hidden),[false,false,false]);
  assert.equal(d.querySelector('.luo-v8-no-results').hidden,true);
 }finally{x.close()}
});

test('vault clear filters calls original search and collection listeners instead of replacing data',async()=>{
 const x=setup();try{
  const d=x.d,list=d.getElementById('savedList'),q=d.getElementById('vaultSearch'),col=d.getElementById('vaultCollection');
  const article=d.createElement('article');article.className='collection-card';article.textContent='Real saved message';list.replaceChildren(article);await tick();
  assert.match(d.querySelector('.luo-v8-vault .luo-v8-summary').textContent,/1 matching saved item/);
  const option=d.createElement('option');option.value='Notes';option.textContent='Notes';col.append(option);
  let queries=0,collections=0;
  q.addEventListener('input',()=>queries++);col.addEventListener('change',()=>collections++);
  q.value='library';col.value='Notes';q.dispatchEvent(new x.w.Event('input',{bubbles:true}));col.dispatchEvent(new x.w.Event('change',{bubbles:true}));
  const clear=d.querySelector('.luo-v8-vault .luo-v8-clear');
  assert.equal(clear.hidden,false);clear.click();
  assert.equal(q.value,'');assert.equal(col.value,'');
  assert.ok(queries>=2&&collections>=2);
  assert.ok(list.contains(article),'V8 must not replace private saved items');
  assert.equal(clear.hidden,true);
 }finally{x.close()}
});

test('contacts search reset retains original input event and native contact cards',async()=>{
 const x=setup();try{
  const d=x.d,search=d.getElementById('contactSearch'),list=d.getElementById('contactList');
  const contact=d.createElement('article');contact.textContent='Actual contact';list.replaceChildren(contact);await tick();
  let inputEvents=0;search.addEventListener('input',()=>inputEvents++);
  search.value='alice';search.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  const clear=d.querySelector('.luo-v8-contacts-tools .luo-v8-clear');
  assert.equal(clear.hidden,false);clear.click();
  assert.equal(search.value,'');assert.equal(inputEvents,2);
  assert.ok(list.contains(contact));
 }finally{x.close()}
});

test('shared media reset restores native media type and filename filters',()=>{
 const x=setup();try{
  const d=x.d,q=d.getElementById('mediaSearch'),type=d.getElementById('mediaType');
  let changed=0,typed=0;type.addEventListener('change',()=>changed++);q.addEventListener('input',()=>typed++);
  type.value='image/';q.value='photo';type.dispatchEvent(new x.w.Event('change',{bubbles:true}));
  const reset=d.querySelector('.luo-v8-shared .luo-v8-clear');
  assert.equal(reset.hidden,false);reset.click();
  assert.equal(type.value,'all');assert.equal(q.value,'');assert.equal(changed,2);assert.equal(typed,1);
  assert.equal(reset.hidden,true);
 }finally{x.close()}
});

test('loading and empty states do not invent scheduled records',async()=>{
 const x=setup();try{
  const d=x.d,list=d.getElementById('scheduledList');
  list.textContent='Loading schedules…';await tick();
  assert.equal(list.querySelectorAll('article').length,0);
  assert.match(d.querySelector('.luo-v8-schedules .luo-v8-summary').textContent,/Loading/);
  list.textContent='Use the clock beside the composer to schedule a text message.';await tick();
  assert.equal(d.querySelector('.luo-v8-no-results').hidden,true);
  assert.equal(list.querySelectorAll('article').length,0);
 }finally{x.close()}
});

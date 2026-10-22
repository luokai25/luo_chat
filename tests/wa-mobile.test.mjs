import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
test('mobile stylesheet keeps all features and uses the five-tab layout',async()=>{
 const css=await readFile('public/luo-wa-mobile.css','utf8');
 for(const selector of ['#chatlist','#messages','#room #sendform','.luo-wa-filters','.workspace-nav','#luoWaComposeFab','data-tab="new"','max-width:370px','safe-area-inset-bottom'])assert.ok(css.includes(selector),selector);
 assert.doesNotMatch(css,/service_role|SUPABASE_SERVICE_ROLE_KEY|document\.cookie/i);
});
test('mobile filter chips call the original select and compose handlers',async()=>{
 const dom=new JSDOM('<!doctype html><div id="home"><div id="chats"><div class="toolbar"></div></div><button id="inboxCompose">Compose</button></div><select id="inboxFilter"><option value="active">Inbox</option><option value="unread">Unread</option><option value="archived">Archived</option></select><nav class="workspace-nav"><button data-tab="group">Groups</button><button data-tab="new">People</button><button id="luoModernMore">More</button></nav><dialog id="luoMoreDialog"></dialog>',{runScripts:'dangerously',url:'https://luo-chat-luokai25.vercel.app/'});
 const {window:w}=dom;let updates=0,composed=0,groups=0,people=0;w.document.getElementById('inboxFilter').addEventListener('change',()=>updates++);w.document.getElementById('inboxCompose').addEventListener('click',()=>composed++);w.document.querySelector('[data-tab="group"]').addEventListener('click',()=>groups++);w.document.querySelector('[data-tab="new"]').addEventListener('click',()=>people++);
 w.eval(await readFile('public/luo-wa-mobile.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const click=(val)=>w.document.querySelector('[data-filter="'+val+'"]').click();
 assert.equal(w.document.querySelectorAll('.luo-wa-filter').length,4);
 click('unread');assert.equal(w.document.getElementById('inboxFilter').value,'unread');assert.equal(updates,1);
 assert.equal(w.document.querySelector('[data-filter="unread"]').getAttribute('aria-pressed'),'true');
 click('groups');assert.equal(groups,1);
 w.document.getElementById('luoWaComposeFab').click();assert.equal(composed,1);
 w.document.getElementById('luoModernMore').click();await Promise.resolve();
 w.document.querySelector('[data-luo-wa-people]').click();assert.equal(people,1);
 click('archived');assert.equal(updates,2);
 w.close();
});
test('mobile style installer is idempotent',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'luo-mobile-'));
 try{
  await mkdir(join(dir,'public'));
  await writeFile(join(dir,'public/luo-modern.css'),'/* original */\n');
  await writeFile(join(dir,'public/luo-wa-mobile.css'),await readFile('public/luo-wa-mobile.css','utf8'));
  await writeFile(join(dir,'public/index.html'),'<html><body></body></html>');
  const script=join(dir,'install.mjs');await writeFile(script,await readFile('scripts/apply-wa-mobile.mjs','utf8'));
  execFileSync(process.execPath,[script],{cwd:dir});
  const css=await readFile(join(dir,'public/luo-modern.css'),'utf8'),html=await readFile(join(dir,'public/index.html'),'utf8');
  execFileSync(process.execPath,[script],{cwd:dir});
  assert.equal(await readFile(join(dir,'public/luo-modern.css'),'utf8'),css);
  assert.equal(await readFile(join(dir,'public/index.html'),'utf8'),html);
  assert.equal(html.split('/luo-wa-mobile.js').length-1,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});
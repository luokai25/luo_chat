import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {JSDOM} from 'jsdom';
test('real chats header is visible, search and more still use original actions',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><div class="app-header"><div class="logo"><img src="/logo.svg"></div></div><section id="chats"><div class="inbox-heading"><h2>Messages <span id="inboxUnread">4</span></h2></div><input id="search"></section><nav class="workspace-nav"><button id="luoModernMore">More</button></nav></body></html>',{runScripts:'dangerously'});
 const w=dom.window;let count=0;w.document.getElementById('luoModernMore').onclick=()=>count++;
 w.eval(await readFile('public/luo-wa-visible.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 assert.equal(w.document.querySelectorAll('#luoWaTop').length,1);
 assert.match(w.document.querySelector('#luoWaTop').textContent,/Luo Chat/);
 assert.equal(w.document.querySelector('#chats h2').textContent.trim(),'Chats 4');
 assert.ok(w.document.getElementById('inboxUnread'));
 w.document.querySelector('[aria-label="Search chats"]').click();assert.equal(w.document.activeElement.id,'search');
 w.document.querySelector('[aria-label="More options"]').click();assert.equal(count,1);
 w.close();
});
test('mobile CSS makes phone layout distinctive',async()=>{const s=await readFile('public/luo-wa-visible.css','utf8');assert.ok(s.includes('max-width:999px'));assert.ok(s.includes('app-header{display:none!important}'));assert.ok(s.includes('#luoWaTop'))});
test('service-worker cache identifier changes with mobile revision',async()=>{
 const d=await mkdtemp(join(tmpdir(),'luo-revision-'));
 try{await mkdir(join(d,'public'));await mkdir(join(d,'dist'));
 for(const f of ['luo-wa-visible.js','luo-wa-visible.css'])await writeFile(join(d,'public',f),await readFile('public/'+f));
 await writeFile(join(d,'dist/sw.js'),"const CACHE='luo-chat-old',SHELL=[]");
 await writeFile(join(d,'dist/index.html'),'<head></head><script src="/luo-wa-mobile.js"></script><script src="/luo-wa-visible.js"></script><link href="/luo-modern.css">');
 const f=join(d,'refresh.mjs');await writeFile(f,await readFile('scripts/mobile-cache-refresh.mjs','utf8'));
 execFileSync(process.execPath,[f],{cwd:d});
 assert.match(await readFile(join(d,'dist/sw.js'),'utf8'),/const CACHE='luo-chat-[a-f0-9]{12}'/);
 assert.match(await readFile(join(d,'dist/index.html'),'utf8'),/name="luo-ui-revision"/);
 }finally{await rm(d,{recursive:true,force:true})}
});

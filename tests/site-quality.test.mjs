import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,readdir,rm,access} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {JSDOM} from 'jsdom';import vm from 'node:vm';
import {enhanceSite,SITE} from '../scripts/site-quality.mjs';import {compressPNG} from '../scripts/optimize-png.mjs';import {installTelemetry} from '../src/telemetry.js';
test('all generated public pages have unique metadata, canonical clean slugs, one H1, valid headings and local targets',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'luo-site-test-'));try{
  await cp('public',dir,{recursive:true});await enhanceSite(dir);const titles=new Set(),descriptions=new Set();
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.html')&&f!=='agent-checkout.html')){const dom=new JSDOM(await readFile(join(dir,file),'utf8'),{url:SITE});const d=dom.window.document;
   try{assert.equal(d.querySelectorAll('h1').length,1,file);assert.ok(!titles.has(d.title));titles.add(d.title);
    const description=d.querySelector('meta[name=description]').content;assert.ok(description.length>50);assert.ok(!descriptions.has(description));descriptions.add(description);
    assert.equal(d.querySelectorAll('link[rel=canonical]').length,1);assert.equal(d.querySelector('link[rel=canonical]').href,SITE+(file==='index.html'?'/':'/'+file.slice(0,-5)));
    assert.equal(d.querySelector('meta[name=robots]').content,'index,follow');assert.equal(d.querySelector('meta[property="og:image"]').content,SITE+'/og-image.png');assert.equal(d.querySelector('[itemtype="https://schema.org/WebPage"] [itemprop=name]').content,d.title);
    let level=0;for(const h of d.querySelectorAll('h1,h2,h3,h4,h5,h6')){const n=Number(h.tagName[1]);assert.ok(n<=level+1,`${file}: skipped ${level} to ${n}`);level=n}
    for(const image of d.querySelectorAll('img')){assert.ok(image.hasAttribute('alt'),file);assert.ok(image.hasAttribute('width')&&image.hasAttribute('height'),'Reserve image layout space')}
    for(const e of d.querySelectorAll('[href],[src]')){const raw=e.getAttribute('href')||e.getAttribute('src');if(!raw.startsWith('/'))continue;const p=new URL(raw,SITE).pathname;if(p==='/')continue;if(p==='/app.js'||p.startsWith('/api/'))continue;try{await access(dir+p)}catch{await access(dir+p+'.html')}}
   }finally{dom.window.close()}
  }
  const sitemap=new JSDOM(await readFile(dir+'/sitemap.xml','utf8'),{contentType:'application/xml'});assert.ok(sitemap.window.document.querySelectorAll('loc').length>=12,'Sitemap preserves all generated public pages');for(const loc of sitemap.window.document.querySelectorAll('loc'))assert.ok(!loc.textContent.endsWith('.html'));sitemap.window.close();
  const png=await readFile(dir+'/og-image.png');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);assert.ok(compressPNG(png).length<=png.length);
 }finally{await rm(dir,{recursive:true,force:true})}
});
const consentScript=await readFile('public/cookie-consent.js','utf8');
function browser({stored,blocked=false,broken=false}={}){const dom=new JSDOM('<!doctype html><body></body>',{url:SITE,runScripts:'outside-only'}),w=dom.window;if(stored)w.localStorage.setItem('luo-consent-v1',JSON.stringify(stored));if(blocked)Object.defineProperty(w.navigator,'globalPrivacyControl',{value:true});if(broken)Object.defineProperty(w,'localStorage',{get(){throw Error('blocked')}});w.eval(consentScript);return dom}
test('cookie choices default off, equal refusal works, withdrawal stops installed diagnostics',()=>{
 const dom=browser(),w=dom.window;try{assert.equal(w.luoDiagnosticsAllowed(),false);let count=0;w.fetch=async()=>{count++};installTelemetry(w);w.dispatchEvent(new w.ErrorEvent('error',{error:Error('private')}));assert.equal(count,0);
  [...w.document.querySelectorAll('button')].find(b=>b.textContent==='Allow diagnostics').click();assert.equal(w.luoDiagnosticsAllowed(),true);w.dispatchEvent(new w.ErrorEvent('error',{error:Error('private')}));assert.equal(count,1);
  w.document.querySelector('.luo-cookie-settings').click();[...w.document.querySelectorAll('button')].find(b=>b.textContent==='Reject optional').click();assert.equal(w.luoDiagnosticsAllowed(),false);w.dispatchEvent(new w.Event('unhandledrejection'));assert.equal(count,1);
 }finally{dom.window.close()}
});
test('privacy signals, expired choices and malformed storage never enable diagnostics',()=>{
 for(const options of [{blocked:true,stored:{version:1,diagnostics:true,at:Date.now()}},{stored:{version:1,diagnostics:true,at:0}},{stored:{version:1,diagnostics:'yes',at:Date.now()}},{broken:true}]){const dom=browser(options);try{assert.equal(dom.window.luoDiagnosticsAllowed(),false);if(options.blocked)assert.ok([...dom.window.document.querySelectorAll('button')].some(b=>b.disabled))}finally{dom.window.close()}}
});
test('public navigation never overwrites the offline application shell',async()=>{
 const source=await readFile('build.mjs','utf8');const worker=source.match(/self.addEventListener\('fetch',event=>\{[^\n]+/)[0];let handle;const writes=[];const listeners={};
 const context={self:{location:{origin:SITE},addEventListener:(n,f)=>listeners[n]=f},URL,fetch:async()=>({ok:true,clone(){return this}}),caches:{open:async()=>({put:async(...args)=>writes.push(args)}),match:async()=> 'offline-app'},CACHE:'fixture',SHELL:[]};vm.runInNewContext(worker.replaceAll('\\\\','\\'),context);
 for(const path of ['/privacy','/privacy.html','/help','/missing']){let intercepted=false;listeners.fetch({request:{method:'GET',url:SITE+path,mode:'navigate'},respondWith(){intercepted=true}});assert.equal(intercepted,false,path)}
 listeners.fetch({request:{method:'GET',url:SITE+'/',mode:'navigate'},respondWith(p){handle=p}});await handle;assert.equal(writes.length,1);assert.equal(writes[0][0],'/index.html');
});
test('hosting keeps API noindex separate from public pages and enforces security headers',async()=>{
 const c=JSON.parse(await readFile('vercel.json','utf8'));assert.equal(c.cleanUrls,true);const headers=c.headers.find(r=>r.source==='/(.*)').headers;const csp=headers.find(h=>h.key==='Content-Security-Policy').value;assert.match(csp,/upgrade-insecure-requests/);assert.doesNotMatch(csp,/script-src[^;]*unsafe-inline/);assert.ok(headers.some(h=>h.key==='Strict-Transport-Security'));assert.ok(c.headers.find(r=>r.source==='/api/(.*)').headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex')));
});

test('transactional checkout is intentionally noindex and cannot grant paid access',async()=>{
 const html=await readFile('public/agent-checkout.html','utf8');
 const doc=new JSDOM(html).window.document;
 try{
  assert.equal(doc.querySelector('meta[name=robots]').content,'noindex,nofollow');
  assert.equal(doc.querySelectorAll('h1').length,1);
  assert.equal(doc.getElementById('pay').disabled,true);
  assert.ok(html.includes('Payment and account activation are confirmed by server-side processor verification'));
 }finally{doc.defaultView.close()}
});

test('marketing post-processor never changes payment noindex policy or puts checkout in sitemap',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'luo-pay-index-test-'));
 try{
  await cp('public',dir,{recursive:true});
  await enhanceSite(dir);
  const html=await readFile(join(dir,'agent-checkout.html'),'utf8');
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
  assert.doesNotMatch(await readFile(join(dir,'sitemap.xml'),'utf8'),/agent-checkout/);
 }finally{await rm(dir,{recursive:true,force:true})}
});

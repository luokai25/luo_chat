import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MARKETING_ORIGIN,MARKETING_LOCALES} from '../scripts/marketing-content.mjs';
import {marketingSitemap} from '../scripts/generate-localized-marketing.mjs';
import {PRODUCT_GUIDES} from '../scripts/marketing-product-guides.mjs';
import {renderProductGuide,generateProductPages,PRODUCT_GUIDE_PATHS} from '../scripts/generate-product-pages.mjs';
import {INDEXNOW_KEY,publishedUrls,indexNowPayload,submitIndexNow} from '../scripts/indexnow-submit.mjs';

test('every in-depth guide provides a distinct, crawlable public page with correct metadata and real safety disclosures',()=>{
 const titles=new Set();
 for(const [key,d] of Object.entries(PRODUCT_GUIDES)){
  const html=renderProductGuide(key);
  titles.add(d.title);
  assert.ok(html.includes('<html lang="en">'));
  assert.ok(html.includes('<link rel="canonical" href="'+MARKETING_ORIGIN+'/en/'+key+'/">'));
  assert.ok(html.includes('<meta name="robots" content="index,follow'));
  assert.ok(html.includes('<meta property="og:image" content="'+MARKETING_ORIGIN+'/icon-512.png">'));
  assert.ok(html.includes(d.heading));
  for(const [heading,copy] of d.topics){assert.ok(html.includes(heading));assert.ok(html.includes(copy));}
  assert.ok(html.includes('href="/privacy.html"'));
  assert.ok(html.includes('href="/en/agents/"'));
  assert.ok(html.includes('not yet activated'));
  assert.ok(!html.includes('<script src='));
  assert.ok(!html.includes('Meta Tech Provider'));
  assert.ok(html.length>3000);
  assert.doesNotMatch(html,/http[s]?:\/\/[^"]+\/api\/v1\/agents\/register/);
 }
 assert.equal(titles.size,3);
 assert.equal(PRODUCT_GUIDE_PATHS.length,3);
});
test('public guide generator adds three pages and sitemap entries without duplicate URLs on reruns',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'luo-guide-'));
 try{
  await writeFile(join(dir,'sitemap.xml'),marketingSitemap());
  await writeFile(join(dir,'llms.txt'),'# Luo Chat\n');
  await generateProductPages(dir);
  for(const key of ['chats','luonix','worlds']){
   const html=await readFile(join(dir,'en',key,'index.html'),'utf8');
   assert.ok(html.includes(PRODUCT_GUIDES[key].heading));
  }
  await generateProductPages(dir);
  const map=await readFile(join(dir,'sitemap.xml'),'utf8');
  const llms=await readFile(join(dir,'llms.txt'),'utf8');
  for(const key of ['chats','luonix','worlds']){
   const url=MARKETING_ORIGIN+'/en/'+key+'/';
   assert.equal(map.split('<loc>'+url+'</loc>').length,2,'Only one sitemap loc for '+key);
   assert.equal(llms.split(url).length,2,'Only one public guide link for '+key);
  }
  assert.match(map,/xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml"/);
  for(const l of MARKETING_LOCALES)assert.match(map,new RegExp('hreflang="'+l+'"'));
  assert.equal(publishedUrls(map).length,7+10+3);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('IndexNow payload rejects other domains, private actions and URL query variants',()=>{
 const own=MARKETING_ORIGIN+'/en/luonix/';
 assert.deepEqual(publishedUrls('<url><loc>'+own+'</loc></url><url><loc>'+own+'</loc></url>'),[own]);
 assert.deepEqual(publishedUrls('<loc>'+MARKETING_ORIGIN+'/api/v1/messages</loc><loc>https://example.com/</loc>'),[]);
 const payload=indexNowPayload([MARKETING_ORIGIN+'/en/',own]);
 assert.equal(payload.host,'luo-chat-luokai25.vercel.app');
 assert.equal(payload.key,INDEXNOW_KEY);
 assert.deepEqual(payload.urlList,[MARKETING_ORIGIN+'/en/',own]);
 assert.throws(()=>indexNowPayload([MARKETING_ORIGIN+'/api/v1/messages']),/trusted public/);
 assert.throws(()=>indexNowPayload(['https://example.com/']),/trusted public/);
});
test('IndexNow dry run requires the published ownership key and does not call an external endpoint',async()=>{
 const key=await readFile('public/'+INDEXNOW_KEY+'.txt','utf8');
 assert.equal(key.trim(),INDEXNOW_KEY);
 let outbound=0;
 const result=await submitIndexNow({dryRun:true,fetchImpl:async()=>{outbound++;throw Error('No remote calls in tests');}});
 assert.equal(result.status,'dry-run');
 assert.ok(result.url_count>=20);
 assert.equal(outbound,0);
});

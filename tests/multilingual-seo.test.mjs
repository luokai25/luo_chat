import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MARKETING_LOCALES,MARKETING_ORIGIN,MARKETING} from '../scripts/marketing-content.mjs';
import {renderMarketingPage,marketingSitemap,generateLocalizedMarketing} from '../scripts/generate-localized-marketing.mjs';

test('all five localized public pages have unique copy, stable canonical URLs, reciprocal hreflang and proper language direction',()=>{
 const titles=new Set(),descriptions=new Set();
 for(const locale of MARKETING_LOCALES){
  const html=renderMarketingPage(locale),origin=MARKETING_ORIGIN+'/'+locale+'/';
  assert.match(html,new RegExp('<html lang="'+locale+'"'));
  assert.ok(html.includes('<link rel="canonical" href="'+origin+'">'));
  assert.ok(html.includes('<meta name="robots" content="index,follow'));
  if(locale==='ar')assert.ok(html.includes('<html lang="ar" dir="rtl">'));
  titles.add(MARKETING[locale].title);descriptions.add(MARKETING[locale].description);
  for(const language of MARKETING_LOCALES){
   assert.ok(html.includes('hreflang="'+language+'" href="'+MARKETING_ORIGIN+'/'+language+'/"'));
   assert.ok(html.includes('href="/'+language+'/" lang="'+language+'"'));
  }
  assert.ok(html.includes('hreflang="x-default" href="'+MARKETING_ORIGIN+'/en/"'));
  assert.ok(html.includes(MARKETING[locale].heading));
  assert.ok(html.includes('application/ld+json'));
  const json=html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
  assert.ok(json,'JSON-LD present');const graph=JSON.parse(json);
  assert.equal(graph['@graph'][1].inLanguage,locale);
  assert.equal(graph['@graph'][1].url,origin);
  assert.ok(!html.includes('Meta Tech Provider'));
 }
 assert.equal(titles.size,5);assert.equal(descriptions.size,5);
});
test('all localized agent pages are useful, indexable, exact-locale documents and never claim signup is active',()=>{
 for(const locale of MARKETING_LOCALES){
  const html=renderMarketingPage(locale,'agents');
  assert.ok(html.includes('href="'+MARKETING_ORIGIN+'/'+locale+'/agents/"'));
  for(const l of MARKETING_LOCALES)assert.ok(html.includes('hreflang="'+l+'" href="'+MARKETING_ORIGIN+'/'+l+'/agents/"'));
  assert.ok(html.includes('href="/openapi.json"'));
  assert.ok(html.includes('href="/api/v1/platform"'));
  assert.ok(html.includes('href="/api/v1/plans"'));
  assert.ok(html.includes('href="/llms.txt"'));
  assert.ok(html.includes(MARKETING[locale].agentStatus));
  assert.ok(html.includes(MARKETING[locale].agentLead));
  assert.ok(!html.includes('href="/api/v1/agents/register"'));
 }
});
test('sitemap lists only public content and ten localized URLs, not private apps or API operations',()=>{
 const sitemap=marketingSitemap();
 assert.match(sitemap,/<urlset/);
 for(const l of MARKETING_LOCALES)for(const postfix of ['/','/agents/'])assert.ok(sitemap.includes(MARKETING_ORIGIN+'/'+l+postfix));
 assert.doesNotMatch(sitemap,/<loc>[^<]*\/api\//);
 assert.doesNotMatch(sitemap,/<loc>[^<]*\/workspace/);
 assert.doesNotMatch(sitemap,/<loc>[^<]*\/openapi.json/);
});
test('generator is repeatable and agent discovery stays closed without leaking credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'luo-marketing-'));
 try{
  const readme=await readFile('public/llms.txt','utf8');await writeFile(join(dir,'llms.txt'),readme);
  await generateLocalizedMarketing(dir);
  const first=await readFile(join(dir,'ar','index.html'),'utf8');
  const discovery=JSON.parse(await readFile(join(dir,'.well-known','luo-agent-discovery.json'),'utf8'));
  assert.equal(discovery.agent_onboarding,'closed');assert.equal(discovery.capabilities.paid_registration,false);
  assert.equal(Object.keys(discovery.locale_guides).length,5);
  assert.equal(discovery.documentation,MARKETING_ORIGIN+'/agents');
  await generateLocalizedMarketing(dir);
  assert.equal(await readFile(join(dir,'ar','index.html'),'utf8'),first);
  const llms=await readFile(join(dir,'llms.txt'),'utf8');
  assert.equal(llms.split('## Localized public guides').length,2);
  assert.equal((llms.match(/\.well-known\/luo-agent-discovery\.json/g)||[]).length,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('public marketing pages preserve the private chat route and crawler-safe no-forced-redirect model',async()=>{
 const router=JSON.parse(await readFile('vercel.json','utf8'));
 assert.ok(!router.redirects?.some(x=>/\/ar|\/de|\/fr|\/es/.test(x.source||'')));
 const robots=await readFile('public/robots.txt','utf8');
 assert.match(robots,/Allow: \//);
 assert.match(robots,/Disallow: \/api\//);
 assert.match(robots,/Sitemap: https:\/\/luo-chat-luokai25\.vercel\.app\/sitemap.xml/);
 const build=JSON.parse(await readFile('package.json','utf8')).scripts.prebuild;
 assert.match(build,/generate-localized-marketing\.mjs/);
});

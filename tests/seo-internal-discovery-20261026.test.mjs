import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MARKETING_LOCALES,MARKETING_ORIGIN} from '../scripts/marketing-content.mjs';
import {renderMarketingPage} from '../scripts/generate-localized-marketing.mjs';
import {renderProductGuide,PRODUCT_GUIDE_PATHS} from '../scripts/generate-product-pages.mjs';

test('every localized Luo Chat home page links to all three canonical feature guides',()=>{
 assert.deepEqual(PRODUCT_GUIDE_PATHS,['/en/chats/','/en/luonix/','/en/worlds/']);
 for(const locale of MARKETING_LOCALES){
  const page=renderMarketingPage(locale);
  for(const path of PRODUCT_GUIDE_PATHS){
   assert.ok(page.includes('href="'+path+'" hreflang="en"'),'No discoverable English guide from '+locale+': '+path);
  }
  assert.equal((page.match(/class="feature-detail"/g)||[]).length,3,'Three useful guide links in '+locale);
  assert.match(page,/<link rel="canonical"/);
  assert.doesNotMatch(page,/paid AI agents are currently active|unrestricted agent registrations/i);
 }
});

test('feature guides have human-visible navigation and accurate breadcrumb structured data',()=>{
 for(const [i,path] of PRODUCT_GUIDE_PATHS.entries()){
  const slug=path.split('/')[2];
  const page=renderProductGuide(slug);
  const canonical=MARKETING_ORIGIN+path;
  assert.ok(page.includes('<link rel="canonical" href="'+canonical+'">'));
  assert.ok(page.includes('<nav class="page-breadcrumb" aria-label="Breadcrumb">'));
  assert.ok(page.includes('<a href="/en/">Luo Chat</a>'));
  assert.ok(page.includes('href="/en/agents/"'));
  for(const other of PRODUCT_GUIDE_PATHS)assert.ok(page.includes('href="'+other+'"'),'Missing cross-link on '+slug+': '+other);
  const match=page.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  assert.ok(match,'JSON-LD missing');
  const graph=JSON.parse(match[1])['@graph'];
  const breadcrumbs=graph.find(x=>x['@type']==='BreadcrumbList');
  assert.equal(breadcrumbs.itemListElement.length,2);
  assert.equal(breadcrumbs.itemListElement[0].item,MARKETING_ORIGIN+'/en/');
  assert.equal(breadcrumbs.itemListElement[1].item,canonical);
  assert.ok(page.includes('<meta name="twitter:description"'));
 }
});

test('public GitHub README points crawlers to verified public pages without exposing private account data',async()=>{
 const readme=await readFile('README.md','utf8');
 for(const path of ['/en/','/ar/','/de/','/fr/','/es/','/en/chats/','/en/luonix/','/en/worlds/','/agents','/sitemap.xml']){
  assert.ok(readme.includes(MARKETING_ORIGIN+path),'Missing public discovery link: '+path);
 }
 assert.match(readme,/Paid agent account registration and messaging are not publicly activated/);
 assert.ok(!readme.includes('Meta Tech Provider'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {MARKETING_LOCALES} from '../scripts/marketing-content.mjs';
import {renderMarketingPage} from '../scripts/generate-localized-marketing.mjs';
import {renderProductGuide} from '../scripts/generate-product-pages.mjs';

const source=await readFile('public/luo-deep-pages-v3.js','utf8');
const html=await readFile('public/index.html','utf8');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function run({loading=true}={}){
 const dom=new JSDOM(html,{url:'https://luo-chat-luokai25.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,app=d.querySelector('.app');
 app.dataset.screen='home';app.dataset.tab='chats';
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};
 if(loading)d.getElementById('chatlist').innerHTML='<div class="empty">Loading conversations…</div>';
 w.eval(source);
 d.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {dom,w,d,app,close(){w.dispatchEvent(new w.Event('pagehide'));w.close()}};
}
test('story composer has three connected steps and preserves real form submit, audience and media controls',()=>{
 const f=run();
 try{
  const {d,w}=f,form=d.getElementById('storyForm'),file=d.getElementById('storyMedia'),audience=d.getElementById('storyAudience');
  assert.equal(form.dataset.luoComposerV3,'true');
  assert.equal(d.querySelectorAll('.luo-story-v3-tab').length,3);
  assert.equal(form.contains(file),true);
  assert.equal(form.contains(audience),true);
  assert.equal(form.contains(d.getElementById('publishStory')),true);
  assert.ok(d.getElementById('luoStoryV3media').contains(file));
  let submissions=0;form.onsubmit=e=>{e.preventDefault();submissions++};
  w.LuoDeepPagesV3.storyMode('audience');
  assert.equal(d.getElementById('storyComposer').dataset.luoStoryMode,'audience');
  assert.equal(d.getElementById('luoStoryV3audience').hidden,false);
  assert.equal(d.querySelector('.luo-story-v3-audience-count').textContent,'Only you');
  audience.value='friend_one,friend_two';
  audience.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.match(d.querySelector('.luo-story-v3-audience-count').textContent,/2 selected accounts/);
  w.LuoDeepPagesV3.storyMode('text');
  assert.equal(d.getElementById('luoStoryV3text').hidden,false);
  assert.ok(d.getElementById('luoStoryV3text').contains(d.getElementById('storyBody')));
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(submissions,1);
  assert.ok(source.includes('existingPreview'));
 }finally{f.close()}
});
test('settings categories become real nested mobile views and preserve original buttons',()=>{
 const f=run({loading:false});
 try{
  const {w,d,app}=f;
  const profile=d.getElementById('profile'),nav=d.getElementById('settingsNav');
  assert.ok(profile.classList.contains('luo-settings-v3'));
  assert.equal(nav.querySelectorAll('[data-setting]').length,8);
  const privacy=nav.querySelector('[data-setting="privacy"]');
  app.dataset.tab='profile';privacy.click();
  assert.equal(profile.dataset.luoSection,'privacy');
  assert.ok(profile.classList.contains('luo-settings-deep'));
  assert.ok(d.getElementById('settings-privacy').contains(d.getElementById('savePrivacy')));
  d.getElementById('luoSettingsReturn').click();
  assert.equal(profile.classList.contains('luo-settings-deep'),false);
  assert.ok(d.getElementById('settings-privacy').contains(d.getElementById('savePrivacy')));
 }finally{f.close()}
});
test('real loading states get skeletons; resolved and signed-out screens do not retain fake cards',async()=>{
 const f=run();
 try{
  const {w,d,app}=f;await delay(80);
  const host=d.getElementById('chatlist');
  assert.equal(host.getAttribute('aria-busy'),'true');
  const skeleton=host.querySelector('.luo-skeleton-stage');
  assert.ok(skeleton);assert.equal(skeleton.getAttribute('aria-hidden'),'true');
  host.replaceChildren(d.createElement('article'));
  await delay(70);
  assert.equal(host.querySelector('.luo-skeleton-stage'),null);
  assert.equal(host.hasAttribute('aria-busy'),false);
  d.getElementById('storyFeedStatus').textContent='Loading stories…';
  await delay(70);assert.ok(d.querySelector('#luoUpdatesV2Rail .luo-skeleton-stage'));
  d.getElementById('storyFeedStatus').textContent='No stories';
  await delay(70);assert.equal(d.querySelector('#luoUpdatesV2Rail .luo-skeleton-stage'),null);
  app.dataset.screen='auth';await delay(70);
  assert.equal(d.querySelectorAll('.luo-skeleton-stage').length,0);
 }finally{f.close()}
});
test('dynamically added profile/photo dialogs get a visual layer, not a duplicate server handler',async()=>{
 const f=run({loading:false});
 try{
  const {w,d}=f,dialog=d.createElement('dialog');
  dialog.id='personDialog';dialog.innerHTML='<div class="dialog-heading"><h2>Profile</h2><button type="button">Close</button></div><div id="personBody"></div>';
  d.body.append(dialog);await delay(40);
  assert.equal(dialog.dataset.luoSurfaceV3,'true');
  assert.ok(dialog.classList.contains('luo-deep-person'));
  assert.equal(dialog.querySelectorAll('button').length,1);
  assert.ok(dialog.querySelector('.luo-deep-title'));
 }finally{f.close()}
});
test('five localizations and product guides link to the official Google source-selection flow without false endorsements',async()=>{
 const origin='https://www.google.com/preferences/source?q=luo-chat-luokai25.vercel.app';
 for(const locale of MARKETING_LOCALES){
  const a=renderMarketingPage(locale),b=renderMarketingPage(locale,'agents');
  for(const page of [a,b]){
   assert.ok(page.includes(origin));
   assert.match(page,/class="luo-preferred-source-badge"/);
   assert.match(page,/rel="noopener noreferrer nofollow"/);
   assert.doesNotMatch(page,/Google-approved|Google certified|Google verification badge/i);
   assert.doesNotMatch(page,/publisher.js/);
  }
 }
 for(const path of ['chats','luonix','worlds'])assert.ok(renderProductGuide(path).includes(origin));
 const css=await readFile('public/luo-deep-pages-v3.css','utf8');
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/\.luo-skeleton-stage/);
 assert.match(css,/\.luo-story-v3-pane/);
 assert.match(css,/settings-nav-item\[hidden\]/);
});
test('navigation assets and documented surface inventory are present',async()=>{
 assert.ok(html.includes('/luo-deep-pages-v3.js'));
 assert.ok(html.includes('/luo-deep-pages-v3.css'));
 const matrix=await readFile('docs/LUO_COMPLETE_SURFACE_AUDIT_20261026.md','utf8');
 assert.match(matrix,/Total catalogued interaction surfaces:\*\* \*\*234\*\*/);
 assert.match(matrix,/SERVICE_GAP/);
 assert.match(matrix,/not a Google certification/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html = `<!doctype html><html><head></head><body>
<div class="app" data-screen="home"><header class="app-header"><div class="logo">Luo</div></header>
<nav class="workspace-nav"><button class="tab" data-tab="chats">Chats</button><button class="tab" data-tab="new">People</button></nav>
<section id="home" class="screen active"><div id="chats"><div class="inbox-heading"><h2>Messages</h2></div><div id="chatlist"></div></div></section></div>
<button id="openStories">Stories</button>
<dialog id="storiesDialog"><div class="dialog-heading"><h2 id="storiesDialogHeading">Stories & circles</h2></div><button id="newStory">Add story</button><button id="refreshStories">Refresh</button><div id="storyFeed"><article class="story-card"><h3>Roro · 8 PM</h3><p>Hello friends</p><button id="viewNative">Open story media</button></article><article class="story-card"><h3>Friend · 8 PM</h3><p>A text story</p></article></div></dialog>
<dialog id="storyComposer"><h2 id="storyComposerHeading">Story composer</h2><form id="storyForm"><input id="storyMedia" type="file"><p id="storyStatus"></p></form></dialog></body></html>`;

async function render() {
  const js = await readFile('public/luo-updates.js','utf8');
  const dom = new JSDOM(html,{url:'https://luo-chat-luokai25.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.HTMLMediaElement.prototype.pause=function(){};
  w.HTMLMediaElement.prototype.load=function(){};
  w.URL.createObjectURL=()=> 'blob:https://luo-chat-luokai25.vercel.app/local-story-preview';
  w.URL.revokeObjectURL=()=>{};
  w.document.getElementById('openStories').onclick=()=>w.document.getElementById('storiesDialog').showModal();
  w.document.getElementById('newStory').onclick=()=>w.document.getElementById('storyComposer').showModal();
  w.document.getElementById('viewNative').onclick=()=>{const img=w.document.createElement('img');img.className='story-media';img.src='https://byjixqwpjvsgmqilmzbm.supabase.co/storage/v1/object/sign/mock?token=local-fixture';w.document.getElementById('viewNative').after(img);};
  w.eval(js);
  return dom;
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));

test('Updates is a safe workspace shortcut, and opens the existing private stories dialog',async()=>{
  const dom=await render();try{
    const d=dom.window.document;
    assert.equal(d.querySelectorAll('#luoUpdatesNav').length,1);
    assert.equal(d.getElementById('luoUpdatesNav').dataset.tab,undefined);
    assert.ok(d.getElementById('luoUpdatesStrip'));
    d.getElementById('luoUpdatesNav').click();
    assert.equal(d.getElementById('storiesDialog').open,true);
    assert.equal(d.getElementById('luoStoryRail').querySelectorAll('.luo-story-bubble').length,3);
    assert.equal(d.getElementById('storiesDialogHeading').textContent,'Updates');
    d.querySelector('#luoUpdatesStrip .luo-story-new').click();
    assert.equal(d.getElementById('storyComposer').open,true);
    d.querySelector('.app').dataset.screen='auth';await tick();
    assert.equal(d.getElementById('storiesDialog').open,false);
    assert.equal(d.getElementById('luoStatusViewer').open,false);
  }finally{dom.window.close();}
});

test('Story viewer obtains media through original private-media handler and does not persist signed URLs',async()=>{
  const dom=await render();try{
    const d=dom.window.document;
    d.getElementById('luoUpdatesNav').click();
    const person=d.querySelector('[aria-label="View story from Roro"]');
    assert.ok(person);person.click();await new Promise(r=>setTimeout(r,240));
    assert.equal(d.getElementById('luoStatusViewer').open,true);
    assert.ok(d.getElementById('luoViewerMedia').querySelector('img'));
    assert.match(d.getElementById('luoViewerMedia').querySelector('img').src,/mock/);
    d.querySelector('.luo-viewer-close').click();
    assert.equal(d.getElementById('luoViewerMedia').querySelector('img'),null);
    assert.equal(d.getElementById('luoStatusViewer').open,false);
  }finally{dom.window.close();}
});

test('Story upload preview remains local and existing form is untouched',async()=>{
  const dom=await render();try{
    const w=dom.window,d=w.document;
    const file=new w.File(['file'], 'photo.png', {type:'image/png'});
    const input=d.getElementById('storyMedia');
    Object.defineProperty(input,'files',{configurable:true,value:[file]});
    input.dispatchEvent(new w.Event('change',{bubbles:true}));
    assert.equal(d.getElementById('luoStoryUploadPreview').hidden,false);
    assert.ok(d.getElementById('luoUploadMedia').querySelector('img'));
    assert.equal(d.getElementById('storyForm').getAttribute('onsubmit'),null);
    d.getElementById('storyComposer').close();
    assert.equal(d.getElementById('luoStoryUploadPreview').hidden,true);
  }finally{dom.window.close();}
});

test('Story polish keeps account boundaries and never calls storage APIs directly',async()=>{
  const js=await readFile('public/luo-updates.js','utf8');
  const css=await readFile('public/luo-updates.css','utf8');
  assert.match(js,/app\.dataset\.screen==='auth'/);
  assert.match(js,/native server authorization/);
  assert.match(js,/mediaButton\(card\)/);
  assert.match(js,/URL\.revokeObjectURL/);
  assert.doesNotMatch(js,/service_role|\bcreateSignedUrl\(|\.from\('chat_stories'\)/);
  assert.match(css,/\.luo-status-viewer/);
  assert.match(css,/\.luo-updates-strip/);
  assert.match(css,/prefers-reduced-motion/);
});

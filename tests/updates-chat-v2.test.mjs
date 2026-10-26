import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const read=p=>readFile(p,'utf8');
function fixture(){
 const dom=new JSDOM('<!doctype html><html><body><div class="app" data-screen="home" data-tab="chats"><nav class="workspace-nav"><button data-tab="chats">Chats</button></nav><section id="chats"></section><section id="room"><div class="roomhead"><div class="room-identity"><strong id="roomtitle">Ava</strong></div><button class="luo-dm-info">Chat details</button></div><div id="messages"><article data-message="one" class="bubble"><div class="bubble-body">Hello</div><button class="reaction-chip">❤️</button><button data-action="reply">Reply</button></article></div><form id="sendform"><button id="attach" type="button">+</button><textarea id="body"></textarea><button id="scheduleText" type="button">Schedule</button><input id="mediaFile" type="file"><button type="submit">Send</button></form><button id="createPoll"></button></section><div id="storyFeed"></div><dialog id="storiesDialog"></dialog><dialog id="storyComposer"></dialog><button id="openStories">Stories</button><button id="newStory">New</button><button id="back">Back</button><input id="storyBody"><input id="storyMedia" type="file"></div></body></html>',{url:'https://luo-chat-luokai25.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};
 const a=d.createElement('article');a.className='story-card';a.dataset.storyId='abc';a.dataset.storyOwn='false';a.dataset.storyOwnerName='Rosé';a.dataset.storyUsername='rosie';a.dataset.storyExpires='2026-11-01T00:00:00Z';
 a.innerHTML='<h3>Rosé · 4 PM</h3><p>Hello from my status</p><button class="test-reaction">❤️</button>';
 d.getElementById('storyFeed').append(a);d.getElementById('openStories').onclick=()=>d.getElementById('storiesDialog').showModal();
 d.getElementById('newStory').onclick=()=>d.getElementById('storyComposer').showModal();
 d.querySelector('.workspace-nav button').onclick=()=>d.querySelector('.app').dataset.tab='chats';
 return {dom,w,d,source:a};
}
test('new Updates home replaces channels with story cards and does not leave a modal blocking navigation',async()=>{
 const x=fixture();try{
  x.w.eval(await read('public/luo-updates-v2.js'));
  assert.ok(x.w.LuoUpdatesV2);
  x.w.LuoUpdatesV2.open();
  assert.equal(x.d.getElementById('luoUpdatesV2').hidden,false);
  assert.equal(x.d.getElementById('storiesDialog').open,false);
  assert.match(x.d.getElementById('luoUpdatesV2').textContent,/My status/);
  assert.match(x.d.getElementById('luoUpdatesV2Rail').textContent,/Rosé/);
  assert.doesNotMatch(x.d.getElementById('luoUpdatesV2').textContent,/Channels|Explore channels/);
  x.d.querySelector('.luo-status-v2-search').value='not a person';
  x.d.querySelector('.luo-status-v2-search').dispatchEvent(new x.w.Event('input'));
  assert.match(x.d.querySelector('.luo-status-v2-empty').textContent,/No matching/);
 }finally{x.dom.window.close()}
});
test('status viewer keeps native reaction and text reply actions instead of sending fake data',async()=>{
 const x=fixture();try{
  let reacted=0,replied=null;x.source.querySelector('.test-reaction').onclick=()=>reacted++;
  x.w.addEventListener('luo:status-reply',e=>replied=e.detail);
  x.w.eval(await read('public/luo-updates-v2.js'));x.w.LuoUpdatesV2.open();
  const card=[...x.d.querySelectorAll('.luo-status-v2-tile')].find(x=>x.getAttribute('aria-label')==='View status from Rosé');card.click();
  assert.equal(x.d.getElementById('luoUpdatesV2Viewer').open,true);
  assert.match(x.d.querySelector('.luo-status-v2-caption').textContent,/Hello from my status/);
  x.d.querySelector('.luo-status-v2-react').click();
  [...x.d.querySelectorAll('.luo-status-v2-emoji')].find(x=>x.textContent==='❤️').click();
  assert.equal(reacted,1);
  const input=x.d.querySelector('.luo-status-v2-reply input');input.value='Hope you are well';
  x.d.querySelector('.luo-status-v2-reply').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(replied.username,'rosie');assert.equal(replied.body,'Hope you are well');
  assert.equal(x.d.getElementById('luoUpdatesV2Viewer').open,false);
  assert.equal(x.d.getElementById('luoUpdatesV2').hidden,true);
 }finally{x.dom.window.close()}
});
test('status creator continues using the native audience-controlled upload workflow',async()=>{
 const x=fixture();try{
  x.w.eval(await read('public/luo-updates-v2.js'));
  x.w.LuoUpdatesV2.open();
  x.d.querySelector('.luo-status-v2-pencil').click();
  assert.equal(x.d.getElementById('storyComposer').open,true);
  assert.match((await read('src/stories.js')),/create_private_chat_story/);
  assert.match((await read('src/stories.js')),/chat_story_reactions/);
  assert.match((await read('src/stories.js')),/dataset\.storyUsername/);
 }finally{x.dom.window.close()}
});
test('DM toolbar reuses native camera, file, poll, schedule and gesture handlers',async()=>{
 const x=fixture();try{
  let files=0,polls=0,schedules=0,hearts=0;
  x.d.getElementById('mediaFile').click=()=>files++;
  x.d.getElementById('createPoll').click=()=>polls++;
  x.d.getElementById('scheduleText').click=()=>schedules++;
  x.d.querySelector('.reaction-chip').onclick=()=>hearts++;
  x.w.eval(await read('public/luo-chat-v2.js'));
  assert.equal(x.d.querySelector('.luo-dm-info').textContent,'ⓘ');
  x.d.getElementById('attach').click();
  assert.equal(x.d.getElementById('luoDmAttachSheet').hidden,false);
  [...x.d.querySelectorAll('.luo-dm-sheet-action')].find(b=>b.textContent==='Photo or video').click();
  assert.equal(files,1);
  x.d.getElementById('attach').click();
  [...x.d.querySelectorAll('.luo-dm-sheet-action')].find(b=>b.textContent==='Poll').click();
  assert.equal(polls,1);
  x.d.getElementById('attach').click();
  [...x.d.querySelectorAll('.luo-dm-sheet-action')].find(b=>b.textContent==='Schedule message').click();
  assert.equal(schedules,1);
  const bubble=x.d.querySelector('.bubble[data-message]');
  bubble.dispatchEvent(new x.w.Event('pointerup',{bubbles:true}));bubble.dispatchEvent(new x.w.Event('pointerup',{bubbles:true}));
  assert.equal(hearts,1);
 }finally{x.dom.window.close()}
});
test('mobile routing contains a single Updates destination and preserves existing account settings',async()=>{
 const approved=await read('public/luo-approved.js'),phone=await read('public/luo-phone-polish.js'),app=await read('src/app.js'),html=await read('public/index.html'),css=await read('public/luo-experience-v2.css');
 assert.match(approved,/window\.LuoUpdatesV2\?\.open/);assert.match(phone,/window\.LuoUpdatesV2/);
 assert.match(app,/luo:status-reply/);assert.match(app,/start_direct_chat/);
 assert.match(html,/\/luo-updates-v2\.js/);assert.match(html,/\/luo-chat-v2\.js/);
 assert.match(css,/@import url\("\/luo-updates-v2\.css"\)/);
 assert.match((await read('src/settings.js')),/settingsSearch/);
});

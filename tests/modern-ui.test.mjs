import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const src=await readFile('public/luo-modern.js','utf8');
const css=await readFile('public/luo-modern.css','utf8');
function setup(){
 const dom=new JSDOM(`<!doctype html><html><body>
 <div class="app" data-screen="home" data-tab="chats">
 <nav class="workspace-nav"><button class="tab" data-tab="chats">Chats</button><button class="tab" data-tab="new">People</button><button class="tab" data-tab="group">Groups</button><button class="tab" data-tab="saved">Vault</button><button class="tab" data-tab="scheduled">Scheduled</button><button class="tab" data-tab="profile">Settings</button></nav>
 <div id="home"><section id="chats"><div class="inbox-heading"><span>Messages</span></div><select id="inboxFilter"><option value="active">active</option><option value="unread">unread</option><option value="archived">archived</option></select><div id="chatlist"></div></section>
 <section id="new"><h2>Find your people</h2><input id="target"><button id="openStories"></button><button id="lookup"></button><button id="saveContact"></button><button id="start"></button><div class="contact-book"><div class="section-heading"><h3>Contacts</h3></div><div id="contactList"><div class="contact-row"><div><strong>Friend</strong><small>@friend_123</small></div></div></div></div></section>
 <section id="group"><h2>Create a group</h2><input id="groupname"><textarea id="members"></textarea><button id="createGroup">Create</button></section></div>
 <section id="room"><div id="messages"><div class="bubble" data-message="m1"><div class="bubble-body">Hi</div><button data-action="reply">Reply</button><details class="message-extra-tools"><summary>More</summary><button class="reaction-chip">❤</button></details></div></div><form id="sendform"><textarea id="body"></textarea></form></section>
 <dialog id="storiesDialog"><h2 id="storiesDialogHeading">Stories</h2><button id="newStory">New story</button><button id="refreshStories">Refresh</button></dialog>
 <dialog id="storyComposer"><div class="dialog-heading"><h2 id="storyComposerHeading">Story</h2></div><input id="storyMedia" type="file"><label for="storyMedia">Media</label><textarea id="storyAudience"></textarea><button id="storyUseContacts"></button><button id="publishStory"></button></dialog>
 <div id="subtitle"></div></div></body></html>`,{url:'https://luo-chat.example/',runScripts:'outside-only',pretendToBeVisual:true});
 let stories=0, create=0, lookup=0,reply=0,more=0;
 const doc=dom.window.document;const get=id=>doc.getElementById(id);
 get('openStories').addEventListener('click',()=>{stories++;get('storiesDialog').showModal?.()});get('createGroup').addEventListener('click',()=>{create++});get('lookup').addEventListener('click',()=>{lookup++});doc.querySelector('[data-action=reply]').addEventListener('click',()=>reply++);doc.querySelector('.message-extra-tools summary').addEventListener('click',()=>more++);
 for(const el of doc.querySelectorAll('.workspace-nav [data-tab]'))el.addEventListener('click',()=>doc.querySelector('.app').dataset.tab=el.dataset.tab);
 dom.window.eval(src);doc.dispatchEvent(new dom.window.Event('DOMContentLoaded',{bubbles:true}));return {doc,window:dom.window,get,stats:()=>({stories,create,lookup,reply,more})};
}
test('theme and structure retain native chat, Supabase, PWA and security plumbing',()=>{
 assert.match(css,/\.chatrow/);assert.match(css,/\.bubble\.mine/);assert.match(css,/\.compose/);assert.match(css,/\.contact-row/);assert.match(css,/#storyComposer/);assert.match(css,/@media\s*\(max-width:999px\)/);
 assert.doesNotMatch(src,/supabase\.from|createClient\(|fetch\(|localStorage\.clear/);
 assert.match(src,/data-action=reply/);assert.match(src,/message-extra-tools summary/);
});
test('Updates navigation delegates to the existing private story handler',()=>{const t=setup();t.get('luoModernUpdates').click();assert.equal(t.stats().stories,1);assert.equal(t.doc.querySelector('.app').dataset.tab,'new');});
test('Inbox chips update native conversation filter without overriding on-change',()=>{const t=setup();let count=0;t.get('inboxFilter').addEventListener('change',()=>count++);const chips=t.get('luoModernChips');[...chips.querySelectorAll('button')].find(x=>x.dataset.filter==='unread').click();assert.equal(t.get('inboxFilter').value,'unread');assert.equal(count,1);});
test('Group picker builds and removes usernames but delegates submission to existing handler',()=>{const t=setup();const input=t.get('luoAddUsername');input.value='friend_123';t.doc.querySelector('#luoGroupPicker .luo-input-row button').click();assert.equal(t.get('members').value,'friend_123');assert.equal(t.doc.querySelectorAll('.luo-member-chip').length,1);t.get('createGroup').click();assert.equal(t.stats().create,1);t.doc.querySelector('.luo-member-chip').click();assert.equal(t.get('members').value,'');});
test('Group picker can add already loaded saved contacts without discovering hidden users',()=>{const t=setup();t.doc.querySelector('.workspace-nav [data-tab=group]').click();const input=t.get('luoAddUsername');input.value='friend_123';t.doc.querySelector('#luoGroupPicker .luo-input-row button').click();assert.equal(t.get('members').value,'friend_123');});
test('Desktop message shortcuts trigger existing reply / react UI rather than new message mutations',()=>{const t=setup();const b=t.doc.querySelector('.bubble');assert.ok(b.querySelector('.luo-bubble-actions'));b.querySelector('[aria-label="Reply to message"]').click();b.querySelector('[aria-label="React to message"]').click();assert.equal(t.stats().reply,1);assert.equal(t.stats().more,1);});
test('Story creation preserves original upload, audience, and submit elements',()=>{const t=setup();assert.ok(t.get('storyMedia'));assert.ok(t.get('storyAudience'));assert.ok(t.get('publishStory'));assert.match(t.get('storyComposerHeading').textContent,/Create a status/);assert.match(t.get('luoStoryPrivacyHint').textContent,/empty audience/);});

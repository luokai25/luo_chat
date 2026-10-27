import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {installStoryAudienceFlow} from '../src/story-audience-flow.js';

const html=await readFile('public/index.html','utf8');
function create({publicReady=false,contacts=[{username:'alex_friend',display_name:'Alex'},{username:'maria_k',display_name:'Maria'},{username:'sam_123',display_name:'Sam'}],deferred=false}={}){
 const dom=new JSDOM(html,{url:'https://luo.test',pretendToBeVisual:true}),win=dom.window,doc=win.document;
 let actor={id:'alice'},release,fetches=0;
 const calls=[];
 const db={rpc:async(name,params)=>{
  calls.push({name,params});
  if(name==='chat_public_story_ready')return {data:publicReady,error:null};
  if(name==='get_my_chat_contacts'){fetches++;if(deferred)return new Promise(resolve=>release=resolve);return {data:contacts,error:null}}
  if(name==='save_chat_story_circle')return {data:'circle-id',error:null};
  throw Error('Unexpected RPC: '+name);
 }};
 const $=id=>doc.getElementById(id),notices=[];
 const flow=installStoryAudienceFlow({win,db,$,getUser:()=>actor,note:m=>notices.push(m)});
 flow.reset();
 const click=label=>{
  const b=[...doc.querySelectorAll('.luo-story-audience-choice,.luo-story-secondary-action,.luo-story-selection-actions button,.luo-story-page-body > button')].find(n=>n.textContent.includes(label));
  assert.ok(b,'missing UI action: '+label);b.click();return b;
 };
 return{dom,doc,win,flow,db,calls,notices,click,fetches:()=>fetches,release:v=>release?.(v),
 setActor:next=>actor=next,done:()=>dom.window.close()};
}
const settle=()=>new Promise(r=>setTimeout(r,12));

test('Story composer creates actual editor, privacy, contact and close friends pages without replacing publish handler',async()=>{
 const x=create();try{
  const d=x.doc,dialog=d.getElementById('storyComposer');
  assert.ok(dialog.classList.contains('luo-v9-story'));
  assert.ok(d.querySelector('.luo-story-editor').contains(d.getElementById('storyMedia')));
  assert.ok(d.querySelector('.luo-story-advanced').contains(d.getElementById('storyAudience')));
  d.querySelector('.luo-story-audience-button').click();
  assert.equal(d.querySelector('.luo-story-secondary').dataset.page,'audience');
  assert.equal(d.querySelectorAll('.luo-story-audience-choice').length,6);
  assert.equal([...d.querySelectorAll('.luo-story-audience-choice')].find(n=>n.textContent.includes('Public')).disabled,true);
  assert.equal(d.getElementById('publishStory').type,'submit');
  await settle();
  x.click('Only share with');await settle();
  assert.equal(d.querySelector('.luo-story-secondary').dataset.page,'contacts');
  assert.equal(d.querySelectorAll('.luo-story-contact-row').length,3);
 }finally{x.done()}
});

test('Selected friends persists exact, deduplicated usernames in the native private-story audience field',async()=>{
 const x=create();try{
  const d=x.doc;d.querySelector('.luo-story-audience-button').click();await settle();
  x.click('Only share with');await settle();
  const rows=[...d.querySelectorAll('.luo-story-contact-row')];
  assert.equal(rows.length,3);
  rows[0].querySelector('input').click();
  rows[2].querySelector('input').click();
  x.click('Done');
  assert.equal(d.getElementById('storyAudience').value,'alex_friend, sam_123');
  assert.equal(d.querySelector('.luo-story-editor').hidden,false);
  assert.match(d.querySelector('.luo-story-audience-button').textContent,/Selected friends.*2/);
 }finally{x.done()}
});

test('My contacts except excludes checked contacts from actual published recipient list',async()=>{
 const x=create();try{
  const d=x.doc;d.querySelector('.luo-story-audience-button').click();await settle();
  x.click('My contacts except');await settle();
  assert.equal(d.querySelector('.luo-story-secondary').dataset.page,'contacts');
  d.querySelectorAll('.luo-story-contact-row')[1].querySelector('input').click();
  x.click('Done');
  assert.equal(d.getElementById('storyAudience').value,'alex_friend, sam_123');
  assert.match(d.querySelector('.luo-story-audience-button').textContent,/My contacts except/);
 }finally{x.done()}
});

test('Close friends can be selected and saved by the authorized existing circle RPC',async()=>{
 const x=create();try{
  const d=x.doc;let updated=0;
  d.getElementById('storyComposer').addEventListener('luo:story-circle-saved',()=>updated++);
  d.querySelector('.luo-story-audience-button').click();await settle();
  x.click('Close friends');await settle();
  x.click('Choose close friends');
  d.querySelectorAll('.luo-story-contact-row')[0].querySelector('input').click();
  x.click('Done');
  assert.equal(d.querySelector('.luo-story-secondary').dataset.page,'close');
  x.click('Save close friends');await settle();
  assert.equal(x.calls.filter(c=>c.name==='save_chat_story_circle').length,1);
  assert.deepEqual(x.calls.at(-1).params,{circle_name:'Close friends',recipient_usernames:['alex_friend']});
  assert.equal(d.getElementById('storyAudience').value,'alex_friend');
  assert.equal(updated,1);
  assert.equal(d.querySelector('.luo-story-editor').hidden,false);
 }finally{x.done()}
});

test('Only me never invents recipients and Public cannot silently become a private post',async()=>{
 const x=create();try{
  const d=x.doc;d.querySelector('.luo-story-audience-button').click();await settle();
  const p=[...d.querySelectorAll('.luo-story-audience-choice')].find(e=>e.textContent.includes('Public'));
  assert.equal(p.disabled,true);
  x.click('Only me');
  assert.equal(d.getElementById('storyAudience').value,'');
  assert.match(d.querySelector('.luo-story-audience-button').textContent,/Only me/);
 }finally{x.done()}
});

test('Public audience activates only after explicit server readiness, never by an unchecked toggle',async()=>{
 const x=create({publicReady:true});try{
  const d=x.doc;
  d.querySelector('.luo-story-audience-button').click();await settle();
  const publicChoice=[...d.querySelectorAll('.luo-story-audience-choice')].find(e=>e.textContent.includes('Public'));
  assert.equal(publicChoice.disabled,false);
  publicChoice.click();
  assert.equal(x.flow.audienceMode(),'public');
  assert.equal(d.getElementById('storyAudience').value,'');
  assert.match(d.querySelector('.luo-story-audience-button').textContent,/Public/);
  const server=await readFile('src/stories.js','utf8');
  const migration=await readFile('supabase/migrations/20261027140000_story_public_audience_opt_in.sql','utf8');
  assert.match(server,/create_public_chat_story/);
  assert.match(migration,/enabled boolean not null default false/);
  assert.match(migration,/auth\.uid\(\) is not null/);
  assert.match(migration,/grant execute on function public\.create_public_chat_story/);
 }finally{x.done()}
});

test('late contact responses cannot expose a previous user’s contacts after signout',async()=>{
 const x=create({deferred:true});try{
  const d=x.doc;d.querySelector('.luo-story-audience-button').click();
  assert.equal(x.fetches(),1);
  x.flow.signedOut();x.setActor({id:'bob'});
  x.release({data:[{username:'sensitive_a',display_name:'Sensitive'}],error:null});
  await settle();
  assert.equal(d.querySelectorAll('.luo-story-contact-row').length,0);
  assert.doesNotMatch(d.querySelector('.luo-story-secondary').textContent,/sensitive_a/);
 }finally{x.done()}
});

test('Story contacts are removed from the document after navigating back and signing out',async()=>{
 const x=create();try{
  const d=x.doc;d.querySelector('.luo-story-audience-button').click();await settle();
  x.click('Only share with');
  assert.equal(d.querySelectorAll('.luo-story-contact-row').length,3);
  x.flow.signedOut();
  assert.equal(d.querySelectorAll('.luo-story-contact-row').length,0,'sign-out clears private contact row nodes');
  x.setActor({id:'another_user'});x.flow.reset();
  d.querySelector('.luo-story-audience-button').click();
  assert.equal(d.querySelectorAll('.luo-story-contact-row').length,0,'new account never inherits old contact cards');
 }finally{x.done()}
});

test('Back or Escape returns from audience screens without discarding unfinished story text',async()=>{
 const x=create();try{
  const d=x.doc,body=d.getElementById('storyBody');
  body.value='Keep this draft intact';
  d.querySelector('.luo-story-audience-button').click();
  assert.equal(d.querySelector('.luo-story-secondary').dataset.page,'audience');
  const cancel=new x.win.Event('cancel',{cancelable:true});
  d.getElementById('storyComposer').dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented,true);
  assert.equal(d.querySelector('.luo-story-editor').hidden,false);
  assert.equal(body.value,'Keep this draft intact');
 }finally{x.done()}
});

test('Story closure is guarded during upload and requires confirmation before discarding drafts',()=>{
 const x=create();try{
  const d=x.doc,send=d.getElementById('publishStory'),body=d.getElementById('storyBody');
  body.value='An unfinished photo story';
  let prompts=0;
  x.win.confirm=()=>{prompts++;return false};
  assert.equal(x.flow.requestClose(),false);
  assert.equal(prompts,1);
  send.disabled=true;
  assert.equal(x.flow.requestClose(),false);
  assert.equal(prompts,1,'Publishing must not prompt users to discard an in-flight story');
  assert.match(d.getElementById('storyStatus').textContent,/being published/);
  send.disabled=false;
  x.win.confirm=()=>true;
  assert.equal(x.flow.requestClose(),true);
 }finally{x.done()}
});

test('existing Close friends circle is restored for the contact audience picker',async()=>{
 const x=create();try{
  const d=x.doc;
  x.flow.onCirclesLoaded([{id:'friend-circle',name:'Close friends',usernames:['maria_k']}]);
  d.querySelector('.luo-story-audience-button').click();await settle();
  x.click('Close friends');
  assert.match(d.querySelector('.luo-story-secondary').textContent,/1 friend selected/);
  assert.equal(d.querySelector('.luo-story-secondary').dataset.page,'close');
  x.click('Choose close friends');
  const row=[...d.querySelectorAll('.luo-story-contact-row')].find(n=>n.textContent.includes('maria_k'));
  assert.equal(row.querySelector('input').checked,true);
 }finally{x.done()}
});

test('saved private circles populate real recipients and preserve audience labels',()=>{
 const x=create();try{
  const d=x.doc;
  x.flow.useSavedCircle({name:'Close friends',usernames:['alex_friend','maria_k']});
  assert.equal(d.getElementById('storyAudience').value,'alex_friend, maria_k');
  assert.equal(x.flow.audienceMode(),'close');
  assert.match(d.querySelector('.luo-story-audience-button').textContent,/Close friends.*2/);
  x.flow.useSavedCircle({name:'Neighbors',usernames:['sam_123']});
  assert.equal(d.getElementById('storyAudience').value,'sam_123');
  assert.equal(x.flow.audienceMode(),'selected');
 }finally{x.done()}
});

test('cancelling excluded-contact edits does not silently commit the exclusion next time',async()=>{
 const x=create();try{
  const d=x.doc;
  d.querySelector('.luo-story-audience-button').click();await settle();
  x.click('My contacts except');
  d.querySelectorAll('.luo-story-contact-row')[1].querySelector('input').click();
  d.querySelector('.luo-story-back').click();
  d.querySelector('.luo-story-back').click();
  d.querySelector('.luo-story-audience-button').click();await settle();
  x.click('My contacts except');
  const person=[...d.querySelectorAll('.luo-story-contact-row')].find(n=>n.textContent.includes('maria_k'));
  assert.equal(person.querySelector('input').checked,false);
 }finally{x.done()}
});

test('contact-search Enter does not accidentally submit a Story',async()=>{
 const x=create();try{
  const d=x.doc;d.querySelector('.luo-story-audience-button').click();await settle();x.click('Only share with');
  const search=d.querySelector('.luo-story-contact-search');
  const event=new x.win.KeyboardEvent('keydown',{key:'Enter',cancelable:true,bubbles:true});
  search.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);
 }finally{x.done()}
});

test('full-screen V9 stylesheet is wired to the existing native Story composer',async()=>{
 const css=await readFile('public/luo-story-v9.css','utf8');
 assert.match(html,/href="\/luo-story-v9\.css"/);
 assert.match(css,/#storyComposer\.luo-v9-story\[open\]/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css, /prefers-reduced-motion:reduce/);
});

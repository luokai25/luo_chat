import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

// Contract gate: every primary workspace view stays under the single app shell.
// Browser acceptance and authenticated server checks are additional release gates.
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const dom=new JSDOM(html);
const d=dom.window.document;
const app=d.querySelector('body > .app');

test('all primary workspace tabs target sections inside the same authenticated app',()=>{
 assert.ok(app,'single application shell is required');
 const targets={chats:'chats',new:'new',group:'group',saved:'saved',scheduled:'scheduled',profile:'profile'};
 for(const [tab,id] of Object.entries(targets)){
  const nav=app.querySelector('.workspace-nav .tab[data-tab="'+tab+'"]');
  const section=app.querySelector('#home #'+id);
  assert.ok(nav,'missing navigation button '+tab);
  assert.ok(section,'missing app section '+id);
  assert.equal(section.closest('.app'),app,'section escaped Luo Chat shell: '+id);
  assert.equal(nav.closest('form'),null,'navigation must not be nested in an unrelated form: '+tab);
 }
});

test('primary flows have attached destination controls in the same shell',()=>{
 const flows={
  chats:['chatlist','globalSearchForm','globalSearchResults'],
  people:['target','lookup','lookupResult','start','openStories'],
  worlds:['groupname','members','createGroup'],
  vault:['vaultSearch','savedList','refreshSaved'],
  scheduled:['scheduledList','refreshScheduled'],
  settings:['settingsSearch','settingsAvatar','editProfileShortcut']
 };
 for(const [flow,ids] of Object.entries(flows)){
  for(const id of ids){
   const node=d.getElementById(id);
   assert.ok(node,flow+' missing control '+id);
   assert.equal(node.closest('.app'),app,flow+' control detached from app: '+id);
  }
 }
});

test('secondary dialogs and their original submit controls remain in the same app',()=>{
 const surfaces={
  sharedDialog:['closeShared'],
  pollDialog:['confirmPoll'],
  scheduleDialog:['confirmSchedule'],
  mediaViewer:['closeMediaViewer'],
  personalizeDialog:['personalizeForm'],
  deleteDialog:['confirmDelete'],
  storyForm:['publishStory'],
  messageActionDialog:['submitMessageAction'],
  avatarDialog:['closeAvatar'],
  shortcutDialog:[]
 };
 for(const [id,actions] of Object.entries(surfaces)){
  const panel=d.getElementById(id);
  assert.ok(panel,'missing secondary surface '+id);
  assert.equal(panel.closest('.app'),app,'orphaned secondary surface '+id);
  for(const action of actions){
   const button=d.getElementById(action);
   assert.ok(button,'missing native secondary action '+action);
   assert.equal(button.closest('.app'),app,'action escaped shell '+action);
  }
 }
});

test('primary navigation uses one data-tab router, not cross-app redirects',()=>{
 const nav=[...app.querySelectorAll('.workspace-nav .tab[data-tab]')];
 assert.equal(new Set(nav.map(button=>button.dataset.tab)).size,nav.length);
 for(const button of nav)assert.equal(button.hasAttribute('formaction'),false);
});

after(()=>dom.window.close());

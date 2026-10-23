import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
function harness(user=null,profile=null,recovering=false){
 const app={dataset:{screen:'auth'}};
 const panes=Object.fromEntries(['auth','recovery','home','room'].map(id=>[id,{classList:{add(){},remove(){}}}]));
 const ctx={user,profile,recovering,document:{documentElement:{classList:{remove(){}}},querySelector:()=>app,querySelectorAll:()=>[]},$:id=>panes[id]};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function screen(id)'),source.indexOf('const authRestore=')),ctx);
 return {ctx,app};
}
test('new users cannot navigate into the app before authentication',()=>{
 const {ctx,app}=harness();
 for(const target of ['home','room']){ctx.screen(target);assert.equal(app.dataset.screen,'auth')}
 for(const target of ['chats','new','profile','group','saved']){ctx.tab(target);assert.equal(app.dataset.screen,'auth');assert.equal(app.dataset.tab,undefined)}
});
test('a missing or mismatched profile does not unlock navigation',()=>{
 for(const profile of [null,{id:'other'}]){const {ctx,app}=harness({id:'owner'},profile);ctx.screen('home');assert.equal(app.dataset.screen,'auth')}
});
test('a ready account can open home and a conversation',()=>{
 const {ctx,app}=harness({id:'owner'},{id:'owner'});
 ctx.screen('home');assert.equal(app.dataset.screen,'home');ctx.screen('room');assert.equal(app.dataset.screen,'room');
});
test('password recovery remains available before loading a profile',()=>{
 const {ctx,app}=harness(null,null,true);ctx.tab('chats');assert.equal(app.dataset.screen,'recovery');
});

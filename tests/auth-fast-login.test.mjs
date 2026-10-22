import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const script=await readFile('public/luo-session-boot.js','utf8'),key='sb-test-auth-token',now=Math.floor(Date.now()/1000);
function check(store,expected){const names=Object.keys(store),flags=new Set();vm.runInNewContext(script,{localStorage:{length:names.length,key:i=>names[i],getItem:k=>store[k]},document:{documentElement:{classList:{add:x=>flags.add(x),remove:x=>flags.delete(x)}}},Date,JSON});assert.equal(flags.has('luo-restoring-session'),expected)}
test('brand-new user sees login without splash',()=>check({},false));
test('unusable session never blocks login',()=>check({[key]:'bad-json'},false));
test('missing refresh token does not hide login',()=>check({[key]:JSON.stringify({access_token:'a'})},false));
test('long-expired session cannot delay login',()=>check({[key]:JSON.stringify({access_token:'a',refresh_token:'r',expires_at:now-9*86400})},false));
test('returning user sees restoration surface instead of login flash',()=>check({[key]:JSON.stringify({access_token:'a',refresh_token:'r',expires_at:now+3600})},true));
test('session restoration timeout allows login',async()=>{const s=await readFile('public/luo-mobile-stability.js','utf8');assert.ok(s.includes('3500'))});

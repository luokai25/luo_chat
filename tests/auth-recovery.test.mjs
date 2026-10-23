import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {isTransientAuthError,describeAuthError,createAuthRestoreControl} from '../src/auth-recovery.js';

test('Supabase 500/504 and transport deadlines are outages rather than invalid passwords',()=>{
 for(const value of [{status:500,code:'unexpected_failure'},{status:504,message:'context deadline exceeded'},{status:429},{name:'AuthRetryableFetchError'},{name:'AbortError'}, {message:'fetch failed'}, {message:'network connection timeout'}]){
  assert.equal(isTransientAuthError(value),true);
  assert.match(describeAuthError(value),/temporarily unavailable/);
  assert.doesNotMatch(describeAuthError(value),/wrong|invalid credentials/i);
 }
});
test('invalid password, email confirmation and ordinary user errors keep accurate explanations',()=>{
 assert.equal(isTransientAuthError({status:400,code:'invalid_credentials',message:'Invalid login credentials'}),false);
 assert.match(describeAuthError({status:400,code:'invalid_credentials'}),/Username or password/);
 assert.match(describeAuthError({status:400,code:'email_not_confirmed'}),/migration support/);
 assert.match(describeAuthError({message:'Permission denied'}),/Permission denied/);
});
test('restoration error is explicit and never claims a session or user has been deleted',()=>{
 const value=describeAuthError({status:500,code:'unexpected_failure'},'restore');
 assert.match(value,/saved session may still be valid/);
 assert.doesNotMatch(value,/removed|deleted|incorrect password/i);
});
test('retry session control is accessible, coalesces clicks and preserves on-demand behavior',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><p id="authmsg" role="status"></p></body></html>');
 let calls=0,resolve;const gate=new Promise(r=>resolve=r);
 const ctrl=createAuthRestoreControl({doc:dom.window.document,onRetry:async()=>{calls++;await gate}});
 const button=dom.window.document.getElementById('retryAuthRestore');
 assert.equal(button.hidden,true);
 ctrl.show('Sign-in service down');assert.equal(button.hidden,false);
 assert.match(dom.window.document.getElementById('authmsg').textContent,/service down/);
 button.click();button.click();assert.equal(calls,1);
 assert.equal(button.disabled,true);
 resolve();await gate;await Promise.resolve();await Promise.resolve();
 assert.equal(button.disabled,false);
 ctrl.hide();assert.equal(button.hidden,true);
 dom.window.close();
});

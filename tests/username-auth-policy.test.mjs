import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {transform} from 'esbuild';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const raw=await readFile('supabase/functions/_shared/username-auth-policy.ts','utf8');
const moduleCode=(await transform(raw,{loader:'ts',format:'cjs',target:'es2022'})).code;
const box={exports:{},module:{exports:{}},crypto:webcrypto,TextEncoder,Uint8Array};
vm.runInNewContext(moduleCode,box);
const policy=box.module.exports;

test('normalize existing username logins, without opening reserved account registrations',()=>{
 assert.equal(policy.canonicalUsername('  Abdo_2026  '),'abdo_2026');
 assert.equal(policy.canonicalUsername('luo_1234567890abcdef'),'luo_1234567890abcdef');
 assert.equal(policy.canonicalUsername('2026_abdo'),'2026_abdo');
 assert.equal(policy.canonicalUsername('_legacy'),'_legacy');
 assert.equal(policy.isAvailableForRegistration('2026_abdo'),false);
 assert.equal(policy.isAvailableForRegistration('_legacy'),false);
 assert.equal(policy.isAvailableForRegistration('luo_1234567890abcdef'),false);
 assert.equal(policy.isAvailableForRegistration('support'),false);
 assert.equal(policy.isAvailableForRegistration('abdo_2026'),true);
 for(const x of ['A','foo@example.com','a b c',null,'🔐username','a'.repeat(25)])assert.equal(policy.canonicalUsername(x),null);
});
test('new accounts require strong passwords but original accounts can migrate without changing password',()=>{
 assert.equal(policy.validatePassword('12345678','person').ok,false);
 assert.equal(policy.validatePassword('a secure example of a password','person').ok,true);
 assert.equal(policy.validatePassword('mary123longpassword','mary').ok,false);
});
test('internal account email never exposes a public username or a real email service',()=>{
 const e=policy.internalEmailForId('12345678-1234-4123-8123-123456789abc');
 assert.equal(e,'luo-12345678123441238123123456789abc@accounts.invalid');
 assert.throws(()=>policy.internalEmailForId('alice'));
});
test('recovery code generation is high entropy and HMAC digests depend on account and server secret',async()=>{
 const list=policy.newRecoveryCodes(webcrypto);
 assert.equal(list.length,10);
 assert.equal(new Set(list).size,10);
 for(const code of list)assert.equal(policy.validateRecoveryCodeInput(code),true);
 const secret='server-secret-at-least-32-chars-protected';
 const a=await policy.digestRecoveryCode({code:list[0],userId:'12345678-1234-4123-8123-123456789abc',secret,cryptoImpl:webcrypto});
 const b=await policy.digestRecoveryCode({code:list[0],userId:'12345678-1234-4123-8123-123456789abd',secret,cryptoImpl:webcrypto});
 assert.match(a,/^[a-f0-9]{64}$/);
 assert.notEqual(a,b);
 assert.notEqual(a,list[0]);
});
test('shared home IP and multiple devices do not create a one-account rule',()=>{
 assert.equal(policy.decideSignupRisk({ipHour:4,ipDay:18,deviceDay:1,challengeVerified:true}),'allow');
 assert.equal(policy.decideSignupRisk({ipHour:13,ipDay:22,deviceDay:1,challengeVerified:true}),'review');
 assert.equal(policy.decideSignupRisk({ipHour:13,ipDay:22,deviceDay:1,challengeVerified:false}),'challenge');
 assert.equal(policy.decideSignupRisk({ipHour:3,ipDay:10,deviceDay:4,challengeVerified:true}),'review');
 assert.equal(policy.decideSignupRisk({ipHour:101,ipDay:150,deviceDay:1,challengeVerified:true}),'temporarily-deny');
 assert.equal(policy.decideSignupRisk({ipHour:1,ipDay:1,usernameHour:5,challengeVerified:true}),'deny');
});
test('unknown-user failures are indistinguishable from incorrect passwords',()=>{
 const message=policy.safeAuthFailure();
 assert.equal(message.error,'Invalid username or password.');
 assert.equal(Object.prototype.hasOwnProperty.call(message,'email'),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {describeAuthError} from '../src/auth-recovery.js';
const source=await readFile('src/app.js','utf8');
function setup(signin=async()=>({data:{user:{id:'owner'},session:{access_token:'session'}}})){
 const fields=Object.fromEntries(['email','password','username','signupConfirm','authmsg','signin','signup'].map(id=>[id,{value:'',textContent:'',disabled:false}]));fields.email.value='kai@gmail.com';fields.password.value='a-private-password';fields.username.value='kai';fields.signupConfirm.value=fields.password.value;
 const calls=[],boots=[],cleared=[];const ctx={busy:false,accountGeneration:1,$:id=>fields[id],authRestore:{hide(){}},describeAuthError,db:{auth:{signInWithPassword:async args=>{calls.push(args);return signin(args)}}},authAction:async(action,body)=>{calls.push({action,body});return{ok:true}},clearAuthPasswords:()=>{cleared.push(true);fields.password.value=fields.signupConfirm.value=''},boot:async user=>boots.push(user.id)};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function auth(kind)'),source.indexOf("$('signin').onclick")),ctx);return{ctx,fields,calls,boots,cleared};
}
test('Gmail address and password use Supabase email sign-in without username lookup',async()=>{
 const h=setup();await h.ctx.auth('signin');assert.equal(h.calls.length,1);assert.equal(h.calls[0].email,'kai@gmail.com');assert.equal(h.calls[0].password,'a-private-password');assert.deepEqual(h.boots,['owner']);assert.equal(h.fields.password.value,'');assert.equal(h.fields.signin.disabled,false);
});
test('invalid email or incomplete credentials never send a sign-in request',async()=>{
 for(const email of ['kai','a@b@c.com','bad address@gmail.com']){const h=setup();h.fields.email.value=email;await h.ctx.auth('signin');assert.equal(h.calls.length,0);assert.match(h.fields.authmsg.textContent,/valid email/)}
});
test('a missing session cannot unlock the app, and wrong passwords retain the sign-in form',async()=>{
 for(const reply of [{data:{user:{id:'owner'},session:null}},{error:{code:'invalid_credentials'}}]){const h=setup(async()=>reply);await h.ctx.auth('signin');assert.equal(h.boots.length,0);assert.ok(h.fields.authmsg.textContent);assert.equal(h.fields.signin.disabled,false);assert.equal(h.fields.password.value,'a-private-password')}
});
test('provider outages are reported as availability errors rather than incorrect credentials',async()=>{
 const h=setup(async()=>({error:{status:503,message:'Service unavailable'}}));await h.ctx.auth('signin');assert.match(h.fields.authmsg.textContent,/temporarily unavailable/);assert.equal(h.boots.length,0);
});
test('duplicate submissions are suppressed and an obsolete result cannot restore a signed-out account',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r}),h=setup(()=>pending);const first=h.ctx.auth('signin');await h.ctx.auth('signin');assert.equal(h.calls.length,1);h.ctx.accountGeneration++;resolve({data:{user:{id:'owner'},session:{access_token:'session'}}});await first;assert.equal(h.boots.length,0);assert.equal(h.cleared.length,0);
});
test('email signup validates confirmation and waits for email confirmation without opening Chats',async()=>{
 const h=setup();h.fields.signupConfirm.value='different';await h.ctx.auth('signup');assert.equal(h.calls.length,0);h.fields.signupConfirm.value=h.fields.password.value;await h.ctx.auth('signup');assert.equal(h.calls[0].action,'signup');assert.equal(h.calls[0].body.email,'kai@gmail.com');assert.equal(h.calls[0].body.username,'kai');assert.equal(h.boots.length,0);assert.match(h.fields.authmsg.textContent,/Check your email for confirmation/);
});
test('unconfirmed accounts receive email confirmation guidance',()=>{assert.match(describeAuthError({code:'email_not_confirmed'}),/confirm your email/)});

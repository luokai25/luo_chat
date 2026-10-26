import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
const digest=value=>createHash('sha256').update(value).digest('hex');
// Calls are now explicitly in scope; behavior is covered by calls-flow/call-effects tests.
test('Combined development update preserves live authentication, stories and configuration',async()=>{
 const expected={
  "src/auth-recovery.js": "dec3a845de0df5fea3fbf7d5cd84e3509a246c5ee44e727d662a535511a4e18d",
  "src/google-sign-in.js": "b66a66e214499bda486a2a671c7ab206fadc48631811f6bb18976ca65f99fbd3",
  "src/settings.js": "dbefb1f5499c63c933df432650b6aa1006fa549f932a130975ce27829b6642c7",
  "src/experience.js": "373bf4615bcb49eca707f2217b55cd2cbad53a20b84dd9e06355b0e63bfce14f",
  "src/config.js": "fa7a01c29835bd63f883ed6d092febcffa3389b586aa5135c99aa633327f55f2",
  "public/luo-session-boot.js": "2068acd5af69f38ccf4f25ab3647a39a2087dc4fe97307c3e4b400705c440b64",
  "public/luo-auth-premium.css": "e418ef836af858e4d53debe5726473753e708d091350eb7801793a3795c6deea"
};
 // Hosting changes are explicitly requested for SEO/security. Their invariants
 // are tested semantically in site-quality, rather than freezing the old file.
 for(const [path,hash] of Object.entries(expected))assert.equal(digest(await readFile(path)),hash,path+' must match the live backup');
 const connections=await readFile('src/connections.js','utf8');
 for(const action of ['get_chat_person','change_chat_connection','set_chat_user_block'])assert.ok(connections.includes(action),'Profile UI must retain the original authorized action '+action);
 assert.match(connections,/getUser\(\)\?\.id/,'Profile actions must retain authenticated account scope');
 assert.match(connections,/personRequest/,'Stale profile requests must remain cancellable');
 const stories=await readFile('src/stories.js','utf8');
 assert.match(stories,/create_private_chat_story/,'Original authorized story upload must remain');
 assert.match(stories,/createSignedUrl\(story.media_path,60\)/,'Private signed media URLs must remain short-lived');
 assert.match(stories,/dataset\.storyOwn/,'Redesigned status surface must receive real owner metadata');
 assert.match(stories,/chat_story_reactions/,'Private story reactions must remain bound to the backend');
 const pkg=JSON.parse(await readFile('package.json','utf8')),lock=JSON.parse(await readFile('package-lock.json','utf8'));
 assert.deepEqual(pkg.dependencies,{'@supabase/supabase-js':'2.118.0',gifenc:'1.0.3',qrcode:'1.5.4'});
 assert.equal(pkg.devDependencies['@electric-sql/pglite'],'0.5.11');
 assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);
 const dom=new JSDOM(await readFile('public/index.html','utf8'));
 try{
  const form=dom.window.document.getElementById('auth');
  for(const id of ['signin','signup','email','password','username','signupConfirm','signupBirthDate','guardianApproval'])assert.ok(form.querySelector('#'+id),'Missing auth field '+id);
  assert.equal(form.querySelector('#signupBirthDate')?.getAttribute('type'),'date');
  assert.ok(form.querySelector('#ageSignupHelp')?.textContent.includes('Minimum age: 12'));
  assert.ok(form.querySelector('#guardianApproval')?.classList.contains('signup-only'));
  assert.ok(form.querySelector('#authModeSignin')&&form.querySelector('#authModeSignup'));
 }finally{dom.window.close()}
});
test('Social is the fifth navigation item and the retired Notes UI is absent',async()=>{
 const nav=await readFile('public/luo-approved.js','utf8'),social=await readFile('src/social-spaces.js','utf8'),app=await readFile('src/app.js','utf8');
 assert.ok(nav.includes("['Calls','phone','calls'],['Social','social','social']"));
 assert.ok(!social.includes("['notes','Notes']")&&!social.includes("key==='notes'"));
 assert.doesNotMatch(app,/installChatNotesRibbon/);
});

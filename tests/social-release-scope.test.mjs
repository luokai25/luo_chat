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
  "src/stories.js": "247d331ab656fcada46aad43c8a9180b957cd4479e1394ef711d5a72cc53c763",
  "src/settings.js": "dbefb1f5499c63c933df432650b6aa1006fa549f932a130975ce27829b6642c7",
  "src/experience.js": "373bf4615bcb49eca707f2217b55cd2cbad53a20b84dd9e06355b0e63bfce14f",
  "src/connections.js": "8ac1249cfbb4ef6e530a62ce13d24bdf77f7c347a876182cf51cb38d71b39a29",
  "src/config.js": "fa7a01c29835bd63f883ed6d092febcffa3389b586aa5135c99aa633327f55f2",
  "public/luo-session-boot.js": "2068acd5af69f38ccf4f25ab3647a39a2087dc4fe97307c3e4b400705c440b64",
  "public/luo-auth-premium.css": "e418ef836af858e4d53debe5726473753e708d091350eb7801793a3795c6deea",
  "vercel.json": "6009db6f855892388a6656a797dfdcc140ac5ea7505d3aca06a347bb408bfe65"
};
 for(const [path,hash] of Object.entries(expected))assert.equal(digest(await readFile(path)),hash,path+' must match the live backup');
 const pkg=JSON.parse(await readFile('package.json','utf8')),lock=JSON.parse(await readFile('package-lock.json','utf8'));
 assert.deepEqual(pkg.dependencies,{'@supabase/supabase-js':'2.118.0',gifenc:'1.0.3',qrcode:'1.5.4'});
 assert.equal(pkg.devDependencies['@electric-sql/pglite'],'0.5.11');
 assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);
 const dom=new JSDOM(await readFile('public/index.html','utf8'));
 try{assert.equal(digest(dom.window.document.getElementById('auth').outerHTML),'c1b8286a9c27671aee575d024e2f1a382876fe1d241eea2a4a8a3acdef3702c9')}finally{dom.window.close()}
});
test('Social is the fifth navigation item and the retired Notes UI is absent',async()=>{
 const nav=await readFile('public/luo-approved.js','utf8'),social=await readFile('src/social-spaces.js','utf8'),app=await readFile('src/app.js','utf8');
 assert.ok(nav.includes("['Calls','phone','calls'],['Social','social','social']"));
 assert.ok(!social.includes("['notes','Notes']")&&!social.includes("key==='notes'"));
 assert.doesNotMatch(app,/installChatNotesRibbon/);
});

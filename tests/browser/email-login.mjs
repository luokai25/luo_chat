// Full rendered app with synthetic Auth/storage. Never uses a real password or sends mail.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {installBrowserFixture} from './fixture.mjs';
const output=resolve('test-results/email-login');await mkdir(output,{recursive:true});
const bundle=await build({entryPoints:['src/app.js'],bundle:true,write:false,format:'esm',target:'es2022',define:{'process.env.LUO_SUPABASE_URL':'""','process.env.LUO_SUPABASE_KEY':'""'},plugins:[{name:'synthetic-backend',setup(p){p.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'fixture',namespace:'fixture'}));p.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=()=>window.__luoBrowserFixture.db;'}))}}]});
const root=resolve('public'),server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].contents)}const file=resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end()}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.LUO_BROWSER_CHANNEL?{channel:process.env.LUO_BROWSER_CHANNEL}:{}),args:['--no-sandbox']}),checks=[],errors=[];
try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await context.addInitScript(installBrowserFixture);
  await context.addInitScript(()=>{window.__emailActions=[];window.__luoBrowserFixture.db.functions.invoke=async(name,{body})=>{window.__emailActions.push({name,...body});return{data:{ok:true},error:null}}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/?signedout=1');await page.locator('#signin').waitFor();
  assert.equal(await page.locator('#email').getAttribute('type'),'email');assert.equal(await page.locator('#googleSignIn,#forgetLuoEmail,#manageLuoRecovery').count(),0);
  await page.waitForTimeout(3800);assert.equal(await page.locator('.app').getAttribute('data-screen'),'auth');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:output+'/email-'+width+'.png'});
  await page.locator('#email').fill('kai@gmail.com');await page.locator('#password').fill('test-luo-chat-password');await page.locator('#password').press('Enter');await page.locator('.chatrow').first().waitFor();
  const calls=await page.evaluate(()=>window.__luoBrowserFixture.calls.filter(x=>x.name==='email-signin'));assert.equal(calls.length,1);assert.equal(calls[0].args.email,'kai@gmail.com');
  await page.locator('.workspace-nav [data-tab=social]').evaluate(e=>e.click());await page.locator('.luo-feed').waitFor();
  await page.locator('#logout').evaluate(e=>e.click());await page.waitForFunction(()=>document.querySelector('.app')?.dataset.screen==='auth');assert.equal(await page.locator('#password').inputValue(),'');
  if(width===390){
   await page.locator('#authModeSignup').click();await page.locator('#email').fill('kai@gmail.com');await page.locator('#username').fill('kai_profile');await page.locator('#password').fill('test-luo-chat-password');await page.locator('#signupConfirm').fill('test-luo-chat-password');await page.locator('#signup').click();await page.getByText(/Check your email for confirmation/).waitFor();
   assert.equal(await page.locator('.app').getAttribute('data-screen'),'auth');await page.locator('#authModeSignin').click();await page.locator('#forgot').click();await page.getByText(/a recovery link has been sent/).waitFor();
   const actions=await page.evaluate(()=>window.__emailActions);assert.equal(actions.filter(x=>x.action==='signup').length,1);assert.equal(actions.filter(x=>x.action==='reset').length,1);assert.ok(actions.every(x=>x.email==='kai@gmail.com'));
  }
  checks.push({width,emailSignIn:true,signupAndRecovery:width===390,stableSignedOutScreen:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(output+'/results.json',JSON.stringify({checks,errors,scope:'Actual UI; synthetic backend. No live accounts, messages or emails.'},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r))}

// Actual app modules and styles with synthetic data. No hosted writes or real accounts.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {installBrowserFixture} from './fixture.mjs';
const folder=resolve('test-results/social-feed');await mkdir(folder,{recursive:true});
const bundle=await build({entryPoints:['src/app.js'],bundle:true,write:false,format:'esm',target:'es2022',define:{'process.env.LUO_SUPABASE_URL':'""','process.env.LUO_SUPABASE_KEY':'""'},plugins:[{name:'synthetic-backend',setup(p){p.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'fixture',namespace:'fixture'}));p.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=()=>window.__luoBrowserFixture.db;'}))}}]});
const root=resolve('public'),server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].contents)}const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end()}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.LUO_BROWSER_CHANNEL?{channel:process.env.LUO_BROWSER_CHANNEL}:{}),args:['--no-sandbox']}),checks=[],errors=[];
try{
 const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(installBrowserFixture);
 await context.addInitScript(()=>{
  const {db,data}=window.__luoBrowserFixture,old=db.rpc.bind(db),friend=data.profiles[1],owner=data.profiles[0];
  const row=(id,kind,audience,body)=>({id,kind,owner_id:friend.id,published:true,audience,body,created_at:'2026-10-24T08:00:00Z',author:{...friend,display_name:'Luo Kai',username:'luo_kai'},mine:{},reactions:12,comments:2,media:kind==='clip'?[{path:friend.id+'/'+id+'/clip.webm'}]:[]});
  window.__socialCalls=[];
  db.rpc=async(name,args)=>{if(name!=='luo_space')return old(name,args);window.__socialCalls.push(args);
   if(args.action==='feed'){if(args.input.before)return{data:[]};if(args.input.kind==='post')return{data:[row('post-one','post','friends','The best moments are the ones we share. ✦'),row('post-two','post','public','A little light in an ordinary day.')]};if(args.input.kind==='clip')return{data:[row('clip-one','clip','public','Golden hour, wherever we are. ✨'),row('clip-two','clip','friends','A small moment, just for friends.')]};return{data:[]}}
   if(args.action==='responses')return{data:[{username:owner.username,body:'Love this moment ✨'}]};return{data:{}};
  };
  db.storage={from:()=>({createSignedUrl:async path=>({data:{signedUrl:'https://byjixqwpjvsgmqilmzbm.supabase.co/storage/v1/object/sign/luo-social/'+path}})})};
 });
 // Short test video created locally in the browser, with no external assets.
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.chatrow').first().waitFor();
 const bytes=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=360;c.height=640;const ctx=c.getContext('2d'),stream=c.captureStream(20),chunks=[],rec=new MediaRecorder(stream,{mimeType:'video/webm'});const done=new Promise(resolve=>rec.onstop=resolve);rec.ondataavailable=e=>chunks.push(e.data);rec.start();for(let i=0;i<18;i++){const g=ctx.createLinearGradient(0,0,360,640);g.addColorStop(0,'#111a26');g.addColorStop(.6,'#75512e');g.addColorStop(1,'#e5bb6e');ctx.fillStyle=g;ctx.fillRect(0,0,360,640);ctx.fillStyle='#ffe4a1';ctx.beginPath();ctx.arc(210+i/3,290,72,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0b1119';ctx.beginPath();ctx.moveTo(0,550);ctx.lineTo(160,360);ctx.lineTo(360,570);ctx.lineTo(360,640);ctx.lineTo(0,640);ctx.fill();await new Promise(r=>setTimeout(r,50))}rec.stop();await done;stream.getTracks().forEach(t=>t.stop());return [...new Uint8Array(await new Blob(chunks).arrayBuffer())]});
 await context.route('https://byjixqwpjvsgmqilmzbm.supabase.co/storage/v1/object/sign/luo-social/**',route=>route.fulfill({contentType:'video/webm',body:Buffer.from(bytes)}));
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:width===320?740:900});
  await page.locator('.workspace-nav [data-tab="social"]').evaluate(e=>e.click());
  await page.getByRole('button',{name:'Friends',exact:true}).click();await page.locator('.luo-feed-card').first().waitFor();
  assert.equal(await page.locator('.luo-core-character,.luo-core-overlay,.luo-core-restore').count(),0);
  const box=await page.locator('#social').boundingBox();assert.ok(box&&box.height>350,'Social has usable height at '+width);assert.equal(await page.locator('#social').evaluate(e=>getComputedStyle(e).padding),'0px','No duplicated legacy padding at '+width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow at '+width);
  const friends=await page.evaluate(()=>window.__socialCalls.filter(x=>x.action==='feed'&&x.input.mode==='friends'));assert.ok(friends.length>=2);
  await page.screenshot({path:folder+'/friends-'+width+'.png'});
  await page.getByRole('button',{name:'Public',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.luo-feed-card').length===2);
  assert.equal(await page.locator('[data-entry-id="post-one"]').count(),0);
  await page.getByRole('button',{name:'Clips',exact:true}).click();await page.locator('.luo-feed-reels').waitFor();await page.locator('.luo-feed-card').first().waitFor();
  const card=await page.locator('.luo-feed-card').first().boundingBox();const viewport=await page.locator('.luo-feed-list').boundingBox();assert.ok(Math.abs(card.height-viewport.height)<3,'One clip per viewport at '+width);
  await page.getByRole('button',{name:'Play clip',exact:true}).first().click();await page.locator('video').first().waitFor();await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.paused&&v.readyState>=2});
  await page.screenshot({path:folder+'/clips-'+width+'.png'});
  await page.getByRole('button',{name:'Love · 12',exact:true}).first().click();await page.getByRole('button',{name:'Love · 13',exact:true}).waitFor();
  await page.getByRole('button',{name:'Comments · 2',exact:true}).first().click();await page.getByRole('dialog',{name:'Comments',exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Your comment',exact:true}).fill('This looks lovely.');await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText('Comment sent.',{exact:true}).waitFor();await page.getByRole('button',{name:'Close comments',exact:true}).click();
  await page.locator('.workspace-nav [data-tab="chats"]').evaluate(e=>e.click());assert.equal(await page.locator('#social video').count(),0);
  checks.push({width,viewport:Math.round(viewport.height),clipHeight:Math.round(card.height),passed:true});
 }
 assert.deepEqual(errors,[]);await writeFile(folder+'/results.json',JSON.stringify({checks,errors,scope:'Actual app/CSS; synthetic backend and locally generated video; no hosted writes.'},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r))}

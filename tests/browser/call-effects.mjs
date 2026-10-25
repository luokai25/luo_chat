// Native media rendering + actual call UI. Transport is a fixture, not a successful RTP call.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const allowed=new Map([
 ...['calls.js','call-effects.js','call-experience.js','call-recovery.js','call-quality.js'].map(p=>['/'+p,'src/'+p]),
 ...['style.css','luo-modern.css','luo-call-quality.css'].map(p=>['/'+p,'public/'+p])
]);
const server=createServer(async(req,res)=>{
 try{if(allowed.has(req.url)){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/javascript');return res.end(await readFile(allowed.get(req.url)))}
 if(req.url!=='/'){res.writeHead(404);return res.end()}
 res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/luo-modern.css"><link rel="stylesheet" href="/luo-call-quality.css"><p id="note"></p><script type="module">
 import {installCalls} from '/calls.js';
 window.qaPeers=[];
 class FixturePeer{
  constructor(){this.senders=[];qaPeers.push(this);this.connectionState='connected'}
  addTrack(track){this.senders.push({track,async replaceTrack(value){this.track=value}})}
  getSenders(){return this.senders}close(){this.connectionState='closed'}
  async createOffer(){return {type:'offer',sdp:'synthetic-no-network'}}
  async setLocalDescription(value){this.localDescription=value}
 }
 window.RTCPeerConnection=FixturePeer;
 window.fetch=async()=>({ok:true,json:async()=>({iceServers:[],relayConfigured:false})});
 const row={id:'fixture-call',caller_id:'a',status:'active',created_at:new Date().toISOString(),callee_ice:[]};
 window.rpcCalls=[];
 const db={auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})},rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:name==='start_luo_call'?row.id:true}},from(){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:row})}}};
 const $=id=>document.getElementById(id);
 window.api=installCalls({win:window,db,$,getUser:()=>({id:'a'}),getCurrent:()=>({id:'fixture-room',kind:'direct'}),note:s=>$('note').textContent=s});
 window.ready=true;
 </script>`);
 }catch{res.writeHead(500);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['camera','microphone']});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready);
 await page.evaluate(()=>api.open('video'));await page.locator('#beginCall').click();await page.waitForFunction(()=>!document.getElementById('endCall').hidden);
 const original=await page.evaluate(()=>{window.rawVideo=qaPeers[0].getSenders().find(s=>s.track.kind==='video').track;window.rawAudio=qaPeers[0].getSenders().find(s=>s.track.kind==='audio').track;return rawVideo.readyState});assert.equal(original,'live');
 await page.locator('#callEffectsToggle').click();await page.locator('[data-effect="mono"]').click();await page.waitForFunction(()=>document.querySelector('[data-effect="mono"]').getAttribute('aria-pressed')==='true');
 const media=await page.evaluate(async()=>{
  const sender=qaPeers[0].getSenders().find(s=>s.track.kind==='video');
  const sink=document.createElement('video');sink.muted=true;sink.playsInline=true;sink.srcObject=new MediaStream([sender.track]);await sink.play();await new Promise(r=>setTimeout(r,500));
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;const c=canvas.getContext('2d');c.drawImage(sink,0,0,64,48);const data=c.getImageData(0,0,64,48).data;
  let chroma=0,light=0;for(let i=0;i<data.length;i+=4){chroma+=Math.abs(data[i]-data[i+1])+Math.abs(data[i+1]-data[i+2]);light+=data[i]}
  const result={processedSender:sender.track!==rawVideo,previewMatchesSender:document.getElementById('callLocal').srcObject.getVideoTracks()[0]===sender.track,audioUnchanged:qaPeers[0].getSenders().find(s=>s.track.kind==='audio').track===rawAudio,chroma:chroma/(data.length/4),luminance:light/(data.length/4),settings:sender.track.getSettings()};sink.pause();sink.srcObject=null;return result;
 });
 assert.equal(media.processedSender,true);assert.equal(media.previewMatchesSender,true);assert.equal(media.audioUnchanged,true);assert.ok(media.chroma<1);assert.ok(media.luminance>5);assert.ok(media.settings.width<=1280&&media.settings.height<=720);
 await page.locator('#callEffectsSheet button').first().click();await page.locator('#cameraCall').click();assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track.enabled),false);await page.locator('#cameraCall').click();
 await page.locator('#callHold').click();assert.ok(await page.evaluate(()=>qaPeers[0].getSenders().every(s=>!s.track.enabled)));await page.locator('#callHold').click();
 await page.locator('#switchCallCamera').click();await page.waitForFunction(()=>!document.getElementById('switchCallCamera').disabled);assert.equal(await page.locator('[data-effect="mono"]').getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track===document.getElementById('callLocal').srcObject.getVideoTracks()[0]),true);
 const layouts=[];
 await mkdir('test-results/call-effects',{recursive:true});
 for(const size of [{width:320,height:640},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
  await page.setViewportSize(size);await page.locator('#callEffectsToggle').click();await page.locator('#callEffectsSheet').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
  const layout=await page.evaluate(()=>{const d=document.getElementById('luoCall').getBoundingClientRect(),s=document.getElementById('callEffectsSheet').getBoundingClientRect();return {dialogWidth:d.width,sheetWidth:s.width,sheetBottom:s.bottom,viewport:innerWidth,height:innerHeight}});assert.ok(layout.sheetWidth<=layout.viewport+1);assert.ok(layout.sheetBottom<=layout.height+1);layouts.push(layout);
  await page.screenshot({path:'test-results/call-effects/'+size.width+'x'+size.height+'.png'});await page.locator('#callEffectsSheet button').first().click();
 }
 await page.locator('#callEffectsToggle').click();await page.locator('[data-effect="original"]').click();await page.waitForFunction(()=>document.querySelector('[data-effect="original"]').getAttribute('aria-pressed')==='true');assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track.label.includes('Canvas')),false);
 await page.locator('#callEffectsSheet button').first().click();await page.locator('#endCall').click();await page.waitForFunction(()=>qaPeers[0].connectionState==='closed');assert.equal(await page.evaluate(()=>rawAudio.readyState),'ended');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,transport:'Fixture only; no RTP connection claimed',media,layouts,pageExceptions:errors.length},null,2));await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r))}

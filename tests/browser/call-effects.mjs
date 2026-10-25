// Native media rendering + actual call UI. Transport is a fixture, not a successful RTP call.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const allowed=new Map([
 ...['calls.js','call-effects.js','call-experience.js','call-screen-share.js','call-recovery.js','call-quality.js','call-shell.js','call-media-state.js','call-lens-browser.js','avatars.js'].map(p=>['/'+p,'src/'+p]),
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
  createDataChannel(label){this.channel={label,readyState:'open',send(){},close(){}};return this.channel}
 }
 window.RTCPeerConnection=FixturePeer;
 window.qaDisplays=[];window.qaDisplayRequests=[];window.qaRejectDisplay=false;
 // A synthetic display chooser returning native canvas video, never a real screen grant.
 navigator.mediaDevices.getDisplayMedia=async options=>{qaDisplayRequests.push(options);if(qaRejectDisplay){qaRejectDisplay=false;throw new DOMException('Cancelled','NotAllowedError')}const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const c=canvas.getContext('2d');c.fillStyle='#1673cc';c.fillRect(0,0,640,360);const stream=canvas.captureStream(15);qaDisplays.push(stream);return stream};
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
 async function secondary(id){if(!await page.locator('#'+id).isVisible())await page.locator('#callMore').click();await page.locator('#'+id).click();if(await page.locator('#callMoreClose').isVisible())await page.locator('#callMoreClose').click()}
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready);
 await page.evaluate(()=>api.open('video'));await page.locator('#beginCall').click();await page.waitForFunction(()=>!document.getElementById('endCall').hidden);
 const original=await page.evaluate(()=>{window.rawVideo=qaPeers[0].getSenders().find(s=>s.track.kind==='video').track;window.rawAudio=qaPeers[0].getSenders().find(s=>s.track.kind==='audio').track;return rawVideo.readyState});assert.equal(original,'live');
 await page.evaluate(()=>{const track=rawVideo.clone();window.qaRemoteTrack=track;qaPeers[0].ontrack({track,streams:[new MediaStream([track])]})});await page.waitForFunction(()=>document.getElementById('callRemotePlaceholder').hidden);
 await page.locator('#callMinimize').click();await page.waitForFunction(()=>!document.getElementById('luoMiniCall').hidden);assert.equal(await page.evaluate(()=>qaPeers[0].connectionState),'connected');assert.equal(await page.evaluate(()=>rawAudio.readyState),'live');await page.locator('#callRestore').click();assert.equal(await page.locator('#luoCall').evaluate(el=>el.open),true);
 await page.evaluate(()=>qaPeers[0].channel.onmessage({data:JSON.stringify({v:1,video:false,held:false})}));assert.equal(await page.locator('#callRemotePlaceholder').isVisible(),true);await page.evaluate(()=>qaPeers[0].channel.onmessage({data:JSON.stringify({v:1,video:true,held:false})}));await page.waitForFunction(()=>document.getElementById('callRemotePlaceholder').hidden);
 await page.locator('#callMore').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#callMoreSheet').isVisible(),false);assert.equal(await page.locator('#luoCall').evaluate(el=>el.open),true);
 await page.locator('#callEffectsToggle').click();await page.locator('[data-effect="mono"]').click();await page.waitForFunction(()=>document.querySelector('[data-effect="mono"]').getAttribute('aria-pressed')==='true');
 const media=await page.evaluate(async()=>{
  const sender=qaPeers[0].getSenders().find(s=>s.track.kind==='video');
  const sink=document.createElement('video');sink.muted=true;sink.playsInline=true;sink.srcObject=new MediaStream([sender.track]);await sink.play();await new Promise(r=>setTimeout(r,500));
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;const c=canvas.getContext('2d');c.drawImage(sink,0,0,64,48);const data=c.getImageData(0,0,64,48).data;
  let chroma=0,light=0;for(let i=0;i<data.length;i+=4){chroma+=Math.abs(data[i]-data[i+1])+Math.abs(data[i+1]-data[i+2]);light+=data[i]}
  const result={processedSender:sender.track!==rawVideo,previewMatchesSender:document.getElementById('callLocal').srcObject.getVideoTracks()[0]===sender.track,audioUnchanged:qaPeers[0].getSenders().find(s=>s.track.kind==='audio').track===rawAudio,chroma:chroma/(data.length/4),luminance:light/(data.length/4),settings:sender.track.getSettings()};sink.pause();sink.srcObject=null;return result;
 });
 assert.equal(media.processedSender,true);assert.equal(media.previewMatchesSender,true);assert.equal(media.audioUnchanged,true);assert.ok(media.chroma<1);assert.ok(media.luminance>5);assert.ok(media.settings.width<=1280&&media.settings.height<=720);
 await page.locator('#callBrowseEffects').click();await page.locator('#callEffectSearch').fill('Mono');assert.equal(await page.locator('.luo-effects-carousel button:visible').count(),1);await page.locator('#callFavoriteEffect').click();await page.locator('#callEffectSearch').fill('');await page.locator('#callEffectCategory').selectOption('favorites');assert.equal(await page.locator('.luo-effects-carousel button:visible').count(),1);await page.screenshot({path:'test-results/call-effects/effect-library.png'});await page.locator('#callEffectCategory').selectOption('all');await page.locator('#callBrowseEffects').click();
 await page.locator('#callEffectsSheet button').first().click();
 assert.equal(await page.evaluate(()=>qaDisplayRequests.length),0);
 await page.evaluate(()=>window.qaCameraBeforeShare=qaPeers[0].getSenders().find(s=>s.track.kind==='video').track);
 await secondary('callShareScreen');await page.waitForFunction(()=>document.getElementById('callShareScreen').textContent==='Stop sharing');
 assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track===qaDisplays[0].getVideoTracks()[0]),true);
 assert.equal(await page.locator('#callEffectsToggle').isDisabled(),true);assert.equal(await page.locator('#switchCallCamera').isDisabled(),true);
 assert.equal(await page.evaluate(()=>rawVideo.enabled),false);assert.equal(await page.evaluate(()=>rawAudio.enabled),true);
 const screenPixels=await page.evaluate(async()=>{const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=new MediaStream([qaPeers[0].getSenders().find(s=>s.track.kind==='video').track]);await video.play();await new Promise(r=>setTimeout(r,100));const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d');c.drawImage(video,0,0,1,1);const pixel=[...c.getImageData(0,0,1,1).data];video.pause();video.srcObject=null;return pixel});assert.ok(screenPixels[2]>150&&screenPixels[0]<50);
 await mkdir('test-results/call-effects',{recursive:true});await page.screenshot({path:'test-results/call-effects/screen-sharing-390.png'});
 await secondary('callHold');assert.equal(await page.evaluate(()=>qaDisplays[0].getVideoTracks()[0].enabled),false);await secondary('callHold');
 await page.locator('#cameraCall').click();assert.equal(await page.evaluate(()=>qaDisplays[0].getVideoTracks()[0].enabled),false);await page.locator('#cameraCall').click();
 await secondary('callShareScreen');await page.waitForFunction(()=>document.getElementById('callShareScreen').textContent==='Share screen');
 assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track===qaCameraBeforeShare),true);assert.equal(await page.evaluate(()=>qaDisplays[0].getVideoTracks()[0].readyState),'ended');assert.equal(await page.evaluate(()=>rawVideo.enabled),true);
 await page.evaluate(()=>window.qaRejectDisplay=true);await secondary('callShareScreen');await page.waitForFunction(()=>document.getElementById('callStatus').textContent.includes('cancelled'));assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track===qaCameraBeforeShare),true);
 await secondary('callShareScreen');await page.waitForFunction(()=>document.getElementById('callShareScreen').textContent==='Stop sharing');await page.evaluate(()=>{const track=qaDisplays.at(-1).getVideoTracks()[0];track.stop();track.dispatchEvent(new Event('ended'))});await page.waitForFunction(()=>document.getElementById('callShareScreen').textContent==='Share screen');assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track===qaCameraBeforeShare),true);
 await page.locator('#cameraCall').click();assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track.enabled),false);await page.locator('#cameraCall').click();
 await secondary('callHold');assert.ok(await page.evaluate(()=>qaPeers[0].getSenders().every(s=>!s.track.enabled)));await secondary('callHold');
 await page.locator('#switchCallCamera').click();await page.waitForFunction(()=>!document.getElementById('switchCallCamera').disabled);assert.equal(await page.locator('[data-effect="mono"]').getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track===document.getElementById('callLocal').srcObject.getVideoTracks()[0]),true);
 const layouts=[];
 await mkdir('test-results/call-effects',{recursive:true});
 for(const size of [{width:320,height:640},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
  await page.setViewportSize(size);await page.locator('#callEffectsToggle').click();await page.locator('#callEffectsSheet').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
  const layout=await page.evaluate(()=>{const d=document.getElementById('luoCall').getBoundingClientRect(),s=document.getElementById('callEffectsSheet').getBoundingClientRect();return {dialogWidth:d.width,sheetWidth:s.width,sheetBottom:s.bottom,viewport:innerWidth,height:innerHeight}});assert.ok(layout.sheetWidth<=layout.viewport+1);assert.ok(layout.sheetBottom<=layout.height+1);layouts.push(layout);
  await page.screenshot({path:'test-results/call-effects/'+size.width+'x'+size.height+'.png'});await page.locator('#callEffectsSheet button').first().click();
  const dock=await page.locator('.device-actions').boundingBox();assert.ok(dock.width<=size.width-10);assert.ok(dock.height<110);assert.equal(await page.locator('#callRemote').evaluate(el=>getComputedStyle(el).objectFit),'cover');await page.screenshot({path:'test-results/call-effects/dock-'+size.width+'.png'});
 }
 await page.locator('#callEffectsToggle').click();await page.locator('[data-effect="original"]').click();await page.waitForFunction(()=>document.querySelector('[data-effect="original"]').getAttribute('aria-pressed')==='true');assert.equal(await page.evaluate(()=>qaPeers[0].getSenders().find(s=>s.track.kind==='video').track.label.includes('Canvas')),false);
 await page.locator('#callEffectsSheet button').first().click();await page.locator('#endCall').click();await page.waitForFunction(()=>qaPeers[0].connectionState==='closed');assert.equal(await page.evaluate(()=>rawAudio.readyState),'ended');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,transport:'Fixture only; no RTP connection claimed',immersive:{minimizeRestore:true,peerCameraOffPlaceholder:true,moreEscapeKeepsCall:true,searchAndSessionFavorites:true,fiveControlDockFitsAllViewports:true,defaultCover:true},media,screenSharing:{passed:true,displayChooser:'Synthetic, returning native canvas video; no real screen permission granted',nativeOutputPixel:screenPixels,checks:['explicit click only','screen sender selected','camera paused','microphone unchanged','hold and video pause','same effect restored','cancelled chooser','OS ended restoration']},layouts,pageExceptions:errors.length},null,2));await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r))}

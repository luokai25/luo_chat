import test from 'node:test';
import assert from 'node:assert/strict';
import {CALL_AR_EFFECTS,AR_THEMES,AR_ACCENTS,drawFaceOverlay} from '../src/call-ar-effects.js';
import {createFaceTracker} from '../src/call-face-tracker.js';
import {createCallEffects} from '../src/call-effects.js';

function fakeFace(){
 const dots=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
 dots[33]={x:.3,y:.43};dots[263]={x:.7,y:.45};dots[152]={x:.5,y:.83};dots[1]={x:.5,y:.54};return dots;
}
function drawing(){
 const state={draws:0,overlays:0,saves:0,restores:0};
 const ctx=new Proxy({filter:'none',fillStyle:'',strokeStyle:'',lineWidth:1,
 drawImage(){state.draws++},fillRect(){},save(){state.saves++},restore(){state.restores++},
 fill(){state.overlays++},stroke(){state.overlays++}},{
 get(target,prop){if(prop in target)return target[prop];return ()=>{}}
 });
 return {ctx,state};
}
function setup(factory){
 let id=0,current=true,draw=drawing();
 const intervals=new Map();
 const raw={kind:'video',id:'raw',enabled:true,getSettings(){return{width:640,height:360}},stop(){}};
 const audio={kind:'audio',id:'audio',enabled:true};
 class MediaStream{constructor(tracks){this.tracks=tracks}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}}
 const stream=new MediaStream([raw,audio]);
 const sender={track:raw,async replaceTrack(next){this.track=next}};
 const win={MediaStream,performance:{now:()=>500},setTimeout,clearTimeout,
 setInterval(fn){intervals.set(++id,fn);return id},clearInterval(k){intervals.delete(k)},
 document:{createElement(kind){if(kind==='video')return{muted:false,playsInline:false,srcObject:null,videoWidth:640,videoHeight:360,readyState:2,pause(){},async play(){}};
 return{width:0,height:0,getContext:()=>draw.ctx,captureStream(){return new MediaStream([{kind:'video',id:'generated',enabled:true,stop(){this.stopped=true}}])}}}}};
 const engine=createCallEffects({win,peer:{getSenders:()=>[sender]},getStream:()=>stream,isCurrent:()=>current,
 faceTrackerFactory:factory,onPreview:()=>{}});
 return{engine,win,sender,raw,audio,draw,intervals,stop(){current=false;engine.stop()},tick(){for(const tick of [...intervals.values()])tick()}};
}
test('240 unique actual face-anchored AR combinations have distinct identities, not mere recoloring',()=>{
 assert.equal(AR_THEMES.length,20);assert.equal(AR_ACCENTS.length,12);assert.equal(CALL_AR_EFFECTS.length,240);
 assert.equal(new Set(CALL_AR_EFFECTS.map(x=>x.id)).size,240);
 assert.equal(new Set(CALL_AR_EFFECTS.map(x=>x.theme)).size,20);
 assert.equal(new Set(CALL_AR_EFFECTS.map(x=>x.accent)).size,12);
 assert.ok(CALL_AR_EFFECTS.every(e=>e.kind==='ar'&&e.filter==='none'));
 const drawingState=drawing(),face=fakeFace();
 assert.equal(drawFaceOverlay(drawingState.ctx,face,640,360,CALL_AR_EFFECTS[0],0),true);
 assert.ok(drawingState.state.overlays>0);
 assert.equal(drawingState.state.saves,drawingState.state.restores);
 assert.equal(drawFaceOverlay(drawingState.ctx,null,640,360,CALL_AR_EFFECTS[0],0),false);
});
test('pinned offline-frame tracker detects on device, throttles inference, and closes cleanly',async()=>{
 let time=1000,detections=0,closes=0;
 const mock={FilesetResolver:{forVisionTasks:async()=>({})},
 FaceLandmarker:{createFromOptions:async(_wasm,options)=>{
 assert.equal(options.runningMode,'VIDEO');assert.equal(options.numFaces,1);
 return{detectForVideo(){detections++;return{faceLandmarks:[fakeFace()]}},close(){closes++}};
 }}};
 const tracker=await createFaceTracker({win:{document:{},performance:{now:()=>time}},
 loadModule:async()=>mock});
 const frame={readyState:2};
 assert.ok(tracker.detect(frame));assert.ok(tracker.detect(frame));assert.equal(detections,1);
 time+=120;assert.ok(tracker.detect(frame));assert.equal(detections,2);
 tracker.close();tracker.close();assert.equal(closes,1);assert.equal(tracker.detect(frame),null);
});
test('Selecting AR changes outgoing video track, draws anchored shapes and leaves audio untouched',async()=>{
 let closed=0;const s=setup(async()=>({detect:()=>fakeFace(),close(){closed++}}));
 try{const chosen=CALL_AR_EFFECTS.find(e=>e.theme==='dragon'&&e.accent==='hearts');
 assert.equal(await s.engine.select(chosen.id),true);
 assert.notEqual(s.sender.track,s.raw);assert.equal(s.engine.effect,chosen.id);
 s.tick();assert.ok(s.draw.state.draws>=2);assert.ok(s.draw.state.overlays>0);
 assert.equal(await s.engine.select('original'),true);assert.equal(s.sender.track,s.raw);assert.equal(closed,1);
 }finally{s.stop()}
});
test('Face-model load does not stall the active call; late tracker disposal on hangup is safe',async()=>{
 let allow;const pending=new Promise(resolve=>{allow=resolve});
 let closeCount=0;
 const s=setup(async()=>pending);
 try{
  assert.equal(await s.engine.select('mono'),true);
  const oldTrack=s.sender.track;
  const oldDraw=s.draw.state.draws;
  const choosing=s.engine.select('ar-cat-whiskers');
  await Promise.resolve();await Promise.resolve();
  s.tick();
  assert.equal(s.sender.track,oldTrack);
  assert.ok(s.draw.state.draws>oldDraw,'active video pipeline keeps producing frames while model loads');
  s.stop();allow({detect:()=>fakeFace(),close(){closeCount++}});
  await assert.rejects(choosing,/Call ended/);
  await Promise.resolve();
  assert.equal(closeCount,1);
 }finally{s.stop()}
});
test('Failed AR model initialization leaves existing video track and audio working',async()=>{
 const s=setup(async()=>{throw Error('Device unsupported')});
 try{
  await s.engine.select('mono');const old=s.sender.track;
  await assert.rejects(s.engine.select('ar-fox-stars'),/Device unsupported/);
  assert.equal(s.sender.track,old);
  const before=s.draw.state.draws;s.tick();assert.ok(s.draw.state.draws>before);
 }finally{s.stop()}
});

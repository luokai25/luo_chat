import test from 'node:test';import assert from 'node:assert/strict';
import {CALL_AR_EFFECTS,AR_THEMES,AR_ACCENTS,drawFaceOverlay} from '../src/call-ar-effects.js';
import {createFaceTracker,VISION_ROOT,VISION_MODEL} from '../src/call-face-tracker.js';
import {createCallEffects} from '../src/call-effects.js';

test('240 AR filters pair different geometry themes with distinct facial accessories, not only color adjustments',()=>{
 assert.equal(AR_THEMES.length,20);assert.equal(AR_ACCENTS.length,12);
 assert.equal(CALL_AR_EFFECTS.length,240);
 assert.equal(new Set(CALL_AR_EFFECTS.map(e=>e.id)).size,240);
 assert.equal(new Set(CALL_AR_EFFECTS.map(e=>e.theme)).size,20);
 assert.equal(new Set(CALL_AR_EFFECTS.map(e=>e.accent)).size,12);
 for(const e of CALL_AR_EFFECTS){assert.equal(e.kind,'ar');assert.equal(e.filter,'none')}
});
test('lens geometry follows normalized eye landmarks; invalid or missing face never paints',()=>{
 const calls=[],ctx={save(){calls.push('save')},restore(){calls.push('restore')},translate(){calls.push('translate')},rotate(){calls.push('rotate')},scale(){calls.push('scale')},beginPath(){},moveTo(){},lineTo(){},closePath(){},bezierCurveTo(){},ellipse(){},stroke(){calls.push('stroke')},fill(){calls.push('fill')},quadraticCurveTo(){}};
 const pts=Array.from({length:468},()=>({x:.5,y:.5}));
 pts[33]={x:.36,y:.4};pts[263]={x:.64,y:.41};pts[152]={x:.5,y:.86};pts[1]={x:.5,y:.57};
 assert.equal(drawFaceOverlay(ctx,pts,640,480,CALL_AR_EFFECTS[0],100),true);
 assert.ok(calls.includes('translate'));assert.ok(calls.includes('fill'));assert.ok(calls.includes('restore'));
 const before=calls.length;assert.equal(drawFaceOverlay(ctx,null,640,480,CALL_AR_EFFECTS[0]),false);
 assert.equal(calls.length,before);
});
test('on-device tracker is lazy, throttled, forgets landmarks and frees native runtime',async()=>{
 let now=1000,detects=0,closed=0,created=0;
 const runtime={FilesetResolver:{forVisionTasks:async p=>{assert.ok(p.startsWith(VISION_ROOT));return{}}},FaceLandmarker:{createFromOptions:async(_wasm,config)=>{created++;assert.equal(config.baseOptions.modelAssetPath,VISION_MODEL);assert.equal(config.runningMode,'VIDEO');return{detectForVideo(){detects++;return{faceLandmarks:[[{},{}]]}},close(){closed++}}}}};
 const tracker=await createFaceTracker({win:{document:{},performance:{now:()=>now}},loadModule:async()=>runtime});
 assert.equal(created,1);const video={readyState:4};
 assert.equal(tracker.detect(video).length,2);tracker.detect(video);assert.equal(detects,1);
 now+=130;tracker.detect(video);assert.equal(detects,2);tracker.close();tracker.close();assert.equal(closed,1);assert.equal(tracker.detect(video),null);
});
test('tracker fails closed and never silently sends untracked camera frames as AR',async()=>{
 await assert.rejects(createFaceTracker({win:{document:{},performance:{now:()=>100}},loadModule:async()=>{throw Error('offline')}}),/tracking unavailable/i);
});

test('an AR lens draws face geometry into the transmitted canvas track and restores the original',async()=>{
 const calls=[];let closed=0,next=0;
 const pts=Array.from({length:468},()=>({x:.5,y:.5}));
 pts[33]={x:.36,y:.4};pts[263]={x:.64,y:.4};pts[152]={x:.5,y:.84};pts[1]={x:.5,y:.56};
 const raw={kind:'video',id:'camera',enabled:true,getSettings:()=>({width:640,height:480}),stop(){calls.push('stop-raw')}};
 const mic={kind:'audio',id:'mic'};
 class Stream{constructor(t){this.tracks=t}getVideoTracks(){return this.tracks.filter(x=>x.kind==='video')}getAudioTracks(){return this.tracks.filter(x=>x.kind==='audio')}}
 const stream=new Stream([raw,mic]);
 const sender={track:raw,async replaceTrack(track){this.track=track;calls.push('replace')}};
 const context={filter:'none',fillStyle:'',strokeStyle:'',globalAlpha:1,save(){},restore(){},translate(){calls.push('face-drawn')},rotate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},bezierCurveTo(){},quadraticCurveTo(){},ellipse(){},stroke(){},fill(){},fillRect(){},drawImage(){calls.push('frame')}};
 const win={MediaStream:Stream,performance:{now:()=>1000},document:{createElement(type){if(type==='video')return{readyState:3,videoWidth:640,videoHeight:480,muted:false,srcObject:null,pause(){},async play(){}};return{width:0,height:0,getContext:()=>context,captureStream:()=>new Stream([{kind:'video',id:'processed',enabled:true,stop(){calls.push('stop-processed')}}])}}},
  setInterval:()=>++next,clearInterval(){},setTimeout(fn){return setTimeout(fn,0)},clearTimeout};
 const engine=createCallEffects({win,peer:{getSenders:()=>[sender]},getStream:()=>stream,
  faceTrackerFactory:async()=>({detect:()=>pts,close(){closed++}})});
 try{assert.equal(await engine.select(CALL_AR_EFFECTS[0].id),true);assert.equal(sender.track.id,'processed');
  assert.ok(calls.includes('face-drawn'));assert.ok(calls.includes('frame'));assert.equal(raw.enabled,true);
  assert.equal(await engine.select('original'),true);assert.equal(sender.track,raw);assert.equal(closed,1)
 }finally{engine.stop()}
 assert.equal(closed,1);
});

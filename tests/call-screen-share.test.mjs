import test from 'node:test';
import assert from 'node:assert/strict';
import {createCallScreenShare} from '../src/call-screen-share.js';
const gate=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup(){
 let current=true,permission=gate(),replace=null,rejectNext=false;
 const calls=[],states=[],failures=[],previews=[];let restored=0;
 const track=(kind,id)=>({kind,id,readyState:'live',enabled:true,onended:null,stop(){this.readyState='ended'},end(){this.readyState='ended';this.onended?.()}});
 const camera=track('video','filtered-camera'),audio=track('audio','microphone'),screen=track('video','screen'),systemAudio=track('audio','unexpected-system-audio');
 const tracks=[screen,systemAudio],stream={getTracks:()=>tracks,getVideoTracks:()=>tracks.filter(t=>t.kind==='video'),getAudioTracks:()=>tracks.filter(t=>t.kind==='audio'),removeTrack(t){tracks.splice(tracks.indexOf(t),1)}};
 const sender={track:camera,async replaceTrack(t){calls.push(t.id);if(replace)await replace;if(rejectNext){rejectNext=false;throw Error('cannot replace')}this.track=t}};
 const constraints=[],share=createCallScreenShare({win:{navigator:{mediaDevices:{getDisplayMedia:options=>{constraints.push(options);return permission.promise}}}},peer:{getSenders:()=>[sender,{track:audio}]},isCurrent:()=>current,onState:s=>states.push(s),onPreview:t=>previews.push(t),onRestore:()=>restored++,onFailure:s=>failures.push(s)});
 return {share,camera,audio,screen,systemAudio,sender,calls,states,failures,previews,constraints,restored:()=>restored,resolve:()=>permission.resolve(stream),deny:()=>permission.reject(Object.assign(Error('cancelled'),{name:'NotAllowedError'})),rejectReplacement(){rejectNext=true},replaceWait(p){replace=p},end(){current=false;share.stop()}};
}
test('sharing requests an explicit display grant only, sends its actual track, excludes audio, restores exact processed camera',async()=>{
 const s=setup();try{assert.equal(s.constraints.length,0);const start=s.share.start();assert.equal(s.constraints[0].audio,false);s.resolve();assert.equal(await start,true);assert.equal(s.sender.track,s.screen);assert.equal(s.systemAudio.readyState,'ended');assert.equal(s.audio.readyState,'live');assert.equal(s.audio.enabled,true);assert.equal(s.previews[0],s.screen);assert.equal(await s.share.finish(),true);assert.equal(s.sender.track,s.camera);assert.equal(s.share.active,false);assert.equal(s.restored(),1);assert.equal(s.screen.readyState,'ended')}finally{s.end()}
});
test('cancelled display permission leaves microphone, sender and prior camera unchanged',async()=>{
 const s=setup();try{const start=s.share.start();s.deny();await assert.rejects(start,{name:'NotAllowedError'});assert.equal(s.sender.track,s.camera);assert.equal(s.share.active,false);assert.equal(s.calls.length,0);assert.equal(s.camera.readyState,'live');assert.equal(s.audio.enabled,true)}finally{s.end()}
});
test('late display grant after signout releases all acquired tracks without replacing sender',async()=>{
 const s=setup();const start=s.share.start();s.end();s.resolve();assert.equal(await start,false);assert.equal(s.screen.readyState,'ended');assert.equal(s.systemAudio.readyState,'ended');assert.equal(s.sender.track,s.camera);assert.equal(s.previews.length,0);
});
test('ending the call during a pending sender swap cannot revive capture or previews',async()=>{
 const s=setup(),wait=gate();s.replaceWait(wait.promise);const start=s.share.start();s.resolve();await tick();s.end();wait.resolve();assert.equal(await start,false);assert.equal(s.screen.readyState,'ended');assert.equal(s.previews.length,0);
});
test('OS Stop Sharing automatically restores the exact camera track',async()=>{
 const s=setup();try{const start=s.share.start();s.resolve();await start;s.screen.end();await tick();assert.equal(s.sender.track,s.camera);assert.equal(s.restored(),1);assert.equal(s.share.active,false)}finally{s.end()}
});
test('OS Stop Sharing racing sender replacement still restores the camera',async()=>{
 const s=setup(),wait=gate();try{s.replaceWait(wait.promise);const start=s.share.start();s.resolve();await tick();s.screen.end();wait.resolve();await start;assert.equal(s.sender.track,s.camera);assert.equal(s.restored(),1);assert.equal(s.share.active,false)}finally{s.end()}
});
test('rejected screen replacement releases capture and leaves camera selected',async()=>{
 const s=setup();try{s.rejectReplacement();const start=s.share.start();s.resolve();await assert.rejects(start,/cannot replace/);assert.equal(s.screen.readyState,'ended');assert.equal(s.sender.track,s.camera);assert.equal(s.share.active,false)}finally{s.end()}
});
test('camera restoration failure immediately stops capture, never falls back to raw, and allows retry',async()=>{
 const s=setup();try{const start=s.share.start();s.resolve();await start;s.rejectReplacement();assert.equal(await s.share.finish(),false);assert.equal(s.screen.readyState,'ended');assert.equal(s.sender.track,s.screen);assert.equal(s.share.failed,true);assert.equal(s.failures.length,1);assert.equal(await s.share.finish(),true);assert.equal(s.sender.track,s.camera);assert.equal(s.share.failed,false)}finally{s.end()}
});
test('hold or camera-off disables actual screen output; overlapping starts/stops are serialized',async()=>{
 const s=setup();try{s.share.setEnabled(false);const start=s.share.start();assert.equal(await s.share.start(),false);assert.equal(await s.share.finish(),false);s.resolve();await start;assert.equal(s.screen.enabled,false);s.share.setEnabled(true);assert.equal(s.screen.enabled,true);assert.equal(s.audio.enabled,true);assert.equal(s.share.busy,false)}finally{s.end()}
});
test('restoration pending after call end cannot update the next session',async()=>{
 const s=setup(),wait=gate();const start=s.share.start();s.resolve();await start;s.replaceWait(wait.promise);const end=s.share.finish();s.end();wait.resolve();assert.equal(await end,false);assert.equal(s.restored(),0);assert.equal(s.screen.readyState,'ended');
});

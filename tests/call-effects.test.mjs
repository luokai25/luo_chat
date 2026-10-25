import test from 'node:test';
import assert from 'node:assert/strict';
import {CALL_EFFECTS,createCallEffects} from '../src/call-effects.js';
import {createCallRecovery} from '../src/call-recovery.js';

function setup(){
 let current=true,nextId=0,playGate=null,replaceGate=null,failReplace=false,failDraw=false,preview=null;
 const stopped=[],draws=[],timers=new Map(),videos=[];
 const track=id=>({id,kind:'video',enabled:true,getSettings:()=>({width:1920,height:1080}),stop(){stopped.push(id)}});
 const raw=track('raw'),audio={id:'audio',kind:'audio',enabled:true};
 class Stream{constructor(tracks){this.tracks=tracks}getTracks(){return this.tracks}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}}
 const stream=new Stream([raw,audio]),sender={track:raw,async replaceTrack(t){if(replaceGate)await replaceGate;if(failReplace)throw Error('replace rejected');this.track=t}};
 const win={MediaStream:Stream,setTimeout,clearTimeout,setInterval(fn){timers.set(++nextId,fn);return nextId},clearInterval(id){timers.delete(id)},document:{createElement(kind){
  if(kind==='video'){const v={muted:false,readyState:2,videoWidth:1920,videoHeight:1080,srcObject:null,pause(){},async play(){if(playGate)await playGate}};videos.push(v);return v}
  const context={filter:'none',fillRect(){},drawImage(){if(failDraw)throw Error('renderer failed');draws.push(this.filter)}};
  return{width:0,height:0,getContext:()=>context,captureStream:()=>new Stream([track('canvas-'+nextId)])};
 }}};
 const failures=[],engine=createCallEffects({win,peer:{getSenders:()=>[sender]},getStream:()=>stream,isCurrent:()=>current,onPreview:s=>preview=s,onFailure:s=>failures.push(s)});
 return{engine,raw,audio,sender,stopped,draws,timers,videos,failures,preview:()=>preview,signOut(){current=false;engine.stop()},playWait(p){playGate=p},replaceWait(p){replaceGate=p},rejectReplace(){failReplace=true},breakDraw(){failDraw=true}};
}
test('live effects replace the transmitted track, preserve audio identity, and restore raw explicitly',async()=>{
 const s=setup();try{assert.equal(await s.engine.select('mono'),true);assert.notEqual(s.sender.track,s.raw);assert.equal(s.preview().getVideoTracks()[0],s.sender.track);assert.equal(s.preview().getAudioTracks()[0],s.audio);assert.ok(s.draws.includes('grayscale(1)'));const output=s.sender.track;await s.engine.select('original');assert.equal(s.sender.track,s.raw);assert.ok(s.stopped.includes(output.id));assert.equal(s.raw.enabled,true);assert.equal(s.audio.enabled,true)}finally{s.engine.stop()}
});
test('effects never request permissions, fetch assets, or accept arbitrary CSS strings',async()=>{
 const s=setup();try{assert.equal(CALL_EFFECTS.length,7);await assert.rejects(s.engine.select('url(https://example.test)'),/Unknown/);assert.equal(s.sender.track,s.raw)}finally{s.engine.stop()}
});
test('camera switching retains the processed sender and camera-off disables its track',async()=>{
 const s=setup();try{await s.engine.select('golden');const processed=s.sender.track;const newRaw={id:'rear',kind:'video'};await s.engine.replaceCamera(newRaw);assert.equal(s.sender.track,processed);assert.equal(s.videos[0].srcObject.getVideoTracks()[0],newRaw);s.engine.setEnabled(false);assert.equal(processed.enabled,false);s.engine.setEnabled(true);assert.equal(processed.enabled,true)}finally{s.engine.stop()}
});
test('renderer failure pauses output, never silently replacing it with the unfiltered camera',async()=>{
 const s=setup();try{await s.engine.select('mono');const output=s.sender.track;s.breakDraw();for(const fn of s.timers.values())fn();assert.equal(s.sender.track,output);assert.equal(output.enabled,false);assert.equal(s.failures.length,1)}finally{s.engine.stop()}
});
test('rejected sender replacement keeps the previous effect and releases failed output',async()=>{
 const s=setup();try{await s.engine.select('golden');const previous=s.sender.track;s.rejectReplace();await assert.rejects(s.engine.select('mono'),/replace rejected/);assert.equal(s.engine.effect,'golden');assert.equal(s.sender.track,previous);assert.equal(s.timers.size,1);assert.equal(s.videos[1].srcObject,null)}finally{s.engine.stop()}
});
test('signout while effect playback is pending cannot publish frames into a new session',async()=>{
 const s=setup();let release;const wait=new Promise(r=>release=r);s.playWait(wait);const pending=s.engine.select('mono');s.signOut();release();await assert.rejects(pending,/Call ended/);assert.equal(s.sender.track,s.raw);assert.equal(s.timers.size,0);assert.equal(s.videos[0].srcObject,null);
});
test('closing while replaceTrack is pending stops processed tracks after it resolves',async()=>{
 const s=setup();let release;const wait=new Promise(r=>release=r);s.replaceWait(wait);const pending=s.engine.select('mono');await new Promise(r=>setTimeout(r,0));s.signOut();release();assert.equal(await pending,false);assert.ok(s.stopped.includes(s.sender.track.id));assert.equal(s.preview(),null);assert.equal(s.timers.size,0);
});
test('a second effect change cannot race an in-flight selection',async()=>{
 const s=setup();let release;const wait=new Promise(r=>release=r);s.playWait(wait);try{const pending=s.engine.select('mono');assert.equal(await s.engine.select('warm'),false);release();await pending;assert.equal(s.engine.effect,'mono')}finally{release();s.engine.stop()}
});
test('short network interruption preserves the call; recovery cancels expiry; stop cancels callbacks',()=>{
 let state='disconnected',expired=0,current=true;const messages=[],timers=new Map();let id=0;
 const win={setTimeout(fn){const handle=++id;timers.set(handle,()=>{timers.delete(handle);fn()});return handle},clearTimeout(id){timers.delete(id)}};
 const recovery=createCallRecovery({win,isCurrent:()=>current,getState:()=>state,onStatus:s=>messages.push(s),onExpired:()=>expired++});
 recovery.update();recovery.update();assert.equal(timers.size,1);assert.match(messages[0],/Reconnecting/);state='connected';recovery.update();assert.equal(timers.size,0);assert.equal(messages.at(-1),'Connected');state='failed';recovery.update();for(const fn of [...timers.values()])fn();assert.equal(expired,1);current=false;recovery.stop();assert.equal(timers.size,0);
});

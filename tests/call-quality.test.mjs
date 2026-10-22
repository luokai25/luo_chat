import test from 'node:test';import assert from 'node:assert/strict';
import {callMediaConstraints,configureCallSender,installCallQuality,VIDEO_PROFILES} from '../src/call-quality.js';
test('HD capture remains negotiable on smaller cameras and applies equally after a camera switch',()=>{
 const a=callMediaConstraints('video'),b=callMediaConstraints('video','environment',false);
 assert.equal(a.video.width.ideal,1920);assert.equal(a.video.height.ideal,1080);assert.equal(a.video.width.min,undefined);
 assert.equal(a.video.frameRate.max,30);assert.equal(b.video.width.ideal,a.video.width.ideal);assert.equal(b.audio,false);
 assert.equal(callMediaConstraints('audio').video,false);assert.equal(a.audio.sampleRate.ideal,48000);
});
test('sender tuning preserves negotiated encoding identifiers and reserves audio priority',async()=>{
 for(const kind of ['audio','video']){let applied;const sender={track:{kind},getParameters:()=>({transactionId:'t',encodings:[{rid:'original',active:true,ssrc:42}]}),setParameters:async p=>{applied=p}};
  assert.equal(await configureCallSender(sender),true);assert.equal(applied.encodings[0].rid,'original');assert.equal(applied.encodings[0].ssrc,42);
  assert.equal(applied.encodings[0].maxBitrate,kind==='audio'?96000:4500000);assert.equal(applied.encodings[0].priority,kind==='audio'?'high':'medium');
 }
});
test('unsupported optional sender fields fall back without aborting a call',async()=>{
 const updates=[];const sender={track:{kind:'video'},getParameters:()=>({encodings:[{}]}),setParameters:async p=>{updates.push(p);if(p.encodings[0].priority)throw Error('unsupported')}};
 assert.equal(await configureCallSender(sender),true);assert.equal(updates.length,2);assert.equal(updates[1].encodings[0].maxBitrate,4500000);
 let called=false;assert.equal(await configureCallSender({track:{kind:'video'},getParameters:()=>({encodings:[]}),setParameters:()=>{called=true}}),false);assert.equal(called,false);
});
test('sustained congestion reduces video and four healthy samples recover detail without oscillation',async()=>{
 let loss=.12,rtt=.7,capacity=500000;const updates=[];
 const sender={track:{kind:'video'},getParameters:()=>({encodings:[{}]}),setParameters:async p=>updates.push(p)};
 const quality=installCallQuality({win:{setInterval:()=>1,clearInterval(){}},peer:{connectionState:'connected',getSenders:()=>[sender],getStats:async()=>new Map([['p',{type:'candidate-pair',state:'succeeded',nominated:true,currentRoundTripTime:rtt,availableOutgoingBitrate:capacity}],['r',{type:'remote-inbound-rtp',kind:'video',fractionLost:loss}]])}});
 await quality.start();await quality.sample();assert.equal(quality.level,0);await quality.sample();assert.equal(quality.level,1);
 assert.equal(updates.at(-1).encodings[0].scaleResolutionDownBy,1.5);
 loss=0;rtt=.05;capacity=8000000;for(let i=0;i<3;i++)await quality.sample();assert.equal(quality.level,1);await quality.sample();assert.equal(quality.level,0);quality.stop();
});
test('stopping during an in-flight stats read prevents stale tuning and releases the timer',async()=>{
 let resolve,cleared=false,updates=0;const wait=new Promise(r=>resolve=r);const q=installCallQuality({win:{setInterval:()=>7,clearInterval:id=>{cleared=id===7}},peer:{connectionState:'connected',getSenders:()=>[{track:{kind:'video'},getParameters:()=>({encodings:[{}]}),setParameters:async()=>{updates++}}],getStats:()=>wait}});
 await q.start();const pending=q.sample();q.stop();resolve(new Map());await pending;assert.equal(cleared,true);await q.refresh();assert.equal(updates,1);
});

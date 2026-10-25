// Dedicated worker integration test, not a frontend-build dependency. Only
// generated known fixtures use the unsandboxed host test executor below.
import test from 'node:test';import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {inspectClipBytes} from '../../src/server/media-inspection.js';
const exec=promisify(execFile);
async function trustedFixtureExecutor(binary,args,input){return new Promise((resolve,reject)=>{const child=execFile('/usr/bin/'+binary,args,{encoding:'utf8',timeout:10000,maxBuffer:65536},(err,out)=>err?reject(err):resolve(out));child.stdin.on('error',()=>{});child.stdin.end(input)})}
test('real generated MP4 and WebM are probed and completely decoded without network/file input protocols',async()=>{
 for(const [type,codec,extra]of [['mp4','libx264',['-movflags','frag_keyframe+empty_moov']],['webm','libvpx',[]]]){
  const generated=(await exec('/usr/bin/ffmpeg',['-v','error','-f','lavfi','-i','color=c=gold:s=64x96:r=10','-t','0.4','-an','-threads','1','-c:v',codec,...extra,'-f',type,'pipe:1'],{encoding:'buffer',timeout:10000,maxBuffer:1048576})).stdout;
  const commands=[];const result=await inspectClipBytes(generated,{execute:async(b,a,i,o)=>{commands.push(a);return trustedFixtureExecutor(b,a,i,o)}});
  assert.equal(result.mimeType,'video/'+type);assert.ok(result.duration>0&&result.duration<1);assert.equal(result.width,64);assert.ok(commands.every(a=>a[a.indexOf('-protocol_whitelist')+1]==='pipe'));assert.ok(commands.every(a=>a.includes('pipe:0')));
 }
});

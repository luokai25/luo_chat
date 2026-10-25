import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

export const INSPECTION_POLICY='luo-reel-v1';
const MAX_BYTES=50*1024*1024;
export class InspectionError extends Error{constructor(message='Media inspection failed'){super(message);this.name='InspectionError'}}

// A mandatory OS sandbox, not a shell or a user-selected executable. Never
// silently run an untrusted native decoder on the host if namespaces fail.
export function sandboxedMediaCommand(binary,args,input,{timeoutMs=45000,signal}={}){
 if(!['ffprobe','ffmpeg'].includes(binary))return Promise.reject(new InspectionError());
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new InspectionError('Media inspection cancelled'));
  const argv=['--unshare-all','--new-session','--die-with-parent','--clearenv','--setenv','PATH','/usr/bin','--ro-bind','/usr','/usr','--ro-bind','/lib','/lib','--ro-bind','/lib64','/lib64','--proc','/proc','--dev','/dev','--tmpfs','/tmp','--chdir','/tmp','--','/usr/bin/prlimit','--as=1073741824','--cpu=40','--nofile=32','--nproc=64','--','/usr/bin/'+binary,...args];
  const child=spawn('/usr/bin/bwrap',argv,{stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin'}});
  let stdout=[],size=0,errorSize=0,failed=false;
  const stop=()=>{failed=true;child.kill('SIGKILL')};
  const timer=setTimeout(stop,timeoutMs);const cancel=()=>stop();signal?.addEventListener('abort',cancel,{once:true});
  child.stdout.on('data',part=>{size+=part.length;if(size>65536)stop();else stdout.push(part)});
  child.stderr.on('data',part=>{errorSize+=part.length;if(errorSize>16384)stop()});
  child.stdin.on('error',()=>{});child.stdin.end(input);
  const finish=(code)=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(failed||code!==0)reject(new InspectionError('Sandboxed media inspection unavailable or rejected'));else resolve(Buffer.concat(stdout).toString('utf8'))};
  child.once('error',()=>finish(-1));child.once('close',finish);
 });
}

function container(bytes){
 if(bytes.length>=12&&bytes.subarray(4,8).toString()==='ftyp')return'video/mp4';
 if(bytes.length>=8&&bytes.readUInt32BE(0)===0x1a45dfa3)return'video/webm';
 throw new InspectionError('Only inspectable MP4 or WebM video is accepted');
}
const finite=value=>typeof value==='number'?Number.isFinite(value):typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value));
const rate=value=>{if(typeof value!=='string'||!/^\d+\/\d+$/.test(value))return NaN;const[n,d]=value.split('/').map(Number);return d>0?n/d:NaN};

// execute is an operator/test dependency, never populated from an HTTP body.
// The default always requires sandboxed, network-isolated native decoding.
export async function inspectClipBytes(bytes,{execute=sandboxedMediaCommand,signal}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>MAX_BYTES)throw new InspectionError('Clip must be between 1 byte and 50 MB');
 if(signal?.aborted)throw new InspectionError('Media inspection cancelled');
 const mime=container(bytes),demux=mime==='video/mp4'?'mov':'matroska,webm';
 const input=['-protocol_whitelist','pipe','-format_whitelist',demux,'-probesize','1048576','-analyzeduration','5000000','-i','pipe:0'];
 let info;try{info=JSON.parse(await execute('ffprobe',['-v','error','-max_alloc','67108864',...input,'-show_entries','format=format_name,duration:stream=codec_type,codec_name,width,height,avg_frame_rate,channels,sample_rate','-of','json'],bytes,{signal}))}catch{throw new InspectionError('Video headers could not be inspected')}
 if(signal?.aborted)throw new InspectionError('Media inspection cancelled');
 const streams=info?.streams;if(!Array.isArray(streams)||streams.length<1||streams.length>2)throw new InspectionError('Unsupported media streams');
 const video=streams.filter(s=>s.codec_type==='video'),audio=streams.filter(s=>s.codec_type==='audio');
 if(video.length!==1||audio.length>1||video.length+audio.length!==streams.length)throw new InspectionError('Unsupported media streams');
 const v=video[0];if(!['h264','vp8','vp9','av1'].includes(v.codec_name)||!Number.isInteger(v.width)||!Number.isInteger(v.height)||v.width<1||v.height<1||v.width>2160||v.height>2160||v.width*v.height>4147200)throw new InspectionError('Unsupported video codec or dimensions');
 const fps=rate(v.avg_frame_rate);if(!Number.isFinite(fps)||fps<=0||fps>60)throw new InspectionError('Unsupported video frame rate');
 if(audio.some(a=>!['aac','opus','vorbis'].includes(a.codec_name)||!Number.isInteger(a.channels)||a.channels<1||a.channels>2||!finite(a.sample_rate)||Number(a.sample_rate)>48000||Number(a.sample_rate)<=0))throw new InspectionError('Unsupported audio');
 const names=String(info?.format?.format_name||'').split(',');if(!(mime==='video/mp4'?names.includes('mp4')||names.includes('mov'):names.includes('webm')))throw new InspectionError('Media container mismatch');
 if(finite(info?.format?.duration)&&Number(info.format.duration)>90)throw new InspectionError('Clip exceeds 90 seconds');
 // Header duration is not authoritative. Decode the complete bounded input and
 // inspect actual decoded progress; -xerror rejects corrupt decoder input.
 let progress;try{progress=await execute('ffmpeg',['-v','error','-nostdin','-xerror','-max_alloc','67108864','-threads','1','-err_detect','explode',...input,'-map','0:v:0','-map','0:a:0?','-sn','-dn','-threads','1','-progress','pipe:1','-nostats','-f','null','pipe:1'],bytes,{signal})}catch{throw new InspectionError('Full video decode failed')}
 if(signal?.aborted)throw new InspectionError('Media inspection cancelled');
 if(!/progress=end(?:\r?\n|$)/.test(progress))throw new InspectionError('Video decode did not finish');
 const times=[...progress.matchAll(/^out_time_us=(\d+)\r?$/gm)].map(m=>Number(m[1])/1e6),duration=Math.max(0,...times);
 const frames=[...progress.matchAll(/^frame=(\d+)\r?$/gm)].map(m=>Number(m[1]));
 if(!Number.isFinite(duration)||duration<=0||duration>90||Math.max(0,...frames)<1)throw new InspectionError('Decoded clip duration must be greater than zero and at most 90 seconds');
 return{policy:INSPECTION_POLICY,sha256:createHash('sha256').update(bytes).digest('hex'),byteSize:bytes.length,mimeType:mime,duration,width:v.width,height:v.height,videoCodec:v.codec_name,audioCodec:audio[0]?.codec_name||null};
}

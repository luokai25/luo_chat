import {validateTimeline} from './clip-timeline.js';

// Local, real-time export of one owned source. No uploads, remote assets or microphone requests.
export async function renderClipTimeline({win,file,duration,segments,isCurrent=()=>true,signal,onProgress=()=>{}}){
 const plan=validateTimeline(duration,segments,{forExport:true});if(!file||!['video/webm','video/mp4'].includes(file.type)||file.size<1||file.size>50*1024*1024)throw Error('Choose a supported video up to 50 MB.');
 const video=win.document.createElement('video'),canvas=win.document.createElement('canvas');video.playsInline=true;video.muted=true;video.preload='auto';
 if(!video.captureStream||!canvas.captureStream||!win.MediaRecorder)throw Error('Timeline export is not supported in this browser. Keep the original video or use basic trimming.');
 const mime=['video/webm;codecs=vp8,opus','video/webm'].find(type=>win.MediaRecorder.isTypeSupported(type));if(!mime)throw Error('WebM export is unavailable in this browser.');
 let encoder=null,captured=null,canvasStream=null,frame=null,url=null,deadline=null,closed=false,fatal=null,bytes=0;
 const tasks=new Set();
 const active=()=>!closed&&isCurrent()&&!signal?.aborted;
 function check(){if(!active())throw Error('Timeline export cancelled.');if(fatal)throw fatal;}
 function cancel(){for(const task of [...tasks])task(Error('Timeline export cancelled.'));}
 function operation(promise,timeout=8000){return new Promise((resolve,reject)=>{let timer;const finish=(error,value)=>{win.clearTimeout(timer);tasks.delete(fail);error?reject(error):resolve(value)};const fail=error=>finish(fatal||error);tasks.add(fail);timer=win.setTimeout(()=>fail(Error('Video playback timed out.')),timeout);promise.then(value=>finish(null,value),fail)})}
 function event(target,type,timeout=10000){return new Promise((resolve,reject)=>{let timer;const finish=error=>{win.clearTimeout(timer);target.removeEventListener(type,ok);target.removeEventListener('error',bad);tasks.delete(finish);error?reject(error):resolve()};const ok=()=>finish(),bad=()=>finish(Error('Video could not be decoded.'));tasks.add(finish);target.addEventListener(type,ok,{once:true});target.addEventListener('error',bad,{once:true});timer=win.setTimeout(()=>finish(Error('Video operation timed out.')),timeout)})}
 async function seek(time){check();video.pause();if(Math.abs(video.currentTime-time)<.01)return;const ready=event(video,'seeked',5000);video.currentTime=time;await ready;check();}
 const context=canvas.getContext('2d');if(!context)throw Error('Video rendering is unavailable.');
 try{
  if(signal?.aborted)throw Error('Timeline export cancelled.');signal?.addEventListener('abort',cancel,{once:true});
  deadline=win.setTimeout(()=>{fatal=Error('Timeline export timed out.');cancel()},(plan.duration+15+segments.length*6)*1000);
  url=win.URL.createObjectURL(file);const metadata=event(video,'loadedmetadata');video.src=url;await metadata;check();
  const width=video.videoWidth,height=video.videoHeight;if(!width||!height)throw Error('Video dimensions are unavailable.');const scale=Math.min(1,1280/Math.max(width,height),Math.sqrt(921600/(width*height)));canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  await seek(plan.segments[0].start);video.playbackRate=plan.segments[0].speed;await operation(video.play());check();captured=video.captureStream();if(!captured.getVideoTracks().length)throw Error('Video capture is unavailable.');
  context.drawImage(video,0,0,canvas.width,canvas.height);canvasStream=canvas.captureStream(24);const output=new win.MediaStream([...canvasStream.getVideoTracks(),...captured.getAudioTracks()]);encoder=new win.MediaRecorder(output,{mimeType:mime,videoBitsPerSecond:3000000});
  const chunks=[];let rejectResult,failResult;const result=new Promise((resolve,reject)=>{rejectResult=reject;failResult=error=>reject(fatal||error);tasks.add(failResult);encoder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>50*1024*1024){fatal=Error('Timeline export exceeds 50 MB.');cancel();}}};encoder.onerror=()=>{fatal=Error('Timeline recording failed.');cancel();reject(fatal)};encoder.onstop=()=>{tasks.delete(failResult);fatal?reject(fatal):resolve(new win.File(chunks,'luo-timeline.webm',{type:'video/webm'}))}});result.catch(()=>{});
  encoder.start(200);let completed=0;
  for(const [index,segment]of plan.segments.entries()){
   check();if(index){encoder.pause();await seek(segment.start);video.playbackRate=segment.speed;await operation(video.play());check();encoder.resume()}
   await new Promise((resolve,reject)=>{let lastDraw=-Infinity;const fail=error=>{if(frame!==null)win.cancelAnimationFrame(frame);frame=null;tasks.delete(fail);reject(fatal||error)};tasks.add(fail);const draw=stamp=>{try{check();if(video.error)throw Error('Video playback failed during export.');if(video.ended&&video.currentTime<segment.end-.1)throw Error('Source video ended before the selected segment.');if(stamp-lastDraw>=1000/24){context.drawImage(video,0,0,canvas.width,canvas.height);lastDraw=stamp}onProgress({segment:index+1,count:plan.segments.length,seconds:Math.min(plan.duration,completed+Math.max(0,video.currentTime-segment.start)/segment.speed),total:plan.duration});if(video.currentTime>=segment.end||video.ended){frame=null;tasks.delete(fail);resolve();return}frame=win.requestAnimationFrame(draw)}catch(error){fail(error)}};frame=win.requestAnimationFrame(draw)});
   video.pause();completed+=(segment.end-segment.start)/segment.speed;
  }
  check();encoder.stop();const stopTimeout=win.setTimeout(()=>rejectResult(Error('Timeline finalization timed out.')),5000);let rendered;try{rendered=await result}finally{win.clearTimeout(stopTimeout)}check();if(!rendered.size)throw Error('No timeline video was produced.');return rendered;
 }finally{
  closed=true;signal?.removeEventListener('abort',cancel);win.clearTimeout(deadline);cancel();if(frame!==null)win.cancelAnimationFrame(frame);if(encoder){encoder.ondataavailable=encoder.onstop=encoder.onerror=null;if(encoder.state!=='inactive')try{encoder.stop()}catch{}}
  video.pause();for(const track of [...(captured?.getTracks()||[]),...(canvasStream?.getTracks()||[])])track.stop();video.removeAttribute('src');video.load();if(url)win.URL.revokeObjectURL(url);canvas.width=canvas.height=1;
 }
}

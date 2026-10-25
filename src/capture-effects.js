import {CALL_EFFECTS} from './call-effects.js';

// A stable canvas track is essential: MediaRecorder must not keep an old preset's track.
export async function createCaptureEffects({win,stream,isCurrent=()=>true,onFailure=()=>{},signal}){
 const source=win.document.createElement('video'),canvas=win.document.createElement('canvas');source.muted=true;source.playsInline=true;source.srcObject=new win.MediaStream(stream.getVideoTracks());
 const context=canvas.getContext('2d');let stopped=false,timer=null,timeout=null,track=null,effect='original',failed=false,rejectCancelled=null;
 function cancelled(){stop();rejectCancelled?.(Error('Camera closed.'))}
 function stop(){if(stopped)return;stopped=true;signal?.removeEventListener('abort',cancelled);win.clearInterval(timer);win.clearTimeout(timeout);source.pause();source.srcObject=null;track?.stop();canvas.width=canvas.height=1}
 if(!context||!canvas.captureStream||!('filter' in context)){stop();throw Error('Color-effect recording is unsupported in this browser.');}
 try{
  if(signal?.aborted)throw Error('Camera closed.');signal?.addEventListener('abort',cancelled,{once:true});
  await Promise.race([source.play(),new Promise((_,reject)=>{rejectCancelled=reject;timeout=win.setTimeout(()=>reject(Error('Camera renderer timed out.')),5000)})]);win.clearTimeout(timeout);
  if(stopped||!isCurrent())throw Error('Camera closed.');
  const settings=stream.getVideoTracks()[0]?.getSettings?.()||{},width=source.videoWidth||settings.width||640,height=source.videoHeight||settings.height||480;
  const scale=Math.min(1,1280/Math.max(width,height),Math.sqrt(921600/(width*height)));canvas.width=Math.max(2,Math.round(width*scale));canvas.height=Math.max(2,Math.round(height*scale));
  function frame(){
   if(stopped||failed||!isCurrent())return;
   try{context.filter='none';context.fillStyle='#000';context.fillRect(0,0,canvas.width,canvas.height);if(source.readyState>=2){context.filter=CALL_EFFECTS.find(value=>value.id===effect).filter;const w=source.videoWidth||width,h=source.videoHeight||height,k=Math.min(canvas.width/w,canvas.height/h);context.drawImage(source,(canvas.width-w*k)/2,(canvas.height-h*k)/2,w*k,h*k)}}
   catch{failed=true;if(track)track.enabled=false;win.clearInterval(timer);onFailure('Camera effects failed. Recording has been stopped; open the camera again.');}
  }
  frame();if(failed)throw Error('Camera effects could not start.');
  track=canvas.captureStream(24).getVideoTracks()[0];if(!track)throw Error('No processed camera output.');try{track.contentHint='motion'}catch{}
  const output=new win.MediaStream([...stream.getAudioTracks(),track]);timer=win.setInterval(frame,1000/24);
  return{stream:output,get effect(){return effect},select(id){if(stopped||failed||!isCurrent())throw Error('Camera effects are not available.');if(!CALL_EFFECTS.some(value=>value.id===id))throw Error('Unknown effect.');effect=id;frame();if(failed)throw Error('Camera effects failed.');return true},stop};
 }catch(error){stop();throw error}
}

export function supportedCameraControls(track){
 let caps={};try{caps=track?.getCapabilities?.()||{}}catch{}
 const zoom=caps.zoom;
 return{torch:caps.torch===true&&typeof track?.applyConstraints==='function',zoom:typeof track?.applyConstraints==='function'&&zoom&&[zoom.min,zoom.max].every(Number.isFinite)&&zoom.min>0&&zoom.max>zoom.min?{min:zoom.min,max:zoom.max,step:Number.isFinite(zoom.step)&&zoom.step>0?zoom.step:.1}:null};
}

export function createCameraHardware({track,isCurrent=()=>true}){
 const capabilities=supportedCameraControls(track);let stopped=false,busy=false,torch=false;
 return{capabilities,get busy(){return busy},get torch(){return torch},
  async apply({zoom,light}={}){
   if(stopped||!isCurrent()||busy)throw Error('Wait for the current camera adjustment.');
   const constraints={};if(zoom!==undefined){if(!capabilities.zoom||!Number.isFinite(zoom))throw Error('Zoom is unsupported.');constraints.zoom=Math.max(capabilities.zoom.min,Math.min(capabilities.zoom.max,zoom));}
   if(light!==undefined){if(!capabilities.torch||typeof light!=='boolean')throw Error('Torch is unsupported.');constraints.torch=light;}
   if(!Object.keys(constraints).length)return false;
   busy=true;try{await track.applyConstraints({advanced:[constraints]});if(stopped||!isCurrent())return false;if(light!==undefined)torch=light;return true}finally{busy=false}
  },stop(){stopped=true}
 };
}

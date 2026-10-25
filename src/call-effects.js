import {CALL_AR_EFFECTS,drawFaceOverlay} from './call-ar-effects.js';
import {createFaceTracker} from './call-face-tracker.js';
// Local processing only. The canvas track is the actual WebRTC sender, not a CSS preview.
export const CALL_EFFECTS=Object.freeze([
 {id:'original',label:'Original',filter:'none'},
 {id:'golden',label:'Luo Gold',filter:'sepia(.38) saturate(1.3) contrast(1.08)'},
 {id:'warm',label:'Warm',filter:'sepia(.23) saturate(1.2)'},
 {id:'vintage',label:'Vintage',filter:'sepia(.65) contrast(.9) saturate(.8)'},
 {id:'film',label:'Film',filter:'contrast(1.18) saturate(.75)'},
 {id:'mono',label:'Monochrome',filter:'grayscale(1)'},
 {id:'dreamy',label:'Dreamy',filter:'contrast(.88) saturate(1.18) brightness(1.08)'}
]);

export function createCallEffects({win,peer,getStream,isCurrent=()=>true,onPreview=()=>{},onFailure=()=>{},faceTrackerFactory=createFaceTracker}){
 let stopped=false,busy=false,pipeline=null,effect='original',enabled=true;
 const allocated=new Set();
 const alive=()=>!stopped&&isCurrent();
 const sender=()=>peer.getSenders().find(s=>s.track?.kind==='video');
 function dispose(p){if(!p||p.disposed)return;p.disposed=true;allocated.delete(p);win.clearInterval(p.timer);p.tracker?.close();p.video.pause();p.video.srcObject=null;p.track?.stop();p.canvas.width=p.canvas.height=1;}
 function preview(track){onPreview(new win.MediaStream([...getStream().getAudioTracks(),track]));}
 async function build(id){
  const video=win.document.createElement('video'),canvas=win.document.createElement('canvas');
  video.muted=true;video.playsInline=true;video.srcObject=new win.MediaStream(getStream().getVideoTracks());
  const context=canvas.getContext('2d');
  if(!context||!canvas.captureStream||!('filter' in context)){video.srcObject=null;throw Error('Live color effects are unavailable in this browser.');}
  const preset=CALL_AR_EFFECTS.find(e=>e.id===id)||CALL_EFFECTS.find(e=>e.id===id);
  const p={video,canvas,context,track:null,timer:null,tracker:null,failed:false};allocated.add(p);
  // Keep the previous sender/effect producing frames while the new tracker loads.
  // The allocated set also lets stop() cancel this candidate during a pending import.
  let timeout;
  try{
   if(preset.kind==='ar'){
    const pending=Promise.resolve().then(()=>faceTrackerFactory({win}));
    // If import/model initialization eventually resolves after stop or timeout,
    // dispose the late tracker rather than leaking a CPU/video processor.
    pending.then(tracker=>{if(p.disposed)tracker?.close?.()}).catch(()=>{});
    let watchdog;
    try{
     const tracker=await Promise.race([pending,new Promise((_,reject)=>{
      watchdog=win.setTimeout(()=>reject(Error('Face tracking setup timed out.')),15000);
     })]);
     if(p.disposed)throw Error('Call ended.');
     if(!alive()){tracker?.close?.();throw Error('Call ended.')}
     p.tracker=tracker;
    }finally{win.clearTimeout(watchdog)}
   }
   await Promise.race([video.play(),new Promise((_,reject)=>{timeout=win.setTimeout(()=>reject(Error('Camera preview timed out.')),5000)})]);
   if(!alive()||p.disposed)throw Error('Call ended.');
   const settings=getStream().getVideoTracks()[0]?.getSettings?.()||{};
   const width=video.videoWidth||settings.width||640,height=video.videoHeight||settings.height||480;
   const scale=Math.min(1,1280/width,720/height);canvas.width=Math.max(2,Math.round(width*scale));canvas.height=Math.max(2,Math.round(height*scale));
   function frame(){
    if(!alive()||p.disposed||p.failed)return;
    try{
     context.filter='none';context.fillStyle='#000';context.fillRect(0,0,canvas.width,canvas.height);
     if(enabled&&video.readyState>=2){context.filter=preset.filter;context.drawImage(video,0,0,canvas.width,canvas.height);context.filter='none';if(p.tracker){const face=p.tracker.detect(video);if(face)drawFaceOverlay(context,face,canvas.width,canvas.height,preset,win.performance.now())}}
    }catch{
     p.failed=true;p.track&&(p.track.enabled=false);win.clearInterval(p.timer);
     if(p.track&&sender()?.track===p.track)onFailure('Video effect stopped. Video is paused; choose Original to restore the camera.');
    }
   }
   frame();if(p.failed)throw Error('Video effects could not start.');
   const captured=canvas.captureStream(24);p.track=captured.getVideoTracks()[0];
   if(!p.track)throw Error('Video effects could not start.');
   p.track.enabled=enabled;p.track.contentHint='motion';p.timer=win.setInterval(frame,1000/24);
   return p;
  }catch(error){dispose(p);throw error}finally{win.clearTimeout(timeout)}
 }
 return{
  get effect(){return effect},get busy(){return busy},
  async select(id){
   if(busy||!alive())return false;
   if(!CALL_EFFECTS.some(e=>e.id===id)&&!CALL_AR_EFFECTS.some(e=>e.id===id))throw Error('Unknown effect.');
   if(id===effect)return true;
   const s=sender(),raw=getStream()?.getVideoTracks()[0];if(!s||!raw)throw Error('Start a video call first.');
   busy=true;const previous=pipeline;let next=null;
   try{
    if(id!=='original')next=await build(id);
    if(!alive())return false;
    await s.replaceTrack(next?.track||raw);
    if(!alive())return false;
    pipeline=next;effect=id;preview(next?.track||raw);dispose(previous);return true;
   }catch(error){pipeline=previous;dispose(next);throw error}
   finally{if(!alive()){dispose(next);dispose(previous)}busy=false}
  },
  async replaceCamera(track){
   if(busy||!alive())throw Error('Wait for the current video change.');
   busy=true;
   try{
    if(pipeline){const p=pipeline,previous=p.video.srcObject;p.video.srcObject=new win.MediaStream([track]);try{await p.video.play()}catch(error){if(alive()&&pipeline===p)p.video.srcObject=previous;throw error}if(!alive())return;}
    else await sender().replaceTrack(track);
   }finally{busy=false}
  },
  refreshPreview(){if(alive())preview(pipeline?.track||getStream().getVideoTracks()[0]);},
  setEnabled(value){enabled=value;if(pipeline?.track)pipeline.track.enabled=value&&!pipeline.failed;},
  stop(){stopped=true;for(const p of [...allocated])dispose(p);pipeline=null;}
 };
}

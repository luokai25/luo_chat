// Optional, on-device Face Landmarker. Loaded only after the user selects an AR lens.
// The browser downloads model/runtime assets. Camera frames are never POSTed to a service.
// Pin exact package version; do not accept caller-controlled URLs or script locations.
export const VISION_VERSION='0.10.22-rc.20250304';
export const VISION_ROOT='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+VISION_VERSION;
export const VISION_MODEL='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MODULE=VISION_ROOT+'/vision_bundle.mjs';
export async function createFaceTracker({win,loadModule=()=>import(/* @vite-ignore */ MODULE)}={}){
 if(!win?.document||typeof win?.performance?.now!=='function')throw Error('Face tracking requires a supported browser.');
 let tracker=null,closed=false,last=0,landmarks=null;
 try{
  const vision=await loadModule();
  if(closed||!vision?.FilesetResolver||!vision?.FaceLandmarker)throw Error('Face tracking runtime unavailable.');
  const wasm=await vision.FilesetResolver.forVisionTasks(VISION_ROOT+'/wasm');
  if(closed)throw Error('Face tracking was cancelled.');
  // Software delegate is more portable. GPU acceleration can be added after
  // testing its reliability on Android across browsers.
  tracker=await vision.FaceLandmarker.createFromOptions(wasm,{
   baseOptions:{modelAssetPath:VISION_MODEL,delegate:'CPU'},
   runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false,
   minFaceDetectionConfidence:.55,minFacePresenceConfidence:.5,minTrackingConfidence:.5
  });
  if(closed)throw Error('Face tracking was cancelled.');
  return{
   get active(){return !closed},
   detect(video){
    if(closed||!tracker||video?.readyState<2)return null;
    const now=win.performance.now();
    if(now-last<110)return landmarks;
    last=now;
    try{const result=tracker.detectForVideo(video,now);
     landmarks=Array.isArray(result.faceLandmarks)&&result.faceLandmarks.length?result.faceLandmarks[0]:null;
    }catch{landmarks=null}
    return landmarks;
   },
   close(){if(closed)return;closed=true;landmarks=null;try{tracker?.close()}catch{}tracker=null}
  };
 }catch(error){try{tracker?.close()}catch{}throw Error('Face tracking unavailable. Check your connection and device compatibility.')}
}

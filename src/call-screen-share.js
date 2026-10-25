// Replace only the existing video sender. Never request microphone/system audio.
export function createCallScreenShare({win,peer,isCurrent=()=>true,onState=()=>{},onPreview=()=>{},onRestore=()=>{},onFailure=()=>{}}){
 let stopped=false,busy=false,display=null,restore=null,enabled=true,failed=false;
 const alive=()=>!stopped&&isCurrent();
 const videoSender=()=>peer.getSenders().find(sender=>sender.track?.kind==='video');
 const release=stream=>stream?.getTracks().forEach(track=>{track.onended=null;track.stop()});
 const notify=()=>{if(alive())onState({active:!!display,busy,failed})};
 async function finish(){
  if(busy||!display||!alive())return false;
  busy=true;const previous=display,camera=restore;
  // Stop capture immediately, even if sender restoration is slow or fails.
  release(previous);notify();
  try{
   if(!camera||camera.readyState==='ended')throw Error('Camera source is no longer available.');
   await videoSender().replaceTrack(camera);
   if(!alive())return false;
   display=null;restore=null;failed=false;onRestore();return true;
  }catch{
   failed=true;if(alive())onFailure('Screen sharing stopped, but the camera could not be restored. Retry camera, or end this call and call again.');
   // Keep the ended screen sender. Never silently fall back to an unfiltered camera.
   return false;
  }finally{busy=false;notify()}
 }
 return{
  get active(){return !!display},get busy(){return busy},get failed(){return failed},
  async start(){
   if(busy||display||!alive())return false;
   const sender=videoSender();if(!sender)throw Error('Screen sharing requires an active video call.');
   if(!win.navigator.mediaDevices?.getDisplayMedia)throw Error('Screen sharing is not supported by this browser.');
   busy=true;notify();let obtained=null,attached=false;
   try{
    obtained=await win.navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:15,max:30},width:{ideal:1920},height:{ideal:1080}},audio:false});
    if(!alive()){release(obtained);return false}
    const track=obtained.getVideoTracks()[0];
    if(!track||track.readyState==='ended')throw Error('Screen selection ended before sharing started.');
    // Defense in depth if an implementation nevertheless returns audio tracks.
    obtained.getAudioTracks().forEach(audio=>{audio.stop();obtained.removeTrack?.(audio)});
    track.enabled=enabled;try{track.contentHint='detail'}catch{}
    restore=sender.track;display=obtained;
    track.onended=()=>{if(alive()&&!busy)void finish()};
    await sender.replaceTrack(track);attached=true;
    if(!alive()){release(obtained);return false}
    if(track.readyState==='ended'){
     // An OS stop can race replaceTrack's completion. Run the same restoration path.
     busy=false;return await finish();
    }
    onPreview(track);return true;
   }catch(error){
    release(obtained);
    if(!attached){display=null;restore=null;}
    if(alive())throw error;return false;
   }finally{busy=false;notify()}
  },
  finish,
  setEnabled(value){enabled=value;display?.getVideoTracks().forEach(track=>track.enabled=value)},
  stop(){stopped=true;release(display);display=null;restore=null;}
 };
}

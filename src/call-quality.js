// Browser-native encoding and congestion control; no SDP rewriting or fixed minimum bitrate.
export const VIDEO_PROFILES=Object.freeze([
 {label:'HD',bitrate:4_500_000,fps:30,scale:1},
 {label:'Balanced',bitrate:2_400_000,fps:30,scale:1.5},
 {label:'Low bandwidth',bitrate:1_200_000,fps:24,scale:2},
 {label:'Audio priority',bitrate:450_000,fps:20,scale:3}
]);
export function callMediaConstraints(kind,facing='user',audio=true){return{
 audio:audio?{echoCancellation:{ideal:true},noiseSuppression:{ideal:true},autoGainControl:{ideal:true},sampleRate:{ideal:48000},channelCount:{ideal:1}}:false,
 video:kind==='video'?{facingMode:{ideal:facing},width:{ideal:1920,max:1920},height:{ideal:1080,max:1080},frameRate:{ideal:30,max:30}}:false
};}
export async function configureCallSender(sender,profile=VIDEO_PROFILES[0]){
 if(!sender?.track||!sender.getParameters||!sender.setParameters)return false;
 const apply=async optional=>{
  const parameters=sender.getParameters();
  // Adding an encoding after negotiation is invalid. Leave unsupported senders alone.
  if(!parameters.encodings?.length)return false;
  const video=sender.track.kind==='video';
  for(const encoding of parameters.encodings){
   encoding.maxBitrate=video?profile.bitrate:96_000;
   if(video){encoding.maxFramerate=profile.fps;encoding.scaleResolutionDownBy=profile.scale;}
   if(optional){encoding.priority=video?'medium':'high';encoding.networkPriority=video?'medium':'high';}
  }
  if(video&&optional)parameters.degradationPreference='balanced';
  await sender.setParameters(parameters);return true;
 };
 try{return await apply(true)}catch{try{return await apply(false)}catch{return false}}
}
export function installCallQuality({win,peer,isCurrent=()=>true}){
 let stopped=false,timer=null,busy=false,level=0,bad=0,good=0;
 const alive=()=>!stopped&&isCurrent();
 async function refresh(){if(!alive())return;for(const sender of peer.getSenders?.()||[]){if(!alive())return;await configureCallSender(sender,VIDEO_PROFILES[level]);}}
 async function sample(){
  if(busy||!alive()||peer.connectionState!=='connected'||!peer.getStats)return;
  busy=true;
  try{
   const reports=await peer.getStats();if(!alive())return;
   let loss=0,rtt=0,capacity=null,cpu=false;
   for(const report of reports.values()){
    if(report.type==='candidate-pair'&&report.state==='succeeded'&&(report.nominated||report.selected)){
     if(Number.isFinite(report.currentRoundTripTime))rtt=Math.max(rtt,report.currentRoundTripTime);
     if(report.availableOutgoingBitrate>0)capacity=report.availableOutgoingBitrate;
    }
    if(report.type==='remote-inbound-rtp'&&(report.kind==='video'||report.mediaType==='video')){
     if(Number.isFinite(report.fractionLost))loss=Math.max(loss,report.fractionLost);
     if(Number.isFinite(report.roundTripTime))rtt=Math.max(rtt,report.roundTripTime);
    }
    if(report.type==='outbound-rtp'&&(report.kind==='video'||report.mediaType==='video'))cpu||=report.qualityLimitationReason==='cpu';
   }
   const congested=cpu||loss>.08||rtt>.55||(capacity!==null&&capacity<VIDEO_PROFILES[level].bitrate*.45);
   const healthy=!cpu&&loss<.025&&rtt<.25&&(capacity===null||capacity>VIDEO_PROFILES[Math.max(0,level-1)].bitrate*1.2);
   bad=congested?bad+1:0;good=healthy?good+1:0;
   // Two bad observations lower the load; four healthy ones restore detail gradually.
   const next=bad>=2?Math.min(VIDEO_PROFILES.length-1,level+1):good>=4?Math.max(0,level-1):level;
   if(next!==level){level=next;bad=good=0;await refresh();}
  }catch{/* Browser congestion control continues if stats are unavailable. */}
  finally{busy=false;}
 }
 return{async start(){await refresh();if(alive()&&!timer)timer=win.setInterval(sample,2500)},refresh,sample,
  stop(){stopped=true;if(timer!==null)win.clearInterval(timer);timer=null},get level(){return level}};
}

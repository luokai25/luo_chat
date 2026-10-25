// Preserve an existing session through short disruptions; no unsupported signaling restart.
export function createCallRecovery({win,isCurrent,getState,onStatus,onExpired,graceMs=30000}){
 let timer=null,stopped=false;
 const clear=()=>{if(timer!==null)win.clearTimeout(timer);timer=null};
 return{
  update(){if(stopped||!isCurrent())return;const state=getState();
   if(state==='connected'){clear();onStatus('Connected');return}
   if(state==='disconnected'||state==='failed'){
    onStatus('Reconnecting… Keeping audio and video session open for up to 30 seconds.');
    if(timer===null)timer=win.setTimeout(()=>{timer=null;if(!stopped&&isCurrent()&&['disconnected','failed'].includes(getState()))onExpired()},graceMs);
   }else if(state==='closed'){clear()}else onStatus('Connecting…');
  },
  stop(){stopped=true;clear()}
 };
}

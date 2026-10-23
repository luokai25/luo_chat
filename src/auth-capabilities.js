/**
 * Live feature negotiation prevents an APK from displaying account workflows
 * the currently deployed free backend cannot complete. Existing username
 * sign-in remains available even if the capabilities request fails.
 */
export function installAuthCapabilities({win,check,note=()=>{}}){
 const doc=win.document;
 const signupTab=doc.getElementById('authModeSignup');
 const signupButton=doc.getElementById('signup');
 const forgot=doc.getElementById('forgot');
 const location=doc.getElementById('loginMethodNote');
 if(!signupTab||!signupButton)return {
  ready:async()=>false,ensureSignup:async()=>false,supportsRecovery:()=>false,dispose(){}
 };
 const status=doc.createElement('p');
 status.id='luoAuthCapabilitiesStatus';
 status.className='tiny muted';
 status.setAttribute('role','status');
 status.setAttribute('aria-live','polite');
 location?.after(status);
 let current=null,lastCheck=0,pending=null,disposed=false;
 const staleMs=45000;
 const message=()=>current?.username_signup===true?'Username registration is available. Save your recovery codes securely.':
  'Existing accounts can sign in by username. New account registration is temporarily unavailable while secure recovery is being installed.';
 const setNotice=txt=>{if(!disposed)status.textContent=txt};
 const support=()=>current?.username_signup===true&&current?.username_recovery===true;
 const poll=async(force=false)=>{
  if(disposed)return false;
  if(pending)return pending;
  if(!force&&lastCheck&&Date.now()-lastCheck<staleMs)return support();
  lastCheck=Date.now();
  pending=(async()=>{
   try{
    const r=await check();
    if(disposed)return false;
    // On an old server the 'capabilities' action is unknown and MUST fail
    // closed rather than assuming unsupported registration is ready.
    current={username_signin:r?.username_signin===true,
      username_signup:r?.username_signup===true,
      username_recovery:r?.username_recovery===true};
    setNotice(message());
    return support();
   }catch{
    if(disposed)return false;
    current={username_signin:true,username_signup:false,username_recovery:false};
    setNotice('Username sign-in is available. Registration and recovery could not be checked; they remain disabled for safety.');
    return false;
   }finally{pending=null}
  })();
  return pending;
 };
 function inform(type){
  if(disposed)return;
  setNotice(type==='recovery'?
   'Username recovery is not enabled on the server yet. Existing accounts with email recovery can use the current production website.':
   message());
 }
 const stop=(e)=>{e.preventDefault();e.stopImmediatePropagation()};
 function onSignupClick(e){
  if(support())return;
  stop(e);
  inform('signup');
  // The UI never submits while the capability check is pending.
  if(!pending)void poll(Date.now()-lastCheck>=staleMs).then(ok=>{
    if(!ok)inform('signup');
  });
 }
 function onRecoveryClick(e){
  if(current?.username_recovery===true)return;
  stop(e);
  inform('recovery');
  if(!pending)void poll(Date.now()-lastCheck>=staleMs);
 }
 signupTab.addEventListener('click',onSignupClick,true);
 signupButton.addEventListener('click',onSignupClick,true);
 forgot?.addEventListener('click',onRecoveryClick,true);
 void poll();
 return {
  ready:poll,
  ensureSignup:()=>poll().then(ok=>{if(!ok)inform('signup');return ok}),
  supportsRecovery:()=>current?.username_recovery===true,
  dispose(){
   disposed=true;
   signupTab.removeEventListener('click',onSignupClick,true);
   signupButton.removeEventListener('click',onSignupClick,true);
   forgot?.removeEventListener('click',onRecoveryClick,true);
   status.remove();
  }
 };
}

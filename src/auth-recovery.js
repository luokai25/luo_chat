// Human-facing auth errors: never tell users their passwords are wrong during infrastructure incidents.
export function isTransientAuthError(error){
 if(!error)return false;
 const status=Number(error.status??error.statusCode??0),code=String(error.code||'').toLowerCase(),name=String(error.name||'').toLowerCase();
 const message=String(error.message||'').toLowerCase();
 if(['invalid_credentials','email_not_confirmed','user_banned','email_exists','weak_password'].includes(code))return false;
 return status>=500||status===429||['authretryablefetcherror','authunknownerror','aborterror','timeouterror','fetcherror'].includes(name)||
 ['over_request_rate_limit','unexpected_failure','request_timeout'].includes(code)||
 /(?:network|fetch failed|failed to fetch|connection|timeout|timed out|aborted|gateway|temporarily unavailable|service unavailable|context canceled|context deadline)/i.test(message);
}
export function describeAuthError(error,phase='signin'){
 if(isTransientAuthError(error))return phase==='restore'?
  'Luo Chat cannot reach the sign-in service right now. Your saved session may still be valid. Retry restoration when the connection recovers.':
  'Luo Chat sign-in is temporarily unavailable. Your account and chats have not been deleted. Please retry shortly.';
 const code=String(error?.code||'').toLowerCase();
 if(code==='invalid_credentials')return 'Username or password was not accepted. Check both and try again.';
 if(code==='email_not_confirmed')return 'This account needs migration support before username sign-in. Contact Luo Chat support.';
 if(code==='over_email_send_rate_limit')return 'Email requests are temporarily limited. Please try again later.';
 if(phase==='restore')return 'Your session could not be restored. You can retry or sign in again.';
 return String(error?.message||'Authentication could not finish. Please retry.').slice(0,260);
}
export function createAuthRestoreControl({doc,onRetry}){
 const target=doc.getElementById('authmsg');
 if(!target)return {show(){},hide(){}};
 const button=doc.createElement('button');button.id='retryAuthRestore';button.type='button';button.className='ghost';button.textContent='Retry session restoration';button.hidden=true;
 button.setAttribute('aria-label','Retry restoring your previous Luo Chat session');target.after(button);
 let running=false;
 button.onclick=async()=>{if(running)return;running=true;button.disabled=true;button.textContent='Checking session…';try{await onRetry()}finally{running=false;button.disabled=false;button.textContent='Retry session restoration'}};
 return {show(message){target.textContent=message;button.hidden=false;},hide(){button.hidden=true;}};
}

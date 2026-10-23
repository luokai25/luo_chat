// Google credentials stay on Google's page. This app only starts Supabase's OAuth flow.
export function installGoogleSignIn({win,db,$,projectUrl,publicKey,onStart=()=>{},setBusy=()=>{},navigate=url=>win.location.assign(url)}){
 const button=$('googleSignIn'),status=$('googleAuthStatus'),retry=$('retryGoogleAuth');
 // Google OAuth has not been enabled or verified in the production Supabase project.
 // When these controls are intentionally absent, do not probe Auth settings during an outage.
 // Keep a safe lifecycle interface for callers until a tested Google integration is activated.
 if(!button||!status||!retry){
  return {
   reset(){},
   sessionReady(){const url=new URL(win.location.href);if(url.searchParams.get('auth')==='google'){url.searchParams.delete('auth');for(const param of ['error','error_code','error_description'])url.searchParams.delete(param);win.history.replaceState(null,'',url.pathname+url.search+url.hash)}},
   dispose(){}
  };
 }
 const backend=new URL(projectUrl),callback=win.location.origin+'/?auth=google';
 let available=false,running=false,disposed=false,checkId=0,attempt=0,controller=null;
 function render(){button.disabled=!available||running;button.textContent=running?'Opening Google…':'Continue with Google'}
 function callbackError(){const url=new URL(win.location.href);if(url.searchParams.get('auth')!=='google')return;const fragment=new URLSearchParams(url.hash.slice(1)),error=url.searchParams.get('error')||fragment.get('error');if(!error&&!url.searchParams.has('error_description')&&!fragment.has('error_description'))return;status.textContent=error==='access_denied'?'Google sign-in was cancelled. You can try again or use email and password.':'Google sign-in could not finish. Try again or use email and password.';for(const key of ['auth','error','error_code','error_description'])url.searchParams.delete(key);if(fragment.has('error')||fragment.has('error_description'))url.hash='';win.history.replaceState(null,'',url.pathname+url.search+url.hash)}
 callbackError();const callbackStatus=status.textContent;
 async function check(){
  const id=++checkId;controller?.abort();const request=new win.AbortController();controller=request;available=false;render();retry.hidden=true;if(!callbackStatus)status.textContent='Checking Google sign-in…';
  const timeout=win.setTimeout(()=>request.abort(),12000);
  try{
   if(typeof win.fetch!=='function')throw Error('Unavailable');
   const response=await win.fetch(backend.origin+'/auth/v1/settings',{headers:{apikey:publicKey},credentials:'omit',cache:'no-store',redirect:'error',signal:request.signal});
   if(!response.ok)throw Error('Unavailable');const settings=await response.json();if(disposed||id!==checkId)return;
   available=settings.external?.google===true;retry.hidden=available;status.textContent=callbackStatus||(available?'Continue on Google’s sign-in page. Your Google password is never entered in Luo Chat.':'Google sign-in is not available yet. You can use email and password.');
  }catch{if(disposed||id!==checkId)return;status.textContent=callbackStatus||'Google sign-in could not be checked. Retry when connected, or use email and password.';retry.hidden=false}
  finally{win.clearTimeout(timeout);if(!disposed&&id===checkId)render()}
 }
 button.onclick=async()=>{
  if(!available||running||disposed)return;running=true;const id=++attempt;render();setBusy(true);onStart();status.textContent='Opening Google’s sign-in page…';
  try{
   const result=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:callback,scopes:'openid email profile',queryParams:{prompt:'select_account'},skipBrowserRedirect:true}});
   if(disposed||id!==attempt)return;if(result.error||!result.data?.url)throw Error('Unavailable');
   const target=new URL(result.data.url);
   if(target.origin!==backend.origin||target.pathname!=='/auth/v1/authorize'||target.username||target.password||target.hash||target.searchParams.get('provider')!=='google'||target.searchParams.get('redirect_to')!==callback)throw Error('Invalid OAuth destination');
   navigate(target.href);
  }catch{if(disposed||id!==attempt)return;running=false;setBusy(false);render();status.textContent='Google sign-in could not start. Try again or use email and password.'}
 };
 retry.onclick=check;
 function reset(){attempt++;running=false;setBusy(false);render()}
 const pageShow=event=>{if(event.persisted)reset()};win.addEventListener('pageshow',pageShow);
 check();
 return{reset,sessionReady(){const url=new URL(win.location.href);if(url.searchParams.get('auth')==='google'){url.searchParams.delete('auth');win.history.replaceState(null,'',url.pathname+url.search+url.hash)}},dispose(){disposed=true;attempt++;checkId++;controller?.abort();win.removeEventListener('pageshow',pageShow)}};
}

// Cloudflare Turnstile is a CAPTCHA-like challenge, not an authentication provider.
// The site key is public. The corresponding secret MUST exist only on the backend.
export const LUO_TURNSTILE_SITEKEY='0x4AAAAAAFiTtgU3UWQo_kO3';
export function installSignupChallenge({doc,win}){
 const host=doc.getElementById('luoSignupChallenge');
 const feedback=doc.getElementById('luoSignupChallengeStatus');
 if(!host)return {activate(){},deactivate(){},reset(){},getToken(){return ''}};
 let active=false,widgetId=null,token='';
 function message(value){if(feedback)feedback.textContent=value}
 function clearToken(){token=''}
 function render(){
  if(!active||widgetId!==null||typeof win.turnstile?.render!=='function')return;
  try{
   widgetId=win.turnstile.render(host,{
    sitekey:LUO_TURNSTILE_SITEKEY,theme:'dark',action:'luo_signup',
    callback(value){token=typeof value==='string'?value:'';message(token?'Security check completed.':'Security verification is required.')},
    'expired-callback'(){clearToken();message('Verification expired. Complete the security check again.')},
    'timeout-callback'(){clearToken();message('Security check timed out. Please retry.')},
    'error-callback'(){clearToken();message('Security check unavailable. Registration cannot continue yet.')},
   });
  }catch{clearToken();message('Security check unavailable. Registration cannot continue yet.')}
 }
 const loader=doc.querySelector('script[data-luo-turnstile]');
 if(loader)loader.addEventListener('load',render);
 const api={
  activate(){active=true;host.hidden=false;host.classList.remove('hidden');render();if(widgetId===null)message('Loading the registration security check…')},
  deactivate(){active=false;host.hidden=true;host.classList.add('hidden');api.reset();message('')},
  reset(){clearToken();try{if(widgetId!==null)win.turnstile?.reset(widgetId)}catch{}},
  getToken(){return active?token:''},
 };
 api.deactivate();
 return api;
}

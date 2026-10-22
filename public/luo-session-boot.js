/* Luo Chat initial auth renderer. Never keep first-time users behind the recovery overlay. */
(function(){'use strict';
 const root=document.documentElement;
 let hasUsableSession=false;
 try{
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);
   if(!/^sb-[a-z0-9-]+-auth-token$/.test(key||''))continue;
   let parsed;try{parsed=JSON.parse(localStorage.getItem(key)||'null')}catch{continue}
   // Supabase persists the session object, not an authorization boolean.
   const session=parsed?.currentSession||parsed?.session||parsed;
   if(!session||typeof session!=='object'||typeof session.access_token!=='string'||!session.access_token||typeof session.refresh_token!=='string'||!session.refresh_token)continue;
   const expires=Number(session.expires_at)||0;
   // A token that expired long ago is stale; an expired token with a refresh token
   // is allowed a short authentication attempt, not an indefinite blank page.
   if(expires && expires<Date.now()/1000-60*60*24*7)continue;
   hasUsableSession=true;break;
  }
 }catch{}
 if(hasUsableSession)root.classList.add('luo-restoring-session');
 else root.classList.remove('luo-restoring-session');
})();


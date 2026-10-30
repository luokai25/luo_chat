(()=>{'use strict';
 const KEY='luo-agent-funnel-session-v1';
 const path=location.pathname.replace(/\/$/,'')||'/';
 const routes=new Set(['/agents','/agent-verification','/agent-checkout']);
 const events=new Set(['agent_guide_view','verification_page_view','registration_started','verification_start_clicked','verification_finish_submitted','registration_page_view','registration_submitted','checkout_page_view','checkout_attempted','checkout_created','checkout_resumed','checkout_status_checked','checkout_paid_confirmed','checkout_canceled']);
 if(!routes.has(path)||!events.size||navigator.doNotTrack==='1'||window.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;
 let sid;try{sid=sessionStorage.getItem(KEY);if(!sid){sid=crypto.randomUUID();sessionStorage.setItem(KEY,sid)}}catch{return}
 const params=new URLSearchParams(location.search),campaign={};
 for(const k of ['utm_source','utm_medium','utm_campaign']){const v=params.get(k);if(v&&/^[a-zA-Z0-9._-]{1,80}$/.test(v))campaign[k]=v}
 function track(event,extra={}){if(!events.has(event))return;const payload={event,session_id:sid,path,...(Object.keys(campaign).length?{campaign}:{}),...extra};
  try{fetch('/api/agent-funnel',{method:'POST',credentials:'omit',cache:'no-store',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{})}catch{}
 }
 const pageEvents={'/agents':'agent_guide_view','/agent-verification':'verification_page_view','/agent-checkout':'checkout_page_view'};
 track(pageEvents[path]);
 document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;const href=new URL(a.href,location.href);
  if(href.pathname==='/agent-verification'){track('registration_started');track('verification_start_clicked')}
  if(href.pathname==='/agent-checkout')track('checkout_page_view');
  if(path==='/agent-checkout'&&new URLSearchParams(href.search).get('checkout')==='canceled')track('checkout_canceled');
 },true);
 document.addEventListener('submit',e=>{const f=e.target;if(!(f instanceof HTMLFormElement))return;
  if(path==='/agent-checkout')track('checkout_attempted');
  else if(path==='/agent-verification')track('verification_finish_submitted');
  else if(path==='/agents')track('registration_submitted');
 },true);
 window.LuoAgentFunnel=Object.freeze({track});
})();
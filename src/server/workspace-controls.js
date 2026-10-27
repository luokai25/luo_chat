import {agentRuntime} from './agent-environment.js';
export const CONTROL_FLAGS=Object.freeze({registration:'LUO_AGENT_PENDING_REGISTRATION_ENABLED',checkout:'LUO_AGENT_LIVE_CHECKOUT_ENABLED',paid_api:'LUO_AGENT_PAID_API_ENABLED',posts:'LUO_AGENT_POSTS_ENABLED',chat:'LUO_AGENT_CHAT_ENABLED'});
export async function readWorkspaceControls(env=process.env,fetcher=fetch){
 const runtime=agentRuntime(env);if(!runtime||runtime.mode!=='live')throw Error('WORKSPACE_RUNTIME_UNAVAILABLE');
 const response=await fetcher(runtime.url+'/rest/v1/rpc/luo_agent_runtime_controls',{method:'POST',headers:{apikey:runtime.serviceKey,Authorization:'Bearer '+runtime.serviceKey,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('WORKSPACE_CONTROLS_UNAVAILABLE');const data=await response.json();
 if(!data||!data.flags||typeof data.deployment_hold!=='boolean'||!/^[a-f0-9]{40}$/.test(data.approved_commit)||Object.keys(CONTROL_FLAGS).some(k=>typeof data.flags[k]!=='boolean'))throw Error('WORKSPACE_CONTROLS_INVALID');return data;
}
export async function effectiveAgentEnvironment(env=process.env,fetcher=fetch){
 if(env.LUO_WORKSPACE_CONTROLS_ENABLED!=='true')return env;
 const result={...env};let controls;try{controls=await readWorkspaceControls(env,fetcher)}catch{controls=null}
 for(const [name,key] of Object.entries(CONTROL_FLAGS))if(!controls||!controls.flags[name])result[key]='false';
 // Billing availability follows checkout. Webhook processing always keeps the original environment.
 if(result.LUO_AGENT_LIVE_CHECKOUT_ENABLED==='false')result.LUO_AGENT_BILLING_ENABLED='false';
 return result;
}
export async function assertWorkspaceRelease(env=process.env,fetcher=fetch){
 if(env.VERCEL_ENV!=='production'||env.LUO_WORKSPACE_CONTROLS_ENABLED!=='true')return;
 const c=await readWorkspaceControls(env,fetcher);
 if(c.deployment_hold)throw Error('WORKSPACE_RELEASE_ON_HOLD');
 if(c.approved_commit!==env.VERCEL_GIT_COMMIT_SHA||c.approved_branch!==env.VERCEL_GIT_COMMIT_REF)throw Error('WORKSPACE_RELEASE_APPROVAL_MISMATCH');
 if(!Number.isFinite(Date.parse(c.not_before))||Date.now()<Date.parse(c.not_before))throw Error('WORKSPACE_RELEASE_NOT_BEFORE');
}
// PayPal subscription-history entries come from authenticated provider reconciliation.
// Fees are optional provider data; absence stays unknown.
export function paypalCashEvidence(transactions,intent){
 const minor=money=>money?.currency_code==='USD'&&typeof money.value==='string'&&/^\d{1,10}\.\d{2}$/.test(money.value)?Number(money.value.replace('.','')):null;
 return (Array.isArray(transactions)?transactions:[]).flatMap(t=>{
  const b=t.amount_with_breakdown;const gross=minor(b?.gross_amount||t.amount),fee=minor(b?.fee_amount),net=minor(b?.net_amount);
  if(t.status!=='COMPLETED'||typeof t.id!=='string'||!/^[A-Za-z0-9_-]{3,128}$/.test(t.id)||![intent.regular_cents,intent.first_invoice_cents].includes(gross)||!Number.isFinite(Date.parse(t.time||t.create_time)))return [];
  const validFee=fee!==null&&net!==null&&gross-fee===net;
  return [{id:t.id,gross,fee:validFee?fee:null,net:validFee?net:null,time:new Date(t.time||t.create_time).toISOString()}];
 });
}

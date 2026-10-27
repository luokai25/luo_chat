// Isolate staging identities from the real Luo Chat database.
// The production path is opt-in and fails closed until its schema and secret
// rotation have been explicitly verified by the operator.
export const AGENT_STAGING_URL='https://itecovbwilcrvjqkdoyd.supabase.co';
export const AGENT_PRODUCTION_URL='https://byjixqwpjvsgmqilmzbm.supabase.co';
// Only explicitly reviewed feature branches can access isolated staging secrets.
const PREVIEW_BRANCHES=new Set(['feature/reels-immersive-20261025','feature/agent-autonomous-onboarding-20261026','release/agent-api-20261027']);
const PREVIEW_ORIGIN=/^https:\/\/luo-chat-luokai25-[a-z0-9]+-luokai25s-projects\.vercel\.app$/;
const PROD_ORIGIN='https://luo-chat-luokai25.vercel.app';
const validKey=(v,min=30)=>typeof v==='string'&&v.length>=min;
export function agentRuntime(env={}){
 if(env.VERCEL_ENV==='preview'&&PREVIEW_BRANCHES.has(env.VERCEL_GIT_COMMIT_REF)
   &&env.LUO_AGENT_STAGING_URL===AGENT_STAGING_URL
   &&validKey(env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY,32))
  return {mode:'sandbox',url:AGENT_STAGING_URL,serviceKey:env.LUO_AGENT_STAGING_SERVICE_ROLE_KEY,
   publishableKey:env.LUO_AGENT_STAGING_PUBLISHABLE_KEY};
 if(env.VERCEL_ENV==='production'
   &&env.LUO_AGENT_PRODUCTION_ENABLED==='true'
   &&env.LUO_AGENT_PRODUCTION_DATABASE_READY==='true'
   &&env.LUO_AGENT_LIVE_SECRET_ROTATED==='true'
   &&env.SUPABASE_URL===AGENT_PRODUCTION_URL
   &&validKey(env.SUPABASE_SERVICE_ROLE_KEY,32)
   &&validKey(env.SUPABASE_PUBLISHABLE_KEY,25))
  return {mode:'live',url:AGENT_PRODUCTION_URL,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY,
   publishableKey:env.SUPABASE_PUBLISHABLE_KEY};
 return null;
}
export function trustedAgentOrigin(origin,env={}){
 if(typeof origin!=='string'||origin==='null')return false;
 if(env.VERCEL_ENV==='production')return origin===PROD_ORIGIN;
 return env.VERCEL_ENV==='preview'&&PREVIEW_ORIGIN.test(origin);
}
export function isValidAgentOrigin(req,env={}){
 if(req.headers?.['sec-fetch-site']==='cross-site')return false;
 const origin=req.headers?.origin;
 return origin===undefined||trustedAgentOrigin(origin,env);
}
export function agentCheckoutOrigin(req,env={}){
 const host=req.headers?.host;
 if(typeof host!=='string'||!/^[a-z0-9.-]+$/.test(host))return null;
 const origin='https://'+host;
 return trustedAgentOrigin(origin,env)?origin+'/':null;
}
export function paypalMerchantSettings(env={}){
 const runtime=agentRuntime(env);
 if(!runtime)return null;
 if(runtime.mode==='sandbox'){
  if(env.LUO_PAYPAL_ENV!=='sandbox'||!validKey(env.LUO_PAYPAL_CLIENT_ID,13)
    ||!validKey(env.LUO_PAYPAL_CLIENT_SECRET,21))return null;
  return {mode:'sandbox',api:'https://api-m.sandbox.paypal.com',approval:'https://www.sandbox.paypal.com/',
   clientId:env.LUO_PAYPAL_CLIENT_ID,clientSecret:env.LUO_PAYPAL_CLIENT_SECRET};
 }
 if(!validKey(env.LUO_PAYPAL_LIVE_CLIENT_ID,16)||!validKey(env.LUO_PAYPAL_LIVE_CLIENT_SECRET,16))
  return null;
 return {mode:'live',api:'https://api-m.paypal.com',approval:'https://www.paypal.com/',
  clientId:env.LUO_PAYPAL_LIVE_CLIENT_ID,clientSecret:env.LUO_PAYPAL_LIVE_CLIENT_SECRET};
}

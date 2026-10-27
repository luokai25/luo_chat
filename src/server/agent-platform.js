import {MEMBERSHIP_PRICES,quoteAgentPlan} from './agent-pricing.js';
// Public agent discovery contract. No account activation or paid entitlement is inferred here.
export const AGENT_PLANS=Object.freeze({
 starter:Object.freeze({label:'Standard',features:['agent-profile','consensual-agent-text-chat','agent-only-text-posts','personalized-agent-feed','feed-preferences','usage-limits'],limits:{api_per_minute:20,api_per_day:1000,messages_per_day:200,posts_per_day:10}}),
 pro:Object.freeze({label:'Pro',features:['agent-profile','consensual-agent-text-chat','agent-only-text-posts','personalized-agent-feed','feed-preferences','usage-limits'],limits:{api_per_minute:40,api_per_day:2000,messages_per_day:400,posts_per_day:20}}),
 max:Object.freeze({label:'Maximum',features:['agent-profile','consensual-agent-text-chat','agent-only-text-posts','personalized-agent-feed','feed-preferences','usage-limits'],limits:{api_per_minute:100,api_per_day:6000,messages_per_day:1200,posts_per_day:60}})
});
export const USERNAME_PATTERN=/^[a-z][a-z0-9_]{2,23}$/;
export const RESERVED_NAMES=new Set(['admin','administrator','support','system','root','luo','luochat','luo_chat','official','security','billing','moderator','chatgpt','openai','claude','anthropic','gemini','google']);
export function normalizeAgentUsername(value){
 if(typeof value!=='string'||value.length>64)return null;
 const name=value.trim().normalize('NFKC').toLowerCase();
 return USERNAME_PATTERN.test(name)&&!RESERVED_NAMES.has(name)&&!name.startsWith('luo_')?name:null;
}
export function publicPlans(options={}){
 return Object.entries(AGENT_PLANS).map(([id,plan])=>({id,name:plan.label,...quoteAgentPlan(id,options),price_status:options.billingEnabled?'live_monthly_subscription':'approved_pending_processor_setup',limits:plan.limits,features:plan.features,subscription_required:true,one_agent_per_subscription:true}));
}
export function agentPlatformInfo({billingEnabled=false,registrationEnabled=false}={}){
 return {platform:'Luo Chat',purpose:'Social and communications for humans and openly identified AI agents',api_version:'v1',agent_memberships:billingEnabled&&registrationEnabled?'open':'not_open',billing:billingEnabled?'paypal_live_recurring':'approved_prices_checkout_not_live',human_signup:'free',minimum_human_age:12,guardian_gate_under:18,agent_identity_label:'AI Agent',payment_verification:'server-side processor webhook + subscription reconciliation required',documentation:'/agents',plans:'/api/v1/plans',public_api:'/api/v1/platform',private_data_indexable:false};
}
export function sendJson(res,status,value){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(value)}
export function methodOnlyGet(req,res,data){if(req.method!=='GET'){res.setHeader('Allow','GET');return sendJson(res,405,{error:{code:'METHOD_NOT_ALLOWED',message:'Use GET'}})}return sendJson(res,200,data)}
export function notActivated(req,res){
 res.setHeader('Retry-After','86400');
 return sendJson(res,503,{error:{code:'AGENT_MEMBERSHIPS_NOT_ACTIVE',message:'Agent registration and paid membership are not active. No payment has been initiated.',documentation:'/agents'}});
}

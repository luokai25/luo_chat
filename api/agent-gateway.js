// One Vercel serverless gateway for all /api/v1 routes.
// Preserves raw Stripe/PayPal payload bytes and stays within Hobby function cap.
import {agentPlatformInfo,publicPlans,methodOnlyGet,sendJson} from '../src/server/agent-platform.js';
import {createAgentRegistrationHandler} from '../src/server/agent-registration.js';
import {createAgentLoginHandler} from '../src/server/agent-login.js';
import {createAgentAccountHandler} from '../src/server/agent-account.js';
import {createAgentCheckoutHandler} from '../src/server/agent-billing.js';
import {createPaymentWebhookHandler} from '../src/server/agent-payment-webhooks.js';
import {createAgentMessagingHandler} from '../src/server/agent-messaging.js';
import {createAgentVerificationHandler} from '../src/server/agent-verification.js';
import {createAgentOnboardingHandler} from '../src/server/agent-onboarding.js';
export const config={api:{bodyParser:false}};
const routes=Object.freeze({
 platform:(req,res)=>methodOnlyGet(req,res,agentPlatformInfo()),
 'agents/onboarding':createAgentOnboardingHandler(),
 plans:(req,res)=>methodOnlyGet(req,res,{billing_enabled:false,plans:publicPlans({
  promoStart:process.env.LUO_AGENT_BILLING_ENABLED==='true'&&process.env.LUO_AGENT_PROMOTIONS_ENABLED==='true'?process.env.LUO_AGENT_PROMO_START_AT:undefined})}),
 'agents/verification':createAgentVerificationHandler({mode:'info'}),
 'agents/verification/start':createAgentVerificationHandler({mode:'start'}),
 'agents/verification/finish':createAgentVerificationHandler({mode:'finish'}),
 'agents/verification/status':createAgentVerificationHandler({mode:'status'}),
 'agents/register':createAgentRegistrationHandler(),
 'agents/login':createAgentLoginHandler(),
 'agents/me':createAgentAccountHandler({mode:'profile'}),
 'agents/peers':createAgentMessagingHandler({mode:'peers'}),
 usage:createAgentAccountHandler({mode:'usage'}),
 messages:createAgentMessagingHandler({mode:'messages'}),
 'billing/checkout':createAgentCheckoutHandler(),
 'billing/stripe-webhook':createPaymentWebhookHandler({provider:'stripe'}),
 'billing/paypal-webhook':createPaymentWebhookHandler({provider:'paypal'})
});
async function loadRawBody(req){
 if(Buffer.isBuffer(req.rawBody))return req.rawBody;
 if(req.body&&typeof req.body==='object')return null; // direct unit tests only
 let size=0,chunks=[];try{for await(const p of req){size+=p.length;if(size>65536)return false;chunks.push(p)}}
 catch{return false}
 const raw=Buffer.concat(chunks);req.rawBody=raw;return raw;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const param=req.query?.path;
 const path=(Array.isArray(param)?param.join('/'):typeof param==='string'?param:'').replace(/^\/+|\/+$/g,'');
 if(!Object.hasOwn(routes,path))return sendJson(res,404,{error:{code:'NOT_FOUND'}});
 // GET does not have an HTTP request body; do not try reading a nonexistent stream.
 if(req.method!=='POST')return routes[path](req,res);
 const raw=await loadRawBody(req);
 if(raw===false)return sendJson(res,413,{error:{code:'REQUEST_TOO_LARGE'}});
 if(raw&&path!=='billing/stripe-webhook'&&path!=='billing/paypal-webhook'&&req.method==='POST'){
  if(!req.headers?.['content-type']?.startsWith('application/json'))return sendJson(res,415,{error:{code:'UNSUPPORTED_CONTENT_TYPE'}});
  if(raw.length>8192)return sendJson(res,413,{error:{code:'REQUEST_TOO_LARGE'}});
  try{req.body=JSON.parse(raw.toString('utf8'))}
  catch{return sendJson(res,400,{error:{code:'INVALID_JSON'}})}
 }
 return routes[path](req,res);
}

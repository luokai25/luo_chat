import {effectiveAgentEnvironment} from '../src/server/workspace-controls.js';
import {discoverPlatform,discoverPlans} from '../src/server/agent-discovery.js';
// One Vercel serverless gateway for all /api/v1 routes.
// Preserves raw Stripe/PayPal payload bytes and stays within Hobby function cap.
import {methodOnlyGet,sendJson} from '../src/server/agent-platform.js';
import {createAgentRegistrationHandler} from '../src/server/agent-registration.js';
import {createAgentLoginHandler} from '../src/server/agent-login.js';
import {createAgentAccountHandler} from '../src/server/agent-account.js';
import {createAgentCheckoutHandler} from '../src/server/agent-billing.js';
import {createAgentCheckoutStatusHandler} from '../src/server/agent-checkout-status.js';
import {createAgentPostsHandler} from '../src/server/agent-posts.js';
import {createAgentServicesHandler} from '../src/server/agent-services.js';
import {createPaymentWebhookHandler} from '../src/server/agent-payment-webhooks.js';
import {createAgentMessagingHandler} from '../src/server/agent-messaging.js';
import {createAgentVerificationHandler} from '../src/server/agent-verification.js';
import {createAgentOnboardingHandler} from '../src/server/agent-onboarding.js';
import {createRecommendationHandler} from '../src/server/luo-for-you-api.js';
import {captureAgentApiFunnel} from '../src/server/agent-api-funnel.js';
export const config={api:{bodyParser:false}};
function makeRoutes(env){return Object.freeze({
 platform:(req,res)=>methodOnlyGet(req,res,discoverPlatform(env)),
 'recommendations/feed':createRecommendationHandler({mode:'feed',env}),
 'recommendations/feedback':createRecommendationHandler({mode:'feedback',env}),
 'recommendations/preferences':createRecommendationHandler({mode:'preferences',env}),
 'agents/onboarding':createAgentOnboardingHandler({env}),
 'agents/services':createAgentServicesHandler({env}),
 plans:(req,res)=>methodOnlyGet(req,res,discoverPlans(env)),
 'agents/verification':createAgentVerificationHandler({mode:'info',env}),
 'agents/verification/start':createAgentVerificationHandler({mode:'start',env}),
 'agents/verification/finish':createAgentVerificationHandler({mode:'finish',env}),
 'agents/verification/status':createAgentVerificationHandler({mode:'status',env}),
 'agents/register':createAgentRegistrationHandler({env}),
 'agents/login':createAgentLoginHandler({env}),
 'agents/me':createAgentAccountHandler({mode:'profile',env}),
 'agents/peers':createAgentMessagingHandler({mode:'peers',env}),
 'agents/posts':createAgentPostsHandler({env}),
 'agents/feed':createAgentPostsHandler({mode:'feed',env}),
 'agents/feed/preferences':createAgentPostsHandler({mode:'preferences',env}),
 usage:createAgentAccountHandler({mode:'usage',env}),
 messages:createAgentMessagingHandler({mode:'messages',env}),
 'billing/checkout':createAgentCheckoutHandler({env}),
 'billing/status':createAgentCheckoutStatusHandler({env}),
 'billing/stripe-webhook':createPaymentWebhookHandler({provider:'stripe',env}),
 'billing/paypal-webhook':createPaymentWebhookHandler({provider:'paypal',env})
});}
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
 if(!Object.hasOwn(makeRoutes(process.env),path))return sendJson(res,404,{error:{code:'NOT_FOUND'}});
 const env=path.endsWith('-webhook')||path.startsWith('recommendations/')?process.env:await effectiveAgentEnvironment();
 const routes=makeRoutes(env);
 if(!Object.hasOwn(routes,path))return sendJson(res,404,{error:{code:'NOT_FOUND'}});
 async function runTracked(){
  let responseBody;
  const originalJson=res.json.bind(res);
  res.json=function(value){responseBody=value;return originalJson(value)};
  const result=await routes[path](req,res);
  await captureAgentApiFunnel({env,route:path,method:req.method,statusCode:res.statusCode,requestBody:req.body,responseBody,rawBody:req.rawBody});
  return result;
 }
 // GET does not have an HTTP request body; do not try reading a nonexistent stream.
 if(req.method!=='POST')return runTracked();
 const raw=await loadRawBody(req);
 if(raw===false)return sendJson(res,413,{error:{code:'REQUEST_TOO_LARGE'}});
 if(raw&&path!=='billing/stripe-webhook'&&path!=='billing/paypal-webhook'&&req.method==='POST'){
  if(!req.headers?.['content-type']?.startsWith('application/json'))return sendJson(res,415,{error:{code:'UNSUPPORTED_CONTENT_TYPE'}});
  if(raw.length>8192)return sendJson(res,413,{error:{code:'REQUEST_TOO_LARGE'}});
  try{req.body=JSON.parse(raw.toString('utf8'))}
  catch{return sendJson(res,400,{error:{code:'INVALID_JSON'}})}
 }
 return runTracked();
}

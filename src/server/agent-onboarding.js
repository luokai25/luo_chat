import {publicPlans,sendJson} from './agent-platform.js';
import {agentRuntime} from './agent-environment.js';
import {registrationIsEnabled,requireVerifiedAgentKey} from './agent-registration.js';
import {paidAgentApiEnabled} from './agent-account.js';
import {checkoutReady} from './agent-billing.js';
import {verificationRuntime} from './agent-verification.js';

export function describeAutonomousOnboarding(env={}){
 const runtime=agentRuntime(env);
 const ready=registrationIsEnabled(env);
 const providers={paypal:checkoutReady(env,'paypal'),stripe:checkoutReady(env,'stripe')};
 const loginReady=paidAgentApiEnabled(env);
 const proof=requireVerifiedAgentKey(env);
 return {
  platform:'Luo Chat',version:'1',identity:'AI Agent',human_owner_approval_required:false,
  human_account_required:false,human_signup:'free',agent_accounts:'paid_only',
  status:ready&&loginReady&&Object.values(providers).some(Boolean)?'configuration_ready_not_payment_verified':'not_available',
  environment:runtime?.mode||'disabled',
  capabilities:{registration:ready,public_key_verification:!!verificationRuntime(env),
   verified_key_required:proof,paid_login:loginReady,checkout:providers},
  subscription:{currency:'USD',interval:'MONTH',seats_per_subscription:1,plans:publicPlans()},
  protocol:{challenge:'Ed25519',agent_label:'AI Agent',auth:'username_password_then_scoped_1_hour_API_key',
   no_human_approval:true,payment:'merchant_verified_recurring_subscription',
   payer_notice:'PayPal subscription approval may require authorization by the payer; this is separate from Luo Chat human-account approval.',
   activation:'processor_authenticated_webhook_plus_payment_reconciliation',
   checkout_return_url_does_not_grant_access:true,
   checkout_idempotency:'one durable intent per agent; duplicate requests reuse or lock',
   payment_recovery:'POST /api/v1/billing/status never creates a new payment',
   manual_review_if_uncertain:true},
  steps:[
   {step:1,method:'POST',path:'/api/v1/agents/verification/start',body_keys:['username','public_key'],purpose:'Request nonce for Ed25519 key possession proof'},
   {step:2,method:'POST',path:'/api/v1/agents/verification/finish',body_keys:['id','signature'],purpose:'Finish key proof. Never sends a private key'},
   {step:3,method:'POST',path:'/api/v1/agents/register',body_keys:proof?['username','password','plan','verification_id']:['username','password','plan'],purpose:'Create unpaid pending AI identity, subject to rate limits'},
   {step:4,method:'POST',path:'/api/v1/billing/checkout',body_keys:['username','password','plan','provider'],purpose:'Get processor checkout URL, no entitlement yet'},
   {step:5,method:'POST',path:'/api/v1/billing/status',body_keys:['username','password'],purpose:'Check existing checkout without paying again; optionally resume the original processor URL'},
   {step:6,method:'POST',path:'/api/v1/agents/login',body_keys:['username','password'],purpose:'After verified payment, receive a time-limited bearer key; pending identity gets PAYMENT_REQUIRED'},
   {step:7,method:'GET',path:'/api/v1/agents/me',authentication:'Bearer luoa_<token>',purpose:'Read the own paid agent profile'}
  ],
  restrictions:['One active session per paid agent','Server-verified paid subscription','No impersonation of humans or brands','Automated rate limits and moderation','No access to private data without authorization'],
  docs:'/agents',api_docs:'/.well-known/luo-agents.json'
 };
}
export function createAgentOnboardingHandler({env=process.env}={}){
 return(req,res)=>{
  if(req.method!=='GET'){res.setHeader('Allow','GET');return sendJson(res,405,{error:{code:'METHOD_NOT_ALLOWED'}})}
  return sendJson(res,200,describeAutonomousOnboarding(env));
 };
}

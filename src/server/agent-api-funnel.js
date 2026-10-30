import {createHmac} from 'node:crypto';
const STEPS={
 'GET platform':'agent_api_discovery','GET plans':'agent_api_discovery','GET agents/onboarding':'agent_api_discovery',
 'POST agents/verification/start':'agent_verification_start',
 'POST agents/verification/finish':'agent_verification_finish',
 'POST agents/register':'agent_registration_attempt',
 'POST agents/login':'agent_login_attempt',
 'POST billing/checkout':'agent_checkout_attempt',
 'POST billing/status':'agent_payment_status_check',
 'POST billing/paypal-webhook':'agent_paypal_webhook_processed',
 'POST billing/stripe-webhook':'agent_stripe_webhook_processed'
};
const digest=(salt,value)=>createHmac('sha256',salt).update(String(value)).digest('hex');
function bodyOf(value){if(value&&typeof value==='object'&&!Array.isArray(value))return value;try{return JSON.parse(Buffer.from(value||'').toString('utf8'))}catch{return {}}}
export async function captureAgentApiFunnel({env=process.env,fetcher=fetch,route,method,statusCode,requestBody,responseBody,rawBody}={}){
 const step=STEPS[method+' '+route];if(!step)return;
 const key=env.LUO_POSTHOG_KEY,salt=env.LUO_TELEMETRY_SALT;
 if(typeof key!=='string'||!key||typeof salt!=='string'||salt.length<16)return;
 const input=bodyOf(requestBody),output=bodyOf(responseBody);
 let intentId=typeof output.intent_id==='string'?output.intent_id:null;
 if(!intentId&&route.endsWith('-webhook')){const event=bodyOf(rawBody);intentId=event.resource?.custom_id||event.resource?.supplementary_data?.related_ids?.subscription_id||event.data?.object?.metadata?.luo_intent||null}
 const username=typeof input.username==='string'?input.username.trim().toLowerCase():null;
 const actor=username?'username:'+username:intentId?'intent:'+intentId:route==='agents/verification/finish'&&typeof input.id==='string'?'verification:'+input.id:'request:'+route+':'+method+':'+Math.floor(Date.now()/60000);
 const props={distinct_id:'agent-'+digest(salt,actor),step,route,method,status_bucket:statusCode>=500?'server_error':statusCode>=400?'rejected':statusCode>=300?'redirect':'success',status_code:Number(statusCode)||0,$process_person_profile:false,$ip:'0.0.0.0'};
 if(['starter','pro','max'].includes(input.plan))props.plan=input.plan;
 if(['paypal','stripe'].includes(input.provider))props.provider=input.provider;
 if(intentId)props.intent_id_hash=digest(salt,intentId);
 if(['paid','awaiting_payment','canceled','paused','not_started','ready'].includes(output.state))props.payment_state=output.state;
 if(output.activation===true)props.activation_confirmed=true;
 try{
  const r=await fetcher('https://us.i.posthog.com/i/v0/e/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,event:'luo_agent_api_funnel',properties:props}),signal:AbortSignal.timeout(700)});
  if(!r.ok)throw Error();
 }catch{ /* Analytics must never change signup, login, checkout, or webhook outcomes. */ }
}

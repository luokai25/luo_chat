/**
 * Paid Luo Agent Accounts — fail-closed, explicit-scope authorization.
 *
 * These are NOT regular Supabase Auth users. Bots must never receive a human
 * Supabase session, user role, or unrestricted table grants. The trusted bot
 * gateway authenticates a high-entropy secret and applies this policy BEFORE
 * making an allowlisted server-side write. All calls require a paid entitlement.
 *
 * The AI model's own instructions, metadata, content, or declarations of
 * payment / "human" status are never evidence of authorization.
 */
export const BOT_ACTIONS=Object.freeze({
  read_assigned_thread:Object.freeze({minute:30,day:600,recipientMinute:15,requiresConsent:true}),
  send_reply:Object.freeze({minute:6,day:180,recipientMinute:2,requiresConsent:true}),
  react:Object.freeze({minute:12,day:250,recipientMinute:4,requiresConsent:true}),
  publish_public_post:Object.freeze({minute:2,day:12,recipientMinute:0,requiresConsent:false}),
});
export const BOT_DISABLED_ACTIONS=Object.freeze([
 'sign_up_human','send_cold_dm','read_contact_list','bulk_export',
 'scrape_profiles','search_all_users','invite_users','add_group_member',
 'create_group','manage_group','delete_other_users','delete_account',
 'read_private_story','read_unassigned_thread','initiate_call',
 'send_payment','buy_subscriptions','moderate','rotate_human_recovery',
 'mass_mention','send_file','webhook_admin','change_owner',
]);
const allowedTiers=new Set(['agent_basic','agent_pro']);
const maxClockDrift=5*60*1000;
export const BOT_USERNAME_RE=/^bot_[a-z][a-z0-9_]{2,19}$/;
export function canonicalBotUsername(raw){
 if(typeof raw!=='string')return null;
 const username=raw.trim().replace(/^@/,'').toLowerCase();
 return BOT_USERNAME_RE.test(username)?username:null;
}
export function isPaidEntitlement(bot,now=Date.now()){
 if(!bot||!allowedTiers.has(bot.tier))return false;
 if(bot.payment_status!=='active'||bot.moderation_status!=='approved'||bot.suspended===true)return false;
 const until=Date.parse(bot.paid_until||'');
 return Number.isFinite(until)&&until>now;
}
export function evaluateBotAction({bot,action,consent=null,recipientId=null,threadAssigned=false,usage={},now=Date.now(),requestId}={}){
 const deny=(reason)=>({allowed:false,reason});
 if(typeof action!=='string'||!Object.hasOwn(BOT_ACTIONS,action))return deny('unsupported_action');
 const rule=BOT_ACTIONS[action];
 if(!isPaidEntitlement(bot,now))return deny('inactive_entitlement');
 if(!Array.isArray(bot.scopes)||!bot.scopes.includes(action))return deny('scope_not_granted');
 if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))return deny('idempotency_required');
 if(!Number.isFinite(now))return deny('invalid_clock');
 if(rule.requiresConsent){
  if(typeof recipientId!=='string'||recipientId!==consent?.human_id)return deny('human_consent_required');
  if(consent.bot_id!==bot.id||consent.status!=='active')return deny('human_consent_required');
  const until=Date.parse(consent.expires_at||'');
  if(!Number.isFinite(until)||until<=now)return deny('human_consent_expired');
  if(!Array.isArray(consent.scopes)||!consent.scopes.includes(action))return deny('human_consent_required');
  if(!threadAssigned)return deny('assigned_thread_required');
 }
 for(const key of ['minute','day','recipientMinute']){
  const count=usage[key]??0,maximum=rule[key];
  if(!Number.isSafeInteger(count)||count<0)return deny('invalid_usage');
  if(maximum>0&&count>=maximum)return deny('quota_exceeded');
 }
 return {allowed:true,reason:'permitted',rule};
}
export function validatePaymentFulfillment({verified=false,event=null,order=null,now=Date.now()}={}){
 // Only the payment provider adapter is allowed to attest 'verified=true'.
 // The database and gateway MUST NOT accept this value from a browser/bot.
 const deny=(reason)=>({allowed:false,reason});
 if(verified!==true)return deny('unverified_signature');
 if(!order||order.state!=='pending'||!event)return deny('unknown_order');
 if(!['paymob','paddle'].includes(order.provider)||event.provider!==order.provider)return deny('wrong_provider');
 if(typeof event.event_id!=='string'||event.event_id.length<8||event.event_id.length>128)return deny('invalid_event');
 if(event.order_id!==order.provider_order_id||event.bot_id!==order.bot_id)return deny('wrong_order');
 if(!Number.isSafeInteger(order.amount_minor)||order.amount_minor<=0||event.amount_minor!==order.amount_minor)return deny('wrong_amount');
 if(!['EGP','USD','EUR'].includes(order.currency)||event.currency!==order.currency)return deny('wrong_currency');
 if(event.status!=='paid'||event.refunded===true||event.disputed===true)return deny('not_paid');
 const timestamp=Date.parse(event.occurred_at||'');
 if(!Number.isFinite(timestamp)||timestamp>now+maxClockDrift)return deny('invalid_event_time');
 if(!allowedTiers.has(order.tier))return deny('invalid_tier');
 return {allowed:true,reason:'verified_payment'};
}
export function safeBotPublicProfile(bot){
 if(!bot)return null;
 return {username:canonicalBotUsername(bot.username),account_type:'automated_agent',label:'AI Bot',verified_paid:isPaidEntitlement(bot)};
}

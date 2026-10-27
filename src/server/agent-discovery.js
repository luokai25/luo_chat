// Discovery reflects the same server gates used to accept registrations and payments.
import {publicPlans,agentPlatformInfo} from './agent-platform.js';
import {checkoutReady} from './agent-billing.js';
import {registrationIsEnabled} from './agent-registration.js';
export function discoveryOptions(env={}){
 return {billingEnabled:checkoutReady(env,'paypal')||checkoutReady(env,'stripe'),registrationEnabled:registrationIsEnabled(env),
 promoStart:env.LUO_AGENT_PROMOTIONS_ENABLED==='true'?env.LUO_AGENT_PROMO_START_AT:undefined};
}
export function discoverPlatform(env={}){return agentPlatformInfo(discoveryOptions(env))}
export function discoverPlans(env={}){const options=discoveryOptions(env);return {billing_enabled:options.billingEnabled,plans:publicPlans(options)}}

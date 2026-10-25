import {publicPlans,methodOnlyGet} from '../../src/server/agent-platform.js';
// No merchant prices have been authorized. Never fabricate prices or advertise active billing.
export default (req,res)=>methodOnlyGet(req,res,{plans:publicPlans({promoStart:process.env.LUO_AGENT_BILLING_ENABLED==='true'?process.env.LUO_AGENT_PROMO_START_AT:undefined}),billing_enabled:false});

import {publicPlans,methodOnlyGet} from '../../src/server/agent-platform.js';
// No merchant prices have been authorized. Never fabricate prices or advertise active billing.
export default (req,res)=>methodOnlyGet(req,res,{plans:publicPlans(),billing_enabled:false});

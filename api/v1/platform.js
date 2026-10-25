import {agentPlatformInfo,methodOnlyGet} from '../../src/server/agent-platform.js';
export default (req,res)=>methodOnlyGet(req,res,agentPlatformInfo());

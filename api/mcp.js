import {effectiveAgentEnvironment} from '../src/server/workspace-controls.js';
import {discoverPlatform,discoverPlans} from '../src/server/agent-discovery.js';
// Public discovery + disabled-default, read-only, scoped MCP agent account tools.
// This is a bearer-key preview integration, NOT a full OAuth 2.1 authorization server.
import {sendJson} from '../src/server/agent-platform.js';
import {paidAgentApiEnabled,createAgentAccountHandler} from '../src/server/agent-account.js';
const PUBLIC=new Set(['luo.get_platform_info','luo.get_subscription_plans']);
const PRIVATE=new Set(['luo.get_my_profile','luo.get_usage_limits']);
const publicTools=[
 {name:'luo.get_platform_info',description:'Read Luo Chat public agent integration status and safety policy',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'luo.get_subscription_plans',description:'See regular USD subscription prices, launch promotions and bounded tier quotas and live billing availability',inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
const privateTools=[
 {name:'luo.get_my_profile',description:'Return only the authenticated paid agent profile (requires profile:read permission)',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'luo.get_usage_limits',description:'Return authenticated paid agent usage and remaining rate limits (requires usage:read permission)',inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
const mcpReply=(res,id,payload)=>sendJson(res,200,{jsonrpc:'2.0',id,...payload});
function emptyArgs(params){return !!params&&typeof params==='object'&&!Array.isArray(params)&&!!params.arguments&&typeof params.arguments==='object'&&!Array.isArray(params.arguments)&&Object.keys(params.arguments).length===0}
function privateBearer(req){return typeof req.headers?.authorization==='string'&&/^Bearer luoa_[A-Za-z0-9_-]{43}$/.test(req.headers.authorization)}
async function privateResult(req,tool,env){
 const mode=tool==='luo.get_my_profile'?'profile':'usage';
 let status=0,body=null;const res={setHeader(){return this},status(n){status=n;return this},json(data){body=data;return this}};
 await createAgentAccountHandler({mode,env})(req,res);
 if(status!==200)return {isError:true,content:[{type:'text',text:JSON.stringify({error:body?.error?.code||'AGENT_UNAVAILABLE'})}]};
 return {content:[{type:'text',text:JSON.stringify(body)}],structuredContent:body};
}
export default async function handler(req,res){
 const env=await effectiveAgentEnvironment();
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return sendJson(res,405,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'POST required'}})}
 if(req.headers?.['sec-fetch-site']==='cross-site')return sendJson(res,403,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Cross-site request not allowed'}});
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>8192)return sendJson(res,400,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}});
 const {jsonrpc,method,params,id}=body;
 if(jsonrpc!=='2.0'||typeof method!=='string')return sendJson(res,400,{jsonrpc:'2.0',id:id??null,error:{code:-32600,message:'Invalid request'}});
 if(method==='initialize')return mcpReply(res,id,{result:{protocolVersion:['2026-07-28','2025-03-26'].includes(params?.protocolVersion)?params.protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'luo-chat',version:'0.2.0'}}});
 if(method==='notifications/initialized')return res.status(202).end();
 if(method==='ping')return mcpReply(res,id,{result:{}});
 if(method==='tools/list')return mcpReply(res,id,{result:{tools:paidAgentApiEnabled(env)&&privateBearer(req)?[...publicTools,...privateTools]:publicTools}});
 if(method==='tools/call'){
  if(!emptyArgs(params)||typeof params.name!=='string'||(!PUBLIC.has(params.name)&&!PRIVATE.has(params.name))){
   return mcpReply(res,id,{result:{isError:true,content:[{type:'text',text:'Unsupported tool or arguments'}]}});
  }
  if(PUBLIC.has(params.name)){
   const payload=params.name==='luo.get_platform_info'?discoverPlatform(env):discoverPlans(env);
   return mcpReply(res,id,{result:{content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload}});
  }
  if(!paidAgentApiEnabled(env)||!privateBearer(req)){
   return mcpReply(res,id,{result:{isError:true,content:[{type:'text',text:'Agent credential required or paid API unavailable'}]}});
  }
  try{return mcpReply(res,id,{result:await privateResult(req,params.name,env)})}
  catch{return mcpReply(res,id,{result:{isError:true,content:[{type:'text',text:'Agent service unavailable'}]}})}
 }
 return mcpReply(res,id,{error:{code:-32601,message:'Method not found'}});
}

// Safe public MCP discovery: no identity, payments or user content exposed.
import {agentPlatformInfo,publicPlans,sendJson} from '../src/server/agent-platform.js';
const names=new Set(['luo.get_platform_info','luo.get_subscription_plans']);
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return sendJson(res,405,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'POST required'}})}
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>8192)return sendJson(res,400,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}});
 const {jsonrpc,method,params,id}=body;
 if(jsonrpc!=='2.0'||typeof method!=='string')return sendJson(res,400,{jsonrpc:'2.0',id:id??null,error:{code:-32600,message:'Invalid request'}});
 if(method==='initialize')return sendJson(res,200,{jsonrpc:'2.0',id,result:{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'luo-chat',version:'0.1.0'}}});
 if(method==='notifications/initialized')return res.status(202).end();
 if(method==='ping')return sendJson(res,200,{jsonrpc:'2.0',id,result:{}});
 if(method==='tools/list')return sendJson(res,200,{jsonrpc:'2.0',id,result:{tools:[{name:'luo.get_platform_info',description:'Read Luo Chat public agent integration status and safety policy',inputSchema:{type:'object',properties:{},additionalProperties:false}},{name:'luo.get_subscription_plans',description:'Read non-billable tier specifications; prices are not configured',inputSchema:{type:'object',properties:{},additionalProperties:false}}]}});
 if(method==='tools/call'){
  if(!params||!names.has(params.name)||!params.arguments||typeof params.arguments!=='object'||Array.isArray(params.arguments)||Object.keys(params.arguments).length)return sendJson(res,200,{jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:'Unsupported tool or arguments'}]}});
  const payload=params.name==='luo.get_platform_info'?agentPlatformInfo():{billing_enabled:false,plans:publicPlans()};
  return sendJson(res,200,{jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload}});
 }
 return sendJson(res,200,{jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
}

import test from 'node:test';import assert from 'node:assert/strict';
import {createAgentFunnelHandler} from '../api/agent-funnel.js';
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){this.statusCode??=204;return this}});
const env={UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'test-token',LUO_TELEMETRY_SALT:'test-only-salt',LUO_POSTHOG_KEY:'test-write-key'};
const req=(body,changes={})=>({method:'POST',headers:{origin:'https://luo-chat-luokai25.vercel.app','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.2'},body,...changes});
test('funnel rejects invalid methods, origins, event names and private payloads before network calls',async()=>{
 const h=createAgentFunnelHandler({env,fetcher:()=>{throw Error('must not call')}}); 
 for(const [r,status] of [[req({event:'agent_guide_view'} ,{method:'GET'}),405],[req({event:'agent_guide_view'},{headers:{origin:'https://evil.test'}}),403],[req({event:'password',session_id:'11111111-1111-4111-8111-111111111111',path:'/agents'}),400],[req({event:'agent_guide_view',session_id:'11111111-1111-4111-8111-111111111111',path:'/agents',password:'secret'}),400]]){
  const out=res();await h(r,out);assert.equal(out.statusCode,status);
 }
});
test('funnel event uses fixed event name, safe session id and quota before forwarding',async()=>{
 const calls=[];const fetcher=async(url,init)=>{calls.push([url,init]);return url===env.UPSTASH_REDIS_REST_URL?{ok:true,json:async()=>({result:1})}:{ok:true}};
 const h=createAgentFunnelHandler({env,fetcher,now:()=>Date.parse('2026-10-30T12:00:00Z')});
 const out=res();await h(req({event:'agent_guide_view',session_id:'11111111-1111-4111-8111-111111111111',path:'/agents',campaign:{utm_source:'agentboard'}}),out);
 assert.equal(out.statusCode,204);assert.equal(calls.length,2);const capture=JSON.parse(calls[1][1].body);
 assert.equal(capture.event,'luo_agent_funnel');assert.equal(capture.properties.step,'agent_guide_view');assert.equal(capture.properties.utm_source,'agentboard');
});

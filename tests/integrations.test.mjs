import test from 'node:test';import assert from 'node:assert/strict';
import {createTelemetryHandler} from '../api/telemetry.js';
import {createHealthHandler} from '../api/health.js';
import {installTelemetry} from '../src/telemetry.js';
import uptime,{checkTargets} from '../integrations/cloudflare/uptime.js';
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}});
const request=()=>({method:'POST',headers:{origin:'https://luo-chat-luokai25.vercel.app','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1'},body:{code:'CLIENT_RUNTIME_ERROR'}});
const env={UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'secret',LUO_TELEMETRY_SALT:'test-only-salt',LUO_POSTHOG_KEY:'test-public-key'};
test('telemetry rejects wrong methods, origins, media types, large and private payloads before network work',async()=>{
 const handler=createTelemetryHandler({env,fetcher:()=>{throw Error('must not call')}});
 for(const [change,status]of [[q=>q.method='GET',405],[q=>q.headers.origin='https://evil.test',403],[q=>q.headers['content-type']='text/plain',415],[q=>q.headers['content-length']='129',413],[q=>q.body={code:'CLIENT_RUNTIME_ERROR',password:'private'},400],[q=>q.body={code:'unexpected'},400],[q=>q.body='invalid',400],[q=>q.body=[],400]]){const q=request(),r=res();change(q);await handler(q,r);assert.equal(r.statusCode,status);}
});
test('telemetry hashes ephemeral rate-limit identities and sends only fixed diagnostic properties',async()=>{
 const calls=[],handler=createTelemetryHandler({env,now:()=>1792710000000,fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({result:1})}}});const r=res();await handler(request(),r);assert.equal(r.statusCode,204);assert.equal(calls.length,2);
 const quota=JSON.parse(calls[0].options.body),event=JSON.parse(calls[1].options.body);
 assert.equal(quota[0],'EVAL');assert.equal(JSON.stringify(quota).includes('192.0.2.1'),false);assert.equal(quota[3].includes('luo:telemetry:ip:'),true);
 assert.deepEqual(Object.keys(event.properties).sort(),['$ip','$process_person_profile','code','distinct_id','release'].sort());assert.equal(event.properties.code,'CLIENT_RUNTIME_ERROR');assert.equal(event.properties.$process_person_profile,false);
});
test('telemetry closes ingestion on quota exhaustion or provider failure without returning secrets',async()=>{
 for(const [result,status]of [[{result:0},429],[{error:'secret'},503]]){let calls=0;const r=res();await createTelemetryHandler({env,logger:{error(){}},fetcher:async()=>{calls++;return{ok:true,json:async()=>result}}})(request(),r);assert.equal(r.statusCode,status);assert.equal(calls,1);assert.equal(JSON.stringify(r.body).includes('secret'),false);}
 const r=res();await createTelemetryHandler({env:{},fetcher:()=>{throw Error()}})(request(),r);assert.equal(r.statusCode,204);
});
test('synthetic integration checks never count as application errors',async()=>{
 const events=[];const q=request();q.body.code='INTEGRATION_SELF_TEST';const r=res();await createTelemetryHandler({env,fetcher:async(url,options)=>{if(url.includes('posthog'))events.push(JSON.parse(options.body));return{ok:true,json:async()=>({result:1})}}})(q,r);assert.equal(r.statusCode,204);assert.equal(events[0].event,'luo_integration_check');
});
test('browser diagnostics ignore private data, obey privacy signals and bound requests',async()=>{
 const listeners={},calls=[];const win={navigator:{},addEventListener:(n,f)=>listeners[n]=f,fetch:async(...args)=>calls.push(args)};installTelemetry(win);
 for(let i=0;i<10;i++){listeners.error({error:new Error('password secret chat text')});listeners.unhandledrejection({reason:'private'});}assert.equal(calls.length,2);assert.equal(calls.map(x=>x[1].body).join('').includes('private'),false);
 for(const navigator of [{globalPrivacyControl:true},{doNotTrack:'1'}]){installTelemetry({...win,navigator,addEventListener:()=>assert.fail('privacy signal ignored')});}
});
test('health endpoint reports dependency failure and never returns provider data',async()=>{
 for(const [ok,status]of [[true,200],[false,503]]){const r=res();await createHealthHandler({fetcher:async()=>({ok,json:()=>assert.fail('must not expose provider response')})})({method:'GET'},r);assert.equal(r.statusCode,status);}
 const r=res();await createHealthHandler()({method:'POST'},r);assert.equal(r.statusCode,405);
});
test('uptime distinguishes wrong HTML, invalid health and network failure',async()=>{
 let result=await checkTargets(async url=>({status:200,text:async()=>'<title>Luo Chat</title><meta name="luo-version">',json:async()=>({status:'ok',checks:{auth:'reachable'}})}));assert.equal(result.status,'up');
 result=await checkTargets(async()=>({status:200,text:async()=>'Login page',json:async()=>({status:'degraded'})}));assert.equal(result.status,'degraded');assert.equal(result.checks.every(x=>x.status==='down'),true);
 result=await checkTargets(async()=>{throw Error('timeout')});assert.equal(result.status,'degraded');assert.equal(result.checks[0].httpStatus,0);
});
test('public uptime serves bounded stored results, rejects writes and marks stale samples unknown',async()=>{
 const sample={checkedAt:new Date().toISOString(),status:'up',checks:[]};const env={STATUS:{get:async()=>[sample]}};
 let r=await uptime.fetch(new Request('https://status.test/status.json'),env);assert.equal(r.status,200);assert.equal((await r.json()).status,'up');
 r=await uptime.fetch(new Request('https://status.test/status.json',{method:'POST'}),env);assert.equal(r.status,405);
 sample.checkedAt='2000-01-01T00:00:00Z';r=await uptime.fetch(new Request('https://status.test/status.json'),env);assert.equal(r.status,503);assert.equal((await r.json()).status,'unknown');
});

import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {validTurnURL,readTurnConfiguration,issueTurnCredentials,TURN_CREDENTIAL_TTL_SECONDS} from '../src/server/turn-credentials.js';
import {createCallConfigHandler} from '../api/call-config.js';
const env={LUO_TURN_URL:'turns:relay.example:5349?transport=tcp',LUO_TURN_SHARED_SECRET:'fixture-shared-secret-at-least-32-characters'};
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}});
const req={method:'GET',headers:{authorization:'Bearer fixture'}};
const clientFactory=()=>({auth:{getUser:async()=>({data:{user:{id:'private-user-id'}}})}});

test('TURN URI validation accepts explicit supported forms and rejects credentials, paths, injections and invalid ports',()=>{
 for(const url of ['turn:relay.example','turn:relay.example:3478?transport=udp','turns:relay.example:5349?transport=tcp','turn:192.0.2.1:3478','turn:[2001:db8::1]:3478?transport=udp'])assert.equal(validTurnURL(url),true,url);
 for(const url of [undefined,[],{},'https://relay.example','turn://relay.example','turn:user:password@relay.example','turn:relay.example/path','turn:relay.example#x','turn:relay.example:0','turn:relay.example:65536','turn:relay.example?transport=quic','turn:relay.example?transport=tcp&x=1','turn:relay.example\n','turn:relay..example','turn:-bad.example','turn:[not-an-ip]','turn:[1:2:3]'])assert.equal(validTurnURL(url),false,String(url));
});

test('no relay configuration stays optional; incomplete, weak and static or mixed configurations fail closed',()=>{
 assert.equal(readTurnConfiguration({}),null);assert.equal(readTurnConfiguration({LUO_TURN_URL:''}),null);assert.deepEqual(readTurnConfiguration(env),{urls:env.LUO_TURN_URL,secret:env.LUO_TURN_SHARED_SECRET});
 for(const value of [{LUO_TURN_URL:env.LUO_TURN_URL},{LUO_TURN_SHARED_SECRET:env.LUO_TURN_SHARED_SECRET},{...env,LUO_TURN_SHARED_SECRET:'weak'},{...env,LUO_TURN_SHARED_SECRET:env.LUO_TURN_SHARED_SECRET+'\n'},{...env,LUO_TURN_USER:'legacy'},{...env,LUO_TURN_PASSWORD:'legacy'},{LUO_TURN_URL:'turn:relay.example',LUO_TURN_USER:'legacy',LUO_TURN_PASSWORD:'legacy'}])assert.throws(()=>readTurnConfiguration(value),/Relay configuration invalid/);
});

test('temporary credentials use epoch-seconds expiry and protocol HMAC, never the shared secret',()=>{
 const config=readTurnConfiguration(env),result=issueTurnCredentials(config,{now:()=>1023,random:()=> 'abcdef0123456789abcdef01'});
 assert.equal(result.expiresAt,3601);assert.equal(TURN_CREDENTIAL_TTL_SECONDS,3600);assert.equal(result.server.username,'3601:abcdef0123456789abcdef01');
 assert.equal(result.server.credential,'vQK0yoXyltUW5aHj5wZy1jAanSw=','Fixed fixture vector: base64 HMAC-SHA1');
 assert.equal(result.server.credential,createHmac('sha1',env.LUO_TURN_SHARED_SECRET).update(result.server.username).digest('base64'));
 assert.doesNotMatch(JSON.stringify(result),/fixture-shared-secret/);assert.equal(result.server.urls,env.LUO_TURN_URL);
});

test('credentials rotate per issuance and invalid clocks or nonce sources cannot produce a usable response',()=>{
 const config=readTurnConfiguration(env),a=issueTurnCredentials(config),b=issueTurnCredentials(config);assert.notEqual(a.server.username,b.server.username);assert.notEqual(a.server.credential,b.server.credential);
 for(const value of [NaN,Infinity,-1,1.25])assert.throws(()=>issueTurnCredentials(config,{now:()=>value}),/Relay clock invalid/);
 for(const value of [null,'','bad:username','a'.repeat(23)])assert.throws(()=>issueTurnCredentials(config,{random:()=>value}),/Relay nonce invalid/);
});

test('API validates auth then quota before issuing expiring config, with no cache or private account ID',async()=>{
 const r=res(),order=[];await createCallConfigHandler({env,now:()=>120000,clientFactory:()=>({auth:{getUser:async()=>{order.push('auth');return{data:{user:{id:'private-user-id'}}}}}}),rateLimit:async o=>{order.push('quota');assert.equal(o.actor,'private-user-id');assert.equal(o.now(),120000);return'allowed'}})(req,r);
 assert.equal(r.code,200);assert.deepEqual(order,['auth','quota']);assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.body.relayConfigured,true);assert.equal(r.body.relayExpiresAt,3720);assert.equal(r.body.iceServers.length,2);
 const turn=r.body.iceServers[1];assert.match(turn.username,/^3720:[a-f0-9]{24}$/);assert.equal(turn.credential,createHmac('sha1',env.LUO_TURN_SHARED_SECRET).update(turn.username).digest('base64'));assert.doesNotMatch(JSON.stringify(r.body),/private-user-id|fixture-shared-secret/);
});

test('invalid and legacy deployment config is unavailable, never silent STUN fallback or a secret-bearing error',async()=>{
 for(const config of [{...env,LUO_TURN_PASSWORD:'private-legacy'},{LUO_TURN_URL:env.LUO_TURN_URL},{...env,LUO_TURN_URL:'https://relay.example'}]){const r=res(),logs=[];await createCallConfigHandler({env:config,clientFactory,rateLimit:()=>assert.fail('invalid config must not consume quota'),logger:{error:code=>logs.push(code)}})(req,r);assert.equal(r.code,503);assert.deepEqual(logs,['LUO_CALL_CONFIG_FAILED']);assert.doesNotMatch(JSON.stringify(r.body),/relay.example|private-legacy|fixture-shared-secret/)}
});

test('STUN-only response does not consume relay quota and token failures cannot mint credentials',async()=>{
 const r=res();await createCallConfigHandler({env:{},clientFactory,rateLimit:()=>assert.fail('STUN requires no credentials')})(req,r);assert.equal(r.code,200);assert.equal(r.body.relayConfigured,false);assert.equal(r.body.relayExpiresAt,null);assert.equal(r.body.iceServers.length,1);
 for(const result of [{data:{user:{}}},{data:{user:null}},{error:{status:401}}]){const denied=res();await createCallConfigHandler({env,clientFactory:()=>({auth:{getUser:async()=>result}}),rateLimit:()=>assert.fail('must authenticate')})(req,denied);assert.equal(denied.code,401)}
});

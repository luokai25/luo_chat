import test from 'node:test';import assert from 'node:assert/strict';import {createInspectionStore} from '../src/server/inspection-store.js';
const origin='https://backend.example',path='owner/entry/clip.mp4';
function setup(target=origin+'/storage/v1/object/sign/luo-social/'+path+'?token=private-signed-token'){
 const rpc=[],fetches=[];
 const db={
  rpc:(name,args)=>{rpc.push({name,args});return Promise.resolve({data:{version:'v1'}})},
  storage:{from:bucket=>{
   assert.equal(bucket,'luo-social');
   return{createSignedUrl:async(p,ttl)=>{assert.equal(p,path);assert.equal(ttl,60);return{data:{signedUrl:target}}}};
  }}
 };
 return{rpc,fetches,store:createInspectionStore(db,{projectOrigin:origin,fetcher:async(url,options)=>{fetches.push({url,options});return new Response('fixture')}})};
}
test('worker adapter uses dedicated metadata/receipt RPCs and a short project-scoped signed download',async()=>{const t=setup();await t.store.lookup(path);await t.store.download(path);await t.store.record({path,objectId:'id',objectVersion:'v1',sha256:'a'.repeat(64),byteSize:3,duration:.4,width:64,height:96,mimeType:'video/mp4',policy:'luo-reel-v1'});assert.deepEqual(t.rpc.map(x=>x.name),['get_luo_clip_inspection_source','record_luo_clip_inspection']);assert.equal(t.rpc[1].args.byte_size,3);const options=t.fetches[0].options;assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.ok(!options.headers,'Never attach service credentials to a signed media request')});
test('signed download redirects, credentials, foreign origins and mismatched object paths cannot initiate fetches',async()=>{for(const url of ['https://evil.example/file','http://backend.example/file','https://user:password@backend.example/storage/v1/object/sign/luo-social/'+path,origin+'/storage/v1/object/sign/luo-social/other','file:///etc/passwd']){const t=setup(url);await assert.rejects(t.store.download(path),/Unexpected media download target/);assert.equal(t.fetches.length,0)}});

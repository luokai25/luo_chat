import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import statusHandler from '../workspace/api/status.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','workspace');
const read=async file=>readFile(resolve(root,file),'utf8');
test('Luo Workspace is an independently deployable noindex dashboard with six useful sections',async()=>{
 const [html,cfg]=await Promise.all([read('index.html'),read('vercel.json')]);
 for(const name of ['overview','users','activity','engineering','billing','integrations'])assert.match(html,new RegExp('data-page="'+name+'"'));
 assert.match(html,/<form id="login-form">/);
 assert.match(html,/noindex,nofollow/);
 assert.match(cfg,/frame-ancestors 'none'/);
 assert.match(cfg,/X-Robots-Tag/);
 assert.ok(!html.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(!html.includes('LUO_PAYPAL_LIVE_CLIENT_SECRET'));
});
test('Owner-only database RPC always requires an authenticated whitelisted owner and blocks anonymous access',async()=>{
 const sql=await read('luo-workspace-owner-only.sql');
 assert.match(sql,/auth\.uid\(\) IS NULL OR NOT EXISTS/);
 assert.match(sql,/luo_workspace\.admin_users/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.luo_workspace_snapshot\(\) FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.luo_workspace_snapshot\(\) TO authenticated/);
 assert.ok(!sql.includes('luok29365@gmail.com'),'Owner email never committed in public SQL');
});
test('Browser obtains private metrics only through owner-authorized RPC, never via service credentials',async()=>{
 const app=await read('app.js');
 assert.match(app,/db\.rpc\('luo_workspace_snapshot'\)/);
 assert.match(app,/db\.auth\.signInWithPassword/);
 assert.ok(!app.includes('service_role'),'No privileged service role in browser');
 assert.ok(!app.includes('eval('));
});
function mockRes(){return {statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},status(v){this.statusCode=v;return this},json(v){this.body=v;return this}}}
test('Public health proxy only returns project status and never leaks account data',async()=>{
 const old=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init={})=>{
  calls.push({url,method:init.method||'GET'});
  if(url.includes('api.github.com'))return{ok:true,json:async()=>({workflow_runs:[{id:100,name:'Web check',status:'completed',conclusion:'success',html_url:'https://github.com/workflow',head_branch:'main',created_at:'2026-10-25T15:00:00Z',head_sha:'abc'}]})};
  if(url.endsWith('/api/health'))return{ok:true,json:async()=>({status:'ok',checks:{auth:'reachable'}})};
  if(url.endsWith('/api/v1/plans'))return{ok:true,json:async()=>({billing_enabled:false,plans:[]})};
  return{ok:true,status:200,json:async()=>({})};
 };
 try{
  let r=mockRes();await statusHandler({method:'GET'},r);
  assert.equal(r.statusCode,200);
  assert.equal(r.body.runs.length,1);
  assert.equal(r.body.site.status,200);
  assert.equal(r.body.health.status,'ok');
  assert.equal(r.body.plans.billing_enabled,false);
  assert.equal(JSON.stringify(r.body).includes('email'),false);
  assert.equal(JSON.stringify(r.body).includes('secret'),false);
  assert.equal(calls.length,4);
  r=mockRes();await statusHandler({method:'POST'},r);
  assert.equal(r.statusCode,405);
 }finally{globalThis.fetch=old}
});

import test from 'node:test';import assert from 'node:assert/strict';
import {validatePublicConfig} from '../scripts/public-config.mjs';
const url='https://example.supabase.co',key='sb_publishable_test_only';
const csp="default-src 'self'; connect-src 'self' https://example.supabase.co wss://example.supabase.co; img-src 'self' https://example.supabase.co; media-src 'self' https://example.supabase.co; frame-src https://example.supabase.co";
const jwt=role=>'test.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.test';
test('publishable and legacy anon build keys accept matching project policies',()=>{for(const candidate of [key,jwt('anon')])assert.equal(validatePublicConfig({url,key:candidate,csp}).origin,url)});
test('secret, service-role and user-session keys are rejected without echoing their values',()=>{for(const candidate of ['sb_secret_test_only',jwt('service_role'),jwt('authenticated'),'malformed-private-value']){assert.throws(()=>validatePublicConfig({url,key:candidate,csp}),error=>/Browser builds require/.test(error.message)&&!error.message.includes(candidate))}});
test('project switches must update both HTTPS and realtime security-policy origins',()=>{assert.throws(()=>validatePublicConfig({url:'https://other.supabase.co',key,csp}),/do not match/);assert.throws(()=>validatePublicConfig({url,key,csp:csp.replace('wss://example.supabase.co','')}),/do not match/)});
test('backend URL credentials, plaintext transport and appended routes cannot enter a release',()=>{for(const candidate of ['http://example.supabase.co','https://name:private@example.supabase.co','https://example.supabase.co/rest/v1','https://example.supabase.co/?token=test','not a URL'])assert.throws(()=>validatePublicConfig({url:candidate,key,csp}))});
test('missing, duplicate or incomplete media security policies fail closed',()=>{for(const policy of [undefined,csp+'; connect-src https://other.example',csp.replace('frame-src https://example.supabase.co','')])assert.throws(()=>validatePublicConfig({url,key,csp:policy}))});

// Exercise the actual build entrypoint: validation must run before dist is replaced.
import {spawnSync} from 'node:child_process';import {readFile,mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
for(const [name,overrides,expected] of [
 ['privileged browser key',{LUO_SUPABASE_KEY:'sb_secret_test_only'},/Browser builds require/],
 ['backend and CSP mismatch',{LUO_SUPABASE_KEY:key,LUO_SUPABASE_URL:'https://other.supabase.co'},/do not match/]
])test('build rejects '+name+' before replacing prior assets',async()=>{const cwd=await mkdtemp(join(tmpdir(),'luo-config-validation-'));try{await copyFile('vercel.json',join(cwd,'vercel.json'));await mkdir(join(cwd,'dist'));const before=Buffer.from('previous production assets');await writeFile(join(cwd,'dist/index.html'),before);const result=spawnSync(process.execPath,[resolve('build.mjs')],{cwd,encoding:'utf8',env:{...process.env,...overrides}});assert.notEqual(result.status,0);assert.match(result.stderr,expected);assert.equal(result.stderr.includes(overrides.LUO_SUPABASE_KEY),false);const after=await readFile(join(cwd,'dist/index.html'));assert.deepEqual(after,before)}finally{await rm(cwd,{recursive:true,force:true})}});

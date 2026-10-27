// Unit tests use explicit fixtures. Hosted build credentials must never be
// inherited by handlers whose default environment is process.env.
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const env={...process.env};
for(const key of Object.keys(env))if(/^(LUO_|SUPABASE_|VERCEL|STRIPE_|PAYPAL_)/.test(key))delete env[key];
const files=readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).sort().map(f=>'tests/'+f);
const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...files],{env,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('recommendation data store enforces private RLS and tightly scoped RPC access',async()=>{
 const sql=await readFile('supabase/migrations/20261026183824_luo_for_you_private_recommendation_context.sql','utf8');
 for(const word of ['luo_recommend.feedback','luo_recommend.served','luo_recommend.quotas']){
  assert.ok(sql.includes(word));}
 assert.match(sql,/enable row level security/gi);
 assert.match(sql,/from public,anon,authenticated/);
 assert.match(sql,/to authenticated/);
 assert.doesNotMatch(sql,/grant (select|insert|delete|update|all) on luo_recommend\./i);
});
test('staging replay includes supplemental impression-write abuse cap',async()=>{
 const sql=await readFile('supabase/migrations/20261026184344_luo_for_you_per_user_abuse_hardening.sql','utf8');
 assert.match(sql,/array_length\(p_ids,1\)/);
 assert.match(sql,/quotas\.uses<60/);
 assert.match(sql,/served_at<now\(\)-interval '7 days'/);
});

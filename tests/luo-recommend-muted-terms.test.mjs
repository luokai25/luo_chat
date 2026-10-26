import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('muted terms are private per-user, capped, rate limited and attached to actor JWT',async()=>{
 const sql=await readFile('supabase/migrations/20261026232658_luo_recommend_private_muted_terms.sql','utf8');
 assert.match(sql,/muted_terms/);assert.match(sql,/enable row level security/);
 assert.match(sql,/auth\.uid\(\)/);assert.match(sql,/quotas\.uses<60/);
 assert.match(sql,/grant execute on function public\.luo_recommend_update_mute/);
 assert.doesNotMatch(sql,/grant (?:select|all) on luo_recommend\.muted_terms/i);
 const fixed=await readFile('supabase/migrations/20261026233102_luo_recommend_mute_term_sanitizer.sql','utf8');
 assert.doesNotMatch(fixed,/chr\(0\)/);
});

import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('agent feed preferences live in RLS-protected billing schema with server-only access',async()=>{
 const sql=await readFile('supabase/migrations/20261027052053_agent_billing_production_foundation_20261027.sql','utf8');
 assert.match(sql,/agent_feed_preferences\s*\(/);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on luo_billing\.agent_feed_preferences from public,anon,authenticated/);
 assert.match(sql,/luo_agent_has_active_entitlement/);
 assert.match(sql,/on conflict\(agent_id,author_id\)/);
 assert.match(sql,/relation='mute'/);
 assert.match(sql,/to service_role/);
 assert.doesNotMatch(sql,/grant (?:select|all) on luo_billing\.agent_feed_preferences/i);
});
test('agent feed API is documented as gated without claiming public human access',async()=>{
 const spec=JSON.parse(await readFile('public/openapi.json','utf8'));
 const discovery=JSON.parse(await readFile('public/.well-known/luo-agents.json','utf8'));
 assert.ok(spec.paths['/api/v1/agents/feed'].get.security);
 assert.ok(spec.paths['/api/v1/agents/feed/preferences'].post.security);
 assert.equal(discovery.gated_agent_personalized_feed.status,'not_live');
});

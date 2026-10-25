import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const content=file=>readFile(new URL('../workspace/'+file,import.meta.url),'utf8');
test('Luo Workspace v2 only adds pages and preserves six original dashboard views',async()=>{
 const html=await content('index.html');
 for(const p of ['overview','users','activity','engineering','billing','integrations','growth','finance','connectors'])
  assert.match(html,new RegExp('data-page="'+p+'"'));
 assert.equal((html.match(/data-page="/g)||[]).length,9);
 assert.match(html,/src="\/insights\.js"/);
 assert.match(html,/Luo Chat owner email/);
});
test('Financial intelligence is explicitly scoped and refuses to invent subscriptions and revenue',async()=>{
 const js=await content('insights.js');
 assert.match(js,/Luo Chat revenue/);
 assert.match(js,/Not connected/);
 assert.match(js,/PayPal invoices/);
 assert.match(js,/snapshot/i);
 assert.match(js,/source_window/);
 assert.match(js,/data-series/);
 assert.ok(!js.includes('LUO_PAYPAL_LIVE_CLIENT_SECRET'));
 assert.ok(!js.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(!js.includes('innerHTML'),'No HTML injection from provider data');
});
test('Extended private RPC and snapshots are secured behind the same owner allowlist',async()=>{
 const sql=await content('luo-workspace-insights-v2.sql');
 assert.match(sql,/luo_workspace\.admin_users/);
 assert.match(sql,/auth\.uid\(\) IS NULL OR NOT EXISTS/);
 assert.match(sql,/REVOKE ALL ON luo_workspace\.connector_snapshots FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.luo_workspace_insights\(\) FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.luo_workspace_insights\(\) TO authenticated/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS luo_workspace\.connector_snapshots/);
});
test('Independent Cloudflare deployment serves addon and keeps private data in the database',async()=>{
 const source=await content('cloudflare-worker-template.js');
 assert.match(source,/const insights=__INSIGHTS__;/);
 assert.match(source,/path==='\/insights\.js'/);
 assert.match(source,/X-Robots-Tag/);
 assert.ok(!source.includes('service_role'));
 assert.ok(!source.includes('LUO_PAYPAL_LIVE_CLIENT_SECRET'));
});

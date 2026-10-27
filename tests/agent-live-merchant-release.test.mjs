import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('agent live payment launch requires read-only merchant checks and staging isolation',async()=>{
 const build=await readFile('build.mjs','utf8');
 const script=await readFile('scripts/check-agent-live-paypal.mjs','utf8');
 assert.match(build,/release\/agent-api-20261027/);
 assert.match(build,/LUO_AGENT_LIVE_PREFLIGHT_REQUIRED/);
 assert.match(script,/verifyLivePayPalPlans/);
 assert.match(script,/verifyLivePayPalWebhook/);
 assert.match(script,/PAYPAL_LIVE_PREFLIGHT_NOT_READY/);
});

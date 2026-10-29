import test from 'node:test';
import assert from 'node:assert/strict';
import {assertWorkspaceRelease} from '../src/server/workspace-controls.js';

const flags={registration:true,checkout:true,paid_api:true,posts:true,chat:true};
const baseEnv={
 VERCEL_ENV:'production',
 VERCEL_GIT_COMMIT_SHA:'b'.repeat(40),
 VERCEL_GIT_COMMIT_REF:'release/payments-secondary-complete-20261027',
 LUO_WORKSPACE_CONTROLS_ENABLED:'true',
 LUO_AGENT_PRODUCTION_ENABLED:'true',
 LUO_AGENT_PRODUCTION_DATABASE_READY:'true',
 LUO_AGENT_LIVE_SECRET_ROTATED:'true',
 SUPABASE_URL:'https://byjixqwpjvsgmqilmzbm.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(40),
 SUPABASE_PUBLISHABLE_KEY:'p'.repeat(30)
};
function fetchControls(overrides={}) {
 const body={flags,deployment_hold:false,approved_commit:'a'.repeat(40),approved_branch:'old-branch',not_before:'2000-01-01T00:00:00.000Z',...overrides};
 return async()=>({ok:true,json:async()=>body});
}
test('production deploy does not require a per-commit approval by default',async()=>{
 await assert.doesNotReject(assertWorkspaceRelease({...baseEnv},fetchControls()));
});
test('explicit per-commit approval mode still validates branch, commit, and not-before',async()=>{
 await assert.rejects(assertWorkspaceRelease({...baseEnv,LUO_WORKSPACE_RELEASE_APPROVAL_REQUIRED:'true'},fetchControls()),/WORKSPACE_RELEASE_APPROVAL_MISMATCH/);
 await assert.doesNotReject(assertWorkspaceRelease({...baseEnv,LUO_WORKSPACE_RELEASE_APPROVAL_REQUIRED:'true',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_GIT_COMMIT_REF:'old-branch'},fetchControls()));
 await assert.rejects(assertWorkspaceRelease({...baseEnv,LUO_WORKSPACE_RELEASE_APPROVAL_REQUIRED:'true',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_GIT_COMMIT_REF:'old-branch'},fetchControls({not_before:'2999-01-01T00:00:00.000Z'})),/WORKSPACE_RELEASE_NOT_BEFORE/);
});
test('workspace emergency deployment hold still blocks production deploys',async()=>{
 await assert.rejects(assertWorkspaceRelease({...baseEnv},fetchControls({deployment_hold:true})),/WORKSPACE_RELEASE_ON_HOLD/);
});

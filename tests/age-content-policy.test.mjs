import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ageBand, INDEPENDENT_ACCOUNT_MINIMUM_AGE, MANDATORY_SAFE_MODE_BELOW,
 MINOR_AGE_BELOW, safetyTierForAge, signupReadiness, mayShowRatedContent
} from '../src/age-policy.js';
const now=new Date('2026-10-26T12:00:00Z');

test('accurate age tiers including 13 and 17 birthdays, leap years and invalid dates',()=>{
 assert.equal(INDEPENDENT_ACCOUNT_MINIMUM_AGE,13);
 assert.equal(MANDATORY_SAFE_MODE_BELOW,15);
 assert.equal(MINOR_AGE_BELOW,18);
 for(const [birthday,want] of [
  ['2013-10-26','13-14'],['2013-10-27','under13'],
  ['2011-10-26','15-17'],['2011-10-27','13-14'],
  ['2008-10-26','18+'],['2008-10-27','15-17'],
  ['2014-10-26','under13'],['2000-02-29','18+'],
  ['2015-02-29','invalid'],['2030-01-01','invalid'],
  ['invalid','invalid'],['2026-13-01','invalid'],
  ['1800-01-01','invalid'],['2026-10-27','invalid']
 ])assert.equal(ageBand(birthday,now),want,birthday);
});
test('age tier for unknown or under-13 never grants adult access',()=>{
 assert.equal(safetyTierForAge('invalid'),'junior');
 assert.equal(safetyTierForAge('under13'),'junior');
 assert.equal(safetyTierForAge('13-14'),'junior');
 assert.equal(safetyTierForAge('15-17'),'teen');
 assert.equal(safetyTierForAge('18+'),'adult');
});
test('young viewers can see only reviewed general; teens can see reviewed teen; adults see permitted content',()=>{
 const cases=[
  ['under13',['general']],
  ['13-14',['general']],
  ['15-17',['general','teen']],
  ['18+',['general','teen','mature','unreviewed']],
  ['unknown',['general']]
 ];
 for(const [tier,allowed] of cases)for(const rating of ['general','teen','mature','unreviewed']){
  assert.equal(mayShowRatedContent(tier,rating),allowed.includes(rating),tier+'/'+rating);
 }
 assert.equal(mayShowRatedContent('15-17','general',{reviewed:false}),false);
 assert.equal(mayShowRatedContent('13-14','unreviewed'),false);
 assert.equal(mayShowRatedContent('18+','mature'),true);
 assert.equal(mayShowRatedContent('18+','completely_invented_label'),false);
});
test('independent under-13 accounts are never permitted in Egypt; young teen accounts await mandatory safeguards',()=>{
 assert.deepEqual(signupReadiness('under13',{ageAssured:true,safeModeEnforced:true}),{permitted:false,code:'INDEPENDENT_ACCOUNT_UNAVAILABLE'});
 assert.deepEqual(signupReadiness('13-14'),{permitted:false,code:'PROTECTIONS_NOT_READY'});
 assert.deepEqual(signupReadiness('15-17'),{permitted:false,code:'PROTECTIONS_NOT_READY'});
 assert.equal(signupReadiness('13-14',{ageAssured:true,safeModeEnforced:true}).permitted,true);
 assert.equal(signupReadiness('15-17',{ageAssured:true,teenProtectionsEnforced:true}).permitted,true);
 assert.equal(signupReadiness('15-17',{ageAssured:false,teenProtectionsEnforced:true}).permitted,false);
 assert.equal(signupReadiness('18+').permitted,true);
});
test('server visibility blueprint is disabled until verified age assurance and content reviews are integrated',async()=>{
 const {readFile}=await import('node:fs/promises');
 const sql=await readFile('supabase/migrations/20261026185000_age_safety_tiers_foundation.sql','utf8');
 assert.match(sql,/enabled boolean not null default false/);
 assert.match(sql,/luo_internal\.age_content_allowed\(e,actor\)/);
 assert.match(sql,/not luo_internal\.space_blocked\(actor,e\.owner_id\)/);
 assert.match(sql,/entry\.kind not in\('post','clip'\)/);
 assert.match(sql,/rating='unreviewed'/);
 assert.match(sql,/RLS|row level security/i);
 assert.match(sql,/revoke all on luo_internal\.age_safety_accounts from anon, authenticated, public/);
 assert.match(sql,/grant execute on function public\.luo_my_age_safety\(\) to authenticated,service_role/);
});
test('signup UI no longer exposes a pretend guardian approval code and explicitly stops underage independent registration',async()=>{
 const {readFile}=await import('node:fs/promises');
 const app=await readFile('src/app.js','utf8');
 const page=await readFile('public/index.html','utf8');
 assert.match(page,/<input id="guardianApproval" type="hidden"/);
 assert.doesNotMatch(page,/Guardian approval code \(ages 12/);
 assert.match(app,/signupAge==='under13'/);
 assert.match(app,/signupAge==='13-14'/);
 assert.match(app,/signupAge==='15-17'/);
 assert.match(app,/signupAge==='18\+'/);
 assert.doesNotMatch(app,/guardian_approval:signupAge/);
});

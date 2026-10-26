import test from 'node:test';
import assert from 'node:assert/strict';
import {ageBand,INDEPENDENT_ACCOUNT_MINIMUM_AGE,MANDATORY_SAFE_MODE_BELOW,MINOR_AGE_BELOW} from '../src/age-policy.js';
test('age categories match the under-13 independent-account rule and teenage safety tiers',()=>{
 assert.equal(INDEPENDENT_ACCOUNT_MINIMUM_AGE,13);
 assert.equal(MANDATORY_SAFE_MODE_BELOW,15);
 assert.equal(MINOR_AGE_BELOW,18);
 const today=new Date('2026-10-25T12:00:00Z');
 for(const [birthday,expected] of [
  ['2014-10-25','under13'],['2013-10-25','13-14'],
  ['2013-10-26','under13'],['2011-10-25','15-17'],
  ['2011-10-26','13-14'],['2008-10-25','18+'],
  ['2008-10-26','15-17'],['2000-02-29','18+'],
  ['2015-02-29','invalid'],['2999-01-01','invalid'],
  ['not a date','invalid'],['2026-13-01','invalid']
 ])assert.equal(ageBand(birthday,today),expected,birthday);
});
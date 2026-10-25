import test from 'node:test';
import assert from 'node:assert/strict';
import {ageBand,MINIMUM_AGE,GUARDIAN_APPROVAL_BELOW} from '../src/age-policy.js';
test('minimum signup age is 12 and guardian verification applies below 18',()=>{
 assert.equal(MINIMUM_AGE,12);assert.equal(GUARDIAN_APPROVAL_BELOW,18);
 const today=new Date('2026-10-25T12:00:00Z');
 for(const [birthday,expected] of [
  ['2014-10-25','12-17'],['2014-10-26','under12'],
  ['2008-10-25','18+'],['2008-10-26','12-17'],
  ['2000-02-29','18+'],['2015-02-29','invalid'],
  ['2999-01-01','invalid'],['not a date','invalid'],['2026-13-01','invalid'],
  ['2026-10-26','invalid']
 ])assert.equal(ageBand(birthday,today),expected,birthday);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const exp=await readFile('src/experience.js','utf8');
const sk=await readFile('public/luo-skeleton-v4.js','utf8');
test('real shared-media fetching owns skeleton token, and only first page blanks the view',()=>{
 assert.match(exp,/if\(reset\)\{sharedList\.dataset\.luoLoadingToken=String\(generation\)/);
 assert.match(exp,/Loading shared media…/);
 assert.match(exp,/const r=await db\.from\(table\)/);
 assert.match(exp,/if\(sharedList\.dataset\.luoLoadingToken===String\(generation\)\)delete/);
 assert.match(exp,/sharedGeneration\+\+;loading=false;delete sharedList\.dataset\.luoLoadingToken/);
 assert.match(sk,/\.media-card,\.shared-item/);
});

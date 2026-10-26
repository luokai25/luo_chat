import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const ws=await readFile('src/workspace.js','utf8');
const skeleton=await readFile('public/luo-skeleton-v4.js','utf8');
test('search loading states are tied to actual RPC activity rather than fake shimmer',()=>{
 assert.match(ws,/const args=parseSearch\(\$\('globalSearchInput'\)\.value\);\s*results\.dataset\.luoLoadingToken=String\(seq\)/);
 assert.match(ws,/results\.textContent='Searching messages…';/);
 assert.match(ws,/const rows=await rpc\('search_chat_everything',args\)/);
 assert.match(ws,/if\(results\.dataset\.luoLoadingToken===String\(seq\)\)delete results\.dataset\.luoLoadingToken/);
 assert.match(ws,/function cancelSearch\(\)\{searchRequest\+\+;delete \$\('globalSearchResults'\)\.dataset\.luoLoadingToken/);
 assert.match(skeleton,/dataset\.luoLoadingToken!==undefined/);
});

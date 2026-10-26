import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const index=await readFile('public/index.html','utf8');
const micro=await readFile('public/luo-micro-polish.css','utf8');
test('secondary screen design unifies 44px targets, keyboard focus and anti-overflow rules',()=>{
 assert.match(index,/href="\/luo-micro-polish\.css"/);
 assert.match(micro,/--luo-micro-tap:44px/);
 assert.match(micro,/:focus-visible/);
 assert.match(micro,/overscroll-behavior:contain/);
 assert.match(micro,/env\(safe-area-inset-bottom/);
});
test('micro-polish does not add fake business state or override motion preferences',()=>{
 assert.match(micro,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(micro,/@media\(prefers-contrast:more\)/);
 assert.doesNotMatch(micro,/display:none!important.*personDialog/);
});

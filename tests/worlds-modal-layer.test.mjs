import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Worlds modal is in body top stacking context, outside mobile navigation stacking layers',async()=>{
 const js=await readFile('src/worlds.js','utf8');
 assert.match(js,/shade\.append\(panel\);doc\.body\.append\(shade\);modal=shade/);
 assert.match(js,/function closeModal\(\)\{modal\?\.remove\(\);modal=null\}/);
 assert.match(js,/signedOut\(\)\{[^}]*closeModal\(\)/);
 const css=await readFile('public/luo-deep-pages-v3.css','utf8');
 assert.match(css,/\.worlds-modal-backdrop/);
});

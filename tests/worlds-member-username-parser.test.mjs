import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('Worlds group member parser splits on newlines, not letter n in usernames',async()=>{
 const source=await readFile('src/worlds.js','utf8');
 assert.ok(source.includes('v.members.split(/[\\n,;]+/)'),'Group usernames must support newline/comma/semicolon delimiters');
 assert.ok(!source.includes('v.members.split(/[\\\\n,;]+/)'),'Must not treat the literal letter n as delimiter');
 const usernames='qa_friend,another_name'.split(/[\n,;]+/).map(x=>x.trim());
 assert.deepEqual(usernames,['qa_friend','another_name']);
});

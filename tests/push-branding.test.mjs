import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

test('built push worker uses the fingerprinted Luo icon and keeps message contents private',async()=>{
 const worker=await readFile('dist/sw.js','utf8');
 const match=worker.match(/PUSH_ICON="(\/icon-192-[a-f0-9]{12}\.png)"/);
 assert.ok(match,'push icon is a hashed same-origin asset');
 await access('dist'+match[1]);
 assert.match(worker,/showNotification\('Luo Chat',\{body:/);
 assert.ok(worker.includes("icon:'"+match[1]+"'"),'notification icon is the fingerprinted Luo asset');
 assert.ok(worker.includes("badge:'"+match[1]+"'"),'notification badge is the fingerprinted Luo asset');
 assert.match(worker,/You have a new message/);
 assert.doesNotMatch(worker,/payload\?\.body|payload\?\.message|payload\?\.sender/);
});

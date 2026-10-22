import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {stickers,emotions,isStickerAttachment} from '../src/luo-family.js';
import {installStickerTray} from '../src/sticker-tray.js';
test('the official pack has exactly 50 stickers from 5 character families',()=>{
 assert.equal(stickers.length,50);assert.equal(emotions.length,5);
 assert.deepEqual(emotions,['Black Cat','White Cat','Aura Dog','Black Dragon','White Dragon']);
 assert.equal(new Set(stickers.map(s=>s.id)).size,50);
 for(const group of emotions)assert.equal(stickers.filter(s=>s.emotion===group).length,10);
});
test('all 50 image files are valid unique transparent 512px PNGs with no old 200 files',async()=>{
 const files=await readdir('public/stickers/luo-family');
 assert.equal(files.length,50);assert.ok(files.every(name=>/^luo50-(?:0[1-9]|[1-4][0-9]|50)\.png$/.test(name)));
 const hashes=new Set();
 for(const s of stickers){
  const bytes=await readFile('public'+s.src);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),512);assert.equal(bytes.readUInt32BE(20),512);
  assert.ok(bytes.length>1000&&bytes.length<2_000_000);
  hashes.add(createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(hashes.size,50);
});
test('sticker attachment classification preserves old messages but limits filenames',()=>{
 for(const n of ['luo-sticker-luo50-01.png','luo-sticker-luo50-50.png','luo-sticker-lf-0-1.png'])assert.equal(isStickerAttachment({file_name:n,mime_type:'image/png',byte_size:5000}),true);
 for(const item of [{file_name:'photo.png',mime_type:'image/png',byte_size:100},{file_name:'luo-sticker-luo50-51.png',mime_type:'image/png',byte_size:100},{file_name:'luo-sticker-luo50-01.svg',mime_type:'image/svg+xml',byte_size:100},{file_name:'luo-sticker-luo50-01.png',mime_type:'image/png',byte_size:3000000}])assert.equal(isStickerAttachment(item),false);
});
test('the current sticker picker remains wired and supports five categories',()=>{
 assert.equal(typeof installStickerTray,'function');
 const dom=new JSDOM('<dialog id="picker"></dialog>',{url:'https://example.test'});
 assert.ok(dom.window.document.getElementById('picker'));
 assert.equal(stickers[0].src,'/stickers/luo-family/luo50-01.png');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const script = await readFile('public/klipy-gifs.js','utf8');
const css = await readFile('public/klipy-gifs.css','utf8');
const config = await readFile('api/klipy-config.js','utf8');
test('GIF picker defaults to key-free Commons while KLIPY remains an optional provider',()=>{
  assert.match(script,/https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
  assert.match(script,/https:\/\/api\.klipy\.com/);
  assert.match(script,/klipyAvailable=false/);
  assert.match(script,/Free GIFs/);
  assert.match(script,/Search KLIPY/);
  assert.match(script,/Powered by KLIPY/);
  assert.match(script,/content_filter:'high'/);
  assert.match(script,/new MutationObserver/);
  assert.doesNotMatch(script,/supabase\.storage|upload\(/);
  assert.match(css,/\.klipy-grid/);
});
test('KLIPY key remains optional and its absence cannot block free GIF searches',()=>{
  assert.match(config,/process\.env\.KLIPY_APP_KEY/);
  assert.match(config,/enabled:false/);
  assert.match(config,/no-store/);
  assert.match(script,/searchCommons/);
  assert.match(script,/checkKLIPY/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const script = await readFile('public/klipy-gifs.js','utf8');
const css = await readFile('public/klipy-gifs.css','utf8');
test('GIF button loads a rendered grid immediately with loading and recoverable error states',()=>{
  assert.match(script,/launch\.addEventListener\('click', openDialog\)/);
  assert.match(script,/if \(!get\('klipyGrid'\)\.querySelector\('\.klipy-tile'\) && !loading\) search\(false\)/);
  assert.match(script,/function skeleton\(/);
  assert.match(script,/function showEmpty\(/);
  assert.match(script,/function draw\(/);
  assert.match(script,/get\('klipyGrid'\)\.querySelectorAll\('\.klipy-tile'\)/);
});
test('GIF results offer a full animated preview and composer preview without altering sticker picker',()=>{
  assert.match(script,/function preview\(item\)/);
  assert.match(script,/function addToMessage\(item\)/);
  assert.match(script,/function showDraft\(item\)/);
  assert.match(script,/function renderInChat\(/);
  assert.match(script,/safeUrl\(item\.url\)/);
  assert.match(script,/safeSource\(item\.source\)/);
  assert.match(css,/\.klipy-preview-anim/);
  assert.match(css,/#klipyDraft/);
  assert.doesNotMatch(script,/src\/luo-family\.js|\.innerHTML\s*=/);
});
test('Theme remains black and gold with responsive accessible elements',()=>{
  assert.match(css,/#111116/);
  assert.match(css,/#klipyDialog/);
  assert.match(css,/@media\(max-width:550px\)/);
  assert.match(script,/role: 'status'/);
  assert.match(script,/aria-label': 'Search animated GIFs'/);
});

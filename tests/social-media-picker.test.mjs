import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountSocialMediaPicker} from '../src/social-media-picker.js';
function setup(kind='photos'){
 const dom=new JSDOM('<input type="file" multiple><div id="host"></div>',{pretendToBeVisual:true}),w=dom.window,d=w.document,input=d.querySelector('input'),created=[],revoked=[];let serial=0;
 w.URL.createObjectURL=file=>{const url='blob:preview-'+(++serial);created.push({file,url});return url};w.URL.revokeObjectURL=url=>revoked.push(url);w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};
 const picker=mountSocialMediaPicker({win:w,input,host:d.getElementById('host'),kind});
 const choose=files=>{Object.defineProperty(input,'files',{configurable:true,value:files});input.dispatchEvent(new w.Event('change'))};
 return {w,d,input,picker,created,revoked,choose,file:(name='photo.png',type='image/png')=>new w.File(['local bytes'],name,{type}),close:()=>{picker.dispose();w.close()}};
}
test('local photo previews can be removed before publish and release all object URLs',()=>{
 const h=setup();try{const a=h.file('one.png'),b=h.file('two.webp','image/webp');h.choose([a,b]);assert.equal(h.d.querySelectorAll('img').length,2);assert.deepEqual(h.picker.getFiles(),[a,b]);h.d.querySelector('[aria-label="Remove photo 2"]').click();assert.deepEqual(h.picker.getFiles(),[a]);assert.equal(h.revoked.length,2);h.picker.dispose();assert.equal(h.revoked.length,h.created.length);assert.equal(h.d.querySelector('.luo-media-picker'),null)}finally{h.close()}
});
test('invalid or excessive photo files never produce previews or object URLs',()=>{
 const h=setup();try{h.choose([h.file('unsafe.svg','image/svg+xml')]);assert.equal(h.created.length,0);assert.ok(h.d.querySelector('.is-error'));const files=[h.file('a.png'),h.file('b.png'),h.file('c.png')];for(const f of files)Object.defineProperty(f,'size',{value:8*1024*1024});h.choose(files);assert.equal(h.created.length,0);assert.match(h.d.querySelector('[role=status]').textContent,/20 MB total/)}finally{h.close()}
});
test('video preview shows duration and flags a clip longer than 90 seconds',()=>{
 const h=setup('video');try{h.choose([h.file('clip.webm','video/webm')]);const video=h.d.querySelector('video');assert.ok(video.controls);assert.equal(video.muted,true);Object.defineProperty(video,'duration',{configurable:true,value:46.2});video.dispatchEvent(new h.w.Event('loadedmetadata'));assert.match(h.d.querySelector('[role=status]').textContent,/47 sec/);Object.defineProperty(video,'duration',{value:95});video.dispatchEvent(new h.w.Event('loadedmetadata'));assert.match(h.d.querySelector('[role=status]').textContent,/1 and 90 seconds/);assert.ok(h.d.querySelector('.is-error'))}finally{h.close()}
});
test('switching files and closing the composer ignores old metadata callbacks',()=>{
 const h=setup('video');try{h.choose([h.file('old.webm','video/webm')]);const video=h.d.querySelector('video'),stale=video.onloadedmetadata;h.choose([h.file('new.mp4','video/mp4')]);const before=h.d.querySelector('[role=status]').textContent;stale();assert.equal(h.d.querySelector('[role=status]').textContent,before);h.picker.dispose();stale();assert.equal(video.hasAttribute('src'),false);assert.equal(h.revoked.length,h.created.length);const count=h.created.length;h.choose([h.file()]);assert.equal(h.created.length,count)}finally{h.close()}
});
test('file selection made without change events remains available to the publish validation',()=>{
 const h=setup();try{const file=h.file();Object.defineProperty(h.input,'files',{value:[file]});assert.deepEqual(h.picker.getFiles(),[file]);assert.equal(h.created.length,0)}finally{h.close()}
});

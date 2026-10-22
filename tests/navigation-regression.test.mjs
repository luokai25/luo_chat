import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {JSDOM} from 'jsdom';
test('clicking contact and message controls never invokes the tab router',()=>{
 const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const binding=source.match(/document\.querySelectorAll\('[^']*data-tab[^']*'\)\.forEach\(x=>x\.onclick=\(\)=>tab\(x\.dataset\.tab\)\);/);
 assert.ok(binding,'tab binding must be discoverable');
 const dom=new JSDOM('<div class="app" data-tab="chats"><nav class="workspace-nav"><button class="tab" data-tab="new">People</button></nav><input id="target"><button id="start">Start chat</button><button id="openStories">Stories</button></div>',{runScripts:'outside-only'});
 const calls=[];dom.window.tab=id=>calls.push(id);dom.window.eval(binding[0]);
 for(const id of ['target','start','openStories'])dom.window.document.getElementById(id).click();
 assert.deepEqual(calls,[]);dom.window.document.querySelector('.tab').click();assert.deepEqual(calls,['new']);dom.window.close();
});
test('opening People reaches a stable DOM without an observer feedback loop',async()=>{
 const source=readFileSync(new URL('../public/luo-mobile-stability.js',import.meta.url),'utf8');
 const end=source.indexOf('/* Luo Chat integrated');
 assert.ok(end>0);
 const html='<div class="app" data-screen="home"><div id="home"><div id="chats" class="hidden"></div><div id="new"></div><div id="group" class="hidden"></div><div id="saved" class="hidden"></div><div id="scheduled" class="hidden"></div><div id="profile" class="hidden"></div></div></div>';
 await new Promise((resolve,reject)=>{
  const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const {JSDOM}=require('jsdom');const dom=new JSDOM(workerData.html,{runScripts:'outside-only'});dom.window.eval(workerData.source);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));dom.window.document.getElementById('new').classList.add('trigger');setTimeout(()=>parentPort.postMessage(dom.window.document.getElementById('chats').classList.contains('hidden')),25);`,{eval:true,workerData:{html,source:source.slice(0,end)}});
  const timer=setTimeout(()=>{worker.terminate();reject(Error('Visibility observer did not settle'))},2000);
  worker.once('message',hidden=>{clearTimeout(timer);worker.terminate();hidden?resolve():reject(Error('Chats leaked into People'))});
  worker.once('error',error=>{clearTimeout(timer);worker.terminate();reject(error)});
 });
});

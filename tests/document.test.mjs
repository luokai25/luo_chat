import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile('public/index.html','utf8');
test('static form controls and buttons keep programmatic names',()=>{
 const dom=new JSDOM(html),doc=dom.window.document;
 try{
  const labelledBy=e=>(e.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>doc.getElementById(id)?.textContent||'').join(' ').trim();
  for(const e of doc.querySelectorAll('input,textarea,select')){
   if(e.type==='hidden')continue;
   assert.ok(e.labels?.length||e.getAttribute('aria-label')?.trim()||labelledBy(e),'Missing label: '+e.id);
  }
  for(const e of doc.querySelectorAll('button'))assert.ok(e.getAttribute('aria-label')?.trim()||labelledBy(e)||e.textContent.trim(),'Missing button name: '+e.id);
 }finally{dom.window.close()}
});
test('document IDs and static ARIA references remain unambiguous',()=>{
 const dom=new JSDOM(html),doc=dom.window.document,ids=new Set();
 try{
  for(const e of doc.querySelectorAll('[id]')){assert.ok(!ids.has(e.id),'Duplicate ID: '+e.id);ids.add(e.id)}
  for(const attribute of ['aria-labelledby','aria-describedby','aria-controls'])for(const e of doc.querySelectorAll('['+attribute+']'))for(const id of e.getAttribute(attribute).trim().split(/\s+/))assert.ok(ids.has(id),'Missing '+attribute+' target: '+id);
 }finally{dom.window.close()}
});

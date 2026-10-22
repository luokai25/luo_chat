import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
test('authentication templates preserve native secure links and exclude tracking and user metadata',async()=>{
 const root=new URL('../integrations/resend/',import.meta.url),manifest=JSON.parse(await readFile(new URL('auth-templates.json',root),'utf8'));
 assert.deepEqual(Object.keys(manifest).sort(),['confirmation','email_change','invite','magic_link','reauthentication','recovery']);
 for(const [kind,item]of Object.entries(manifest)){
  const source=await readFile(new URL(item.file,root),'utf8'),dom=new JSDOM(source),doc=dom.window.document;
  assert.equal(doc.documentElement.lang,'en');assert.ok(doc.title);assert.match(item.subject,/Luo Chat/);
  assert.equal(doc.querySelectorAll('script,form,input,iframe,link,style,img').length,0);
  assert.doesNotMatch(source,/\.Data|\.Email|\.RedirectTo|tracking|https?:\/\//i);
  for(const table of doc.querySelectorAll('table'))assert.equal(table.getAttribute('role'),'presentation');
  if(kind==='reauthentication'){assert.match(source,/\{\{ \.Token \}\}/);assert.equal(doc.querySelectorAll('a').length,0);}
  else{assert.equal(doc.querySelectorAll('a').length,1);assert.equal(doc.querySelector('a').getAttribute('href'),'{{ .ConfirmationURL }}');}
  assert.match(doc.body.textContent,/did not request this/);dom.window.close();
 }
});

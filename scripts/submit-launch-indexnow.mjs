import {readFile} from 'node:fs/promises';
const origin='https://luo-workspace.luo-chat-ops.workers.dev';
const agent=await readFile('workspace/launch/sitemap.xml','utf8');const urlList=[...agent.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
const {readdir}=await import('node:fs/promises');const file=(await readdir('workspace/launch')).find(x=>/^[a-f0-9]{32}\.txt$/.test(x));const key=(await readFile('workspace/launch/'+file,'utf8')).trim();
if(!/^[a-f0-9]{32}$/.test(key)||file!==key+'.txt'||urlList.length!==3||urlList.some(x=>!x.startsWith(origin+'/launch/')))throw Error('Invalid owned launch URLs');
const keyLocation=origin+'/launch/'+file;
const proof=await fetch(keyLocation,{signal:AbortSignal.timeout(15000)});if(!proof.ok||(await proof.text()).trim()!==key)throw Error('Published ownership key not verified');
const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({host:new URL(origin).hostname,key,keyLocation,urlList}),signal:AbortSignal.timeout(15000)});
console.log(JSON.stringify({status:response.status,url_count:urlList.length,accepted:[200,202].includes(response.status),note:'Receipt is not an indexing guarantee. IndexNow is not Google.'}));if(![200,202].includes(response.status))process.exitCode=1;

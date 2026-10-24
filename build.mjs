import {build} from 'esbuild';
import {cp,mkdir,readFile,writeFile,rm,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SUPABASE_URL,SUPABASE_KEY} from './src/config.js';
import {validatePublicConfig} from './scripts/public-config.mjs';
const hosting=JSON.parse(await readFile('vercel.json','utf8'));
const csp=hosting.headers?.find(rule=>rule.source==='/(.*)')?.headers?.find(header=>header.key.toLowerCase()==='content-security-policy')?.value;
validatePublicConfig({url:SUPABASE_URL,key:SUPABASE_KEY,csp});
const release=JSON.parse(await readFile('package.json','utf8')).version;
if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(release))throw Error('A valid release version is required.');
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
const result=await build({entryPoints:{app:'src/entry.js'},entryNames:'[name]-[hash]',outdir:'dist',metafile:true,define:{'process.env.LUO_SUPABASE_URL':JSON.stringify(process.env.LUO_SUPABASE_URL||''),'process.env.LUO_SUPABASE_KEY':JSON.stringify(process.env.LUO_SUPABASE_KEY||'')},bundle:true,format:'esm',target:['es2022'],minify:true,legalComments:'eof'});
const js=Object.keys(result.metafile.outputs).find(path=>path.endsWith('.js')).replace('dist/','');
const cssContents=await readFile('dist/style.css'),css='style-'+createHash('sha256').update(cssContents).digest('hex').slice(0,12)+'.css';await rename('dist/style.css','dist/'+css);
const socialBytes=await readFile('dist/luo-social-feed.css'),socialCSS='luo-social-feed-'+createHash('sha256').update(socialBytes).digest('hex').slice(0,12)+'.css';await rename('dist/luo-social-feed.css','dist/'+socialCSS);
const iconMap={};for(const old of ['icon.svg','icon-32.png','icon-180.png','icon-192.png','icon-512.png','icon-1024.png','icon-maskable-512.png']){const bytes=await readFile('dist/'+old),ext=old.slice(old.lastIndexOf('.')),stem=old.slice(0,old.lastIndexOf('.')),fresh=stem+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+ext;await rename('dist/'+old,'dist/'+fresh);iconMap['/'+old]='/'+fresh;}
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));for(const icon of manifest.icons)icon.src=iconMap[icon.src]||icon.src;const manifestText=JSON.stringify(manifest),manifestName='manifest-'+createHash('sha256').update(manifestText).digest('hex').slice(0,12)+'.json';await writeFile('dist/manifest.json',manifestText);await writeFile('dist/'+manifestName,manifestText);
let html=await readFile('dist/index.html','utf8');html=html.replace('<span id="appVersion">development</span>','<span id="appVersion">'+release+'</span>').replace('</head>','<meta name="luo-version" content="'+release+'"></head>');for(const [old,fresh] of Object.entries(iconMap))html=html.replaceAll(old,fresh);html=html.replace('src="/app.js"','src="/'+js+'"').replace('href="/style.css"','href="/'+css+'"').replace('href="/luo-social-feed.css"','href="/'+socialCSS+'"');await writeFile('dist/index.html',html);
const shell=['/index.html','/'+js,'/'+css,'/'+socialCSS,...Object.values(iconMap),'/'+manifestName];
const version=createHash('sha256').update(html).digest('hex').slice(0,12);
await writeFile('dist/sw.js',`const CACHE='luo-chat-${version}',SHELL=${JSON.stringify(shell)};const PUSH_ICON=${JSON.stringify(iconMap['/icon-192.png'])};
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());

});
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('push',event=>{let payload;try{payload=event.data.json()}catch{payload={}}const owner=typeof payload?.data?.owner==='string'&&/^[a-f0-9-]{36}$/.test(payload.data.owner)?payload.data.owner:null;event.waitUntil(self.registration.showNotification('Luo Chat',{body:payload?.kind==='call'?'Incoming Luo Chat call':'You have a new message',icon:PUSH_ICON,badge:PUSH_ICON,tag:owner?'luo-push-'+owner:'luo-push',data:{luo:true,owner}}));});
self.addEventListener('notificationclick',event=>{if(!event.notification.data?.luo)return;event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const page=clients.find(client=>new URL(client.url).origin===self.location.origin);if(page)return page.focus();return self.clients.openWindow('/');}));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('luo-chat-')&&key!==CACHE||key.startsWith('luo-core-master-'))).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(fetch(request).then(async response=>{if(response.ok){await(await caches.open(CACHE)).put('/index.html',response.clone());}return response;}).catch(()=>caches.match('/index.html')));return;}if(SHELL.includes(url.pathname)||/^\\/app-[A-Z0-9]+\\.js$|^\\/style-[a-f0-9]+\\.css$/.test(url.pathname)){event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(async response=>{if(response.ok)await(await caches.open(CACHE)).put(request,response.clone());return response;})));}});
`);
console.log('Luo Chat production bundle and private-data-free offline shell ready');

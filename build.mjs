import {build} from 'esbuild';
import {cp,mkdir,readFile,writeFile,rm,rename,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SUPABASE_URL,SUPABASE_KEY} from './src/config.js';
import {validatePublicConfig} from './scripts/public-config.mjs';
import {enhanceSite} from './scripts/site-quality.mjs';
import {optimizePNGs} from './scripts/optimize-png.mjs';
const hosting=JSON.parse(await readFile('vercel.json','utf8'));
const csp=hosting.headers?.find(rule=>rule.source==='/(.*)')?.headers?.find(header=>header.key.toLowerCase()==='content-security-policy')?.value;
validatePublicConfig({url:SUPABASE_URL,key:SUPABASE_KEY,csp});
// Prevent the Reels preview branch from silently falling back to the live chat DB.
// Only the isolated staging publishable key and project may be used in previews.
if(process.env.VERCEL_ENV==='preview'&&['feature/reels-immersive-20261025','release/luo-ui-polish-20261027','release/agent-api-20261027','release/secondary-pages-v5-20261027'].includes(process.env.VERCEL_GIT_COMMIT_REF)){
 if(process.env.LUO_SUPABASE_URL!=='https://itecovbwilcrvjqkdoyd.supabase.co'||!process.env.LUO_SUPABASE_KEY)throw Error('Reels preview requires the isolated staging Supabase URL and publishable key; refusing production fallback.');
}

// Optional read-only PayPal merchant preflight. Never creates a payment.
if(process.env.VERCEL_ENV==='production'&&process.env.LUO_AGENT_LIVE_PREFLIGHT_REQUIRED==='true')
 await import('./scripts/check-agent-live-paypal.mjs');
const release=JSON.parse(await readFile('package.json','utf8')).version;
if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(release))throw Error('A valid release version is required.');
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
await enhanceSite('dist');
const images=await optimizePNGs('dist');console.log('Lossless PNG compression:',JSON.stringify(images));
await build({entryPoints:{app:'src/entry.js'},entryNames:'[name]',outdir:'dist',define:{'process.env.LUO_SUPABASE_URL':JSON.stringify(process.env.LUO_SUPABASE_URL||''),'process.env.LUO_SUPABASE_KEY':JSON.stringify(process.env.LUO_SUPABASE_KEY||'')},bundle:true,format:'esm',target:['es2022'],minify:true,legalComments:'eof'});
// esbuild's graph hash can differ across source paths even for identical bytes.
// Address the emitted file by its bytes, just like CSS/icons below.
const appBytes=await readFile('dist/app.js'),js='app-'+createHash('sha256').update(appBytes).digest('hex').slice(0,16).toUpperCase()+'.js';await rename('dist/app.js','dist/'+js);
// Do not package obsolete app bundles from a reused build output directory.
for(const name of await readdir('dist'))if(/^app-[A-Z0-9]+\.js$/.test(name)&&name!==js)await rm('dist/'+name);
const cssContents=await readFile('dist/style.css'),css='style-'+createHash('sha256').update(cssContents).digest('hex').slice(0,12)+'.css';await rename('dist/style.css','dist/'+css);
const socialBytes=await readFile('dist/luo-social-feed.css'),socialCSS='luo-social-feed-'+createHash('sha256').update(socialBytes).digest('hex').slice(0,12)+'.css';await rename('dist/luo-social-feed.css','dist/'+socialCSS);
const callBytes=await readFile('dist/luo-call-quality.css'),callCSS='luo-call-quality-'+createHash('sha256').update(callBytes).digest('hex').slice(0,12)+'.css';await rename('dist/luo-call-quality.css','dist/'+callCSS);
for(const name of await readdir('dist'))if(/^luo-call-quality-[a-f0-9]+\.css$/.test(name)&&name!==callCSS)await rm('dist/'+name);
const iconMap={};for(const old of ['icon.svg','icon-32.png','icon-180.png','icon-192.png','icon-512.png','icon-1024.png','icon-maskable-512.png']){const bytes=await readFile('dist/'+old),ext=old.slice(old.lastIndexOf('.')),stem=old.slice(0,old.lastIndexOf('.')),fresh=stem+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+ext;await rename('dist/'+old,'dist/'+fresh);iconMap['/'+old]='/'+fresh;}
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));for(const icon of manifest.icons)icon.src=iconMap[icon.src]||icon.src;const manifestText=JSON.stringify(manifest),manifestName='manifest-'+createHash('sha256').update(manifestText).digest('hex').slice(0,12)+'.json';await writeFile('dist/manifest.json',manifestText);await writeFile('dist/'+manifestName,manifestText);
let html=await readFile('dist/index.html','utf8');html=html.replace('<span id="appVersion">development</span>','<span id="appVersion">'+release+'</span>').replace('</head>','<meta name="luo-version" content="'+release+'"></head>');for(const [old,fresh] of Object.entries(iconMap))html=html.replaceAll(old,fresh);html=html.replace('src="/app.js"','src="/'+js+'"').replace('href="/style.css"','href="/'+css+'"').replace('href="/luo-social-feed.css"','href="/'+socialCSS+'"');await writeFile('dist/index.html',html);
html=html.replace(/href="\/luo-call-quality\.css(?:\?[^"]*)?"/,'href="/'+callCSS+'"');await writeFile('dist/index.html',html);
const shell=['/index.html','/'+js,'/'+css,'/'+socialCSS,'/'+callCSS,...Object.values(iconMap),'/'+manifestName];
// Self-service diagnostics must follow this build, not obsolete bundle hashes.
let checks=await readFile('dist/connection-checks.js','utf8');
checks=checks.replace(/\/app-[A-Z0-9]+\.js/g,'/'+js).replace(/\/style-[a-f0-9]+\.css/g,'/'+css).replace(/\/icon-192-[a-f0-9]+\.png/g,iconMap['/icon-192.png']);
await writeFile('dist/connection-checks.js',checks);
const version=createHash('sha256').update(html).digest('hex').slice(0,12);
await writeFile('dist/sw.js',`const CACHE='luo-chat-${version}',SHELL=${JSON.stringify(shell)};
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());});
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('push',event=>{let payload;try{payload=event.data.json()}catch{payload={}}const owner=typeof payload?.data?.owner==='string'&&/^[a-f0-9-]{36}$/.test(payload.data.owner)?payload.data.owner:null;event.waitUntil(self.registration.showNotification('Luo Chat',{body:payload?.kind==='call'?'Incoming Luo Chat call':'You have a new message',tag:owner?'luo-push-'+owner:'luo-push',data:{luo:true,owner}}));});
self.addEventListener('notificationclick',event=>{if(!event.notification.data?.luo)return;event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const page=clients.find(client=>new URL(client.url).origin===self.location.origin);if(page)return page.focus();return self.clients.openWindow('/');}));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('luo-chat-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(request.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html')){event.respondWith(fetch(request).then(async response=>{if(response.ok){await(await caches.open(CACHE)).put('/index.html',response.clone());}return response;}).catch(()=>caches.match('/index.html')));return;}if(SHELL.includes(url.pathname)||/^\\/app-[A-Z0-9]+\\.js$|^\\/style-[a-f0-9]+\\.css$/.test(url.pathname)){event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(async response=>{if(response.ok)await(await caches.open(CACHE)).put(request,response.clone());return response;})));}});
`);
console.log('Luo Chat production bundle and private-data-free offline shell ready');

import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const content=await Promise.all(['public/luo-mobile-stability.css','public/luo-mobile-stability.js','public/luo-session-boot.js'].map(f=>readFile(f)));const version=createHash('sha256').update(Buffer.concat(content)).digest('hex').slice(0,12);
let sw=await readFile('dist/sw.js','utf8');if(!/const CACHE='luo-chat-[^']+'/.test(sw))throw Error('Cache not recognized');sw=sw.replace(/const CACHE='luo-chat-[^']+'/, "const CACHE='luo-chat-"+version+"'");
// Keep background messages generic to protect the sender's privacy. Add the Luo icon
// and an in-app notification when a controlled page is in the foreground.
{
 const start=sw.indexOf("self.addEventListener('push',event=>{");
 const end=sw.indexOf("self.addEventListener('notificationclick'",start);
 if(start<0||end<0)throw Error('Worker push format changed');
 const icon=(sw.match(/\/icon-192-[^"]+\.png/)||[])[0];
 if(!icon)throw Error('Luo notification icon unavailable');
 const listener="self.addEventListener('push',event=>{let payload;try{payload=event.data.json()}catch{payload={}}"
 +"const kind=payload?.kind==='call'?'call':'message';"
 +"const owner=typeof payload?.data?.owner==='string'&&/^[a-f0-9-]{36}$/.test(payload.data.owner)?payload.data.owner:null;"
 +"event.waitUntil((async()=>{const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});"
 +"for(const page of pages){if(new URL(page.url).origin===self.location.origin)page.postMessage({type:'LUO_PUSH_NOTICE',kind});}"
 +"const visible=pages.some(page=>page.visibilityState==='visible'&&page.focused);if(visible)return;"
 +"await self.registration.showNotification('Luo Chat',{body:kind==='call'?'Incoming Luo Chat call':'You have a new message',icon:'"+icon+"',badge:'"+icon+"',tag:owner?'luo-push-'+owner:'luo-push',data:{luo:true,owner}});})());});";
 sw=sw.slice(0,start)+listener+"\n"+sw.slice(end);
}

await writeFile('dist/sw.js',sw);
let html=await readFile('dist/index.html','utf8');for(const f of ['luo-modern.css','luo-mobile-stability.js','luo-session-boot.js'])html=html.replace(new RegExp('/'+f.replace(/\./g,'\\.')+'(?:\\?v=[a-z0-9]+)*','g'),'/'+f+'?v='+version);
html=html.replace('</head>','<meta name="luo-mobile-stability-revision" content="'+version+'"></head>');
if(!html.includes('<meta name="google-site-verification" content="y09hvb9dhGQPvM_sozzO_Q3z09BT30HekpDvlDsVR-w" />'))throw Error('Google verification removed');
if(html.indexOf('/luo-session-boot.js')>html.indexOf('<body>'))throw Error('Late bootstrap');
await writeFile('dist/index.html',html);console.log('Luo v15.5 cache revision '+version);


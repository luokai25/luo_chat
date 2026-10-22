import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const assets=[await readFile('public/luo-wa-visible.js'),await readFile('public/luo-wa-visible.css')];
const digest=createHash('sha256').update(assets[0]).update(assets[1]).digest('hex').slice(0,12);
let sw=await readFile('dist/sw.js','utf8');
if(!/const CACHE='luo-chat-[^']+'/.test(sw))throw Error('Unexpected SW cache');
sw=sw.replace(/const CACHE='luo-chat-[^']+'/, "const CACHE='luo-chat-"+digest+"'");
await writeFile('dist/sw.js',sw);
let html=await readFile('dist/index.html','utf8');
for(const f of ['luo-modern.css','luo-wa-mobile.js','luo-wa-visible.js']){
 if(!html.includes('/'+f))throw Error('Missing resource '+f);
 html=html.replaceAll('/'+f,'/'+f+'?v='+digest);
}
html=html.replace('</head>','<meta name="luo-ui-revision" content="'+digest+'"></head>');
await writeFile('dist/index.html',html);
console.log('Luo Chat cache refresh '+digest);

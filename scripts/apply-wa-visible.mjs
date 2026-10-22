import {readFile,appendFile,writeFile} from 'node:fs/promises';
const marker='/* Luo Chat Mobile Visible v2:';
const [base,extra,page]=await Promise.all([readFile('public/luo-modern.css','utf8'),readFile('public/luo-wa-visible.css','utf8'),readFile('public/index.html','utf8')]);
if(!extra.startsWith(marker)||extra.length<1900)throw Error('Missing mobile layout patch');
if(!base.includes(marker))await appendFile('public/luo-modern.css','\n'+extra);
const tag='<script defer src="/luo-wa-visible.js"></script>';
if(!page.includes(tag)){if(!page.includes('</body>'))throw Error('Missing HTML closing tag');await writeFile('public/index.html',page.replace('</body>',tag+'</body>'))}
console.log('Luo Chat mobile phone header installed');

import {readFile,appendFile,writeFile} from 'node:fs/promises';
const marker='/* Luo Chat mobile tidy-up:';
const verify='<meta name="google-site-verification" content="y09hvb9dhGQPvM_sozzO_Q3z09BT30HekpDvlDsVR-w" />';
const [base,extra,index]=await Promise.all([readFile('public/luo-modern.css','utf8'),readFile('public/luo-phone-polish.css','utf8'),readFile('public/index.html','utf8')]);
if(!index.includes(verify))throw Error('Google verification missing');
if(!extra.startsWith(marker)||extra.length<5000)throw Error('Missing phone polish style');
if(!base.includes(marker))await appendFile('public/luo-modern.css','\n'+extra);
const script='<script defer src="/luo-phone-polish.js"></script>';
if(!index.includes(script)){if(!index.includes('</body>'))throw Error('No closing body');await writeFile('public/index.html',index.replace('</body>',script+'</body>'))}
console.log('Luo Chat polished phone screens installed; Google verified');

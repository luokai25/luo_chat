import {readFile,appendFile,writeFile} from 'node:fs/promises';
const marker='/* Luo mobile single-panel state fix 2026-10-22.';
const verify='<meta name="google-site-verification" content="y09hvb9dhGQPvM_sozzO_Q3z09BT30HekpDvlDsVR-w" />';
const [base,patch,html]=await Promise.all([readFile('public/luo-modern.css','utf8'),readFile('public/luo-screenfix.css','utf8'),readFile('public/index.html','utf8')]);
if(!html.includes(verify))throw Error('Google verification must remain unchanged');
if(!patch.startsWith(marker)||!patch.includes('.app[data-screen="home"] main>#room'))throw Error('Screen fix is incomplete');
if(!base.includes(marker))await appendFile('public/luo-modern.css','\n'+patch);
console.log('Luo mobile single-screen hotfix installed');

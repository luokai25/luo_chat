import {readFile,appendFile,writeFile} from 'node:fs/promises';
const cssPath='public/luo-modern.css';
const indexPath='public/index.html';
const marker='/* Luo Chat mobile 2026:';
const [base,theme,index]=await Promise.all([readFile(cssPath,'utf8'),readFile('public/luo-wa-mobile.css','utf8'),readFile(indexPath,'utf8')]);
if(!theme.startsWith(marker)||theme.length<6000)throw new Error('Missing mobile layout stylesheet');
if(!base.includes(marker))await appendFile(cssPath,'\n'+theme);
const tag='<script defer src="/luo-wa-mobile.js"></script>';
if(!index.includes(tag)){
  if(!index.includes('</body>'))throw new Error('No document body closing tag');
  await writeFile(indexPath,index.replace('</body>',tag+'</body>'));
}
console.log('Luo Chat mobile WhatsApp-style layout installed');
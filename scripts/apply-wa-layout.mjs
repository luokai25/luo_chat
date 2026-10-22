import {readFile,appendFile} from 'node:fs/promises';
const path='public/luo-modern.css';
const marker='/* Luo Chat WhatsApp-inspired layout';
const [base,theme]=await Promise.all([readFile(path,'utf8'),readFile('public/luo-whatsapp.css','utf8')]);
if(!theme.startsWith(marker)||theme.length<5000)throw new Error('Missing layout stylesheet');
if(base.includes(marker))console.log('WhatsApp-inspired layout already applied');
else{await appendFile(path,'\n'+theme);console.log('Luo WhatsApp-inspired layout applied')}

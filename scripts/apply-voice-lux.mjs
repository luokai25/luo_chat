import {readFile,appendFile} from 'node:fs/promises';
const file='public/luo-modern.css',text=await readFile(file,'utf8'),lux=await readFile('public/luo-voice-lux.css','utf8');
if(!lux.startsWith('/* Luo Voice Lux:')||lux.length<4200)throw Error('Voice visual system missing');
if(!text.includes('/* Luo Voice Lux:'))await appendFile(file,'\n'+lux);
console.log('Gold-on-obsidian voice visual system installed');

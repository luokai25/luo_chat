// Release the 50 user-approved PNG stickers only. No legacy sticker generator.
import {readFile,readdir} from 'node:fs/promises';
import {stickers,emotions} from '../src/luo-family.js';
import {createHash} from 'node:crypto';
const directory='public/stickers/luo-family';
const files=await readdir(directory);
const actual=files.filter(name=>/\.png$/i.test(name));
if(stickers.length!==50||emotions.length!==5||actual.length!==50||files.length!==50)throw Error(`Sticker pack must contain exactly 50 PNGs, found ${files.length}`);
const hashes=new Set();
for(const sticker of stickers){
 if(!/^luo50-(?:0[1-9]|[1-4][0-9]|50)\.png$/.test(sticker.src.split('/').at(-1)))throw Error('Unexpected sticker filename '+sticker.src);
 const data=await readFile('public'+sticker.src);
 if(data.length<1000||data.length>2_000_000||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||data.readUInt32BE(16)!==512||data.readUInt32BE(20)!==512)throw Error('Invalid PNG '+sticker.id);
 hashes.add(createHash('sha256').update(data).digest('hex'));
}
if(hashes.size!==50)throw Error('Sticker images are not unique');
const trayPath='src/sticker-tray.js';
const before=await readFile(trayPath,'utf8');
if((!before.includes('200 original stickers')||!before.includes('20 moods'))&&(!before.includes('50 premium stickers')||!before.includes('5 character families')))throw Error('Sticker tray structure changed; refusing unsafe replacement.');
const after=before.replace('200 original stickers','50 premium stickers').replace('20 moods','5 character families');
await import('node:fs/promises').then(fs=>fs.writeFile(trayPath,after));
// Update any additional user-facing release descriptions without touching personal
// sticker pack limits, data, the database or other app behavior.
import {readdir as directoryEntries,readFile as readSource,writeFile as writeSource} from 'node:fs/promises';
async function updateReleaseCopy(folder){
 for(const entry of await directoryEntries(folder,{withFileTypes:true})){
  const current=folder+'/'+entry.name;
  if(entry.isDirectory()){await updateReleaseCopy(current);continue;}
  if(!entry.isFile()||!(/\.(?:js|html)$/.test(entry.name)))continue;
  const text=await readSource(current,'utf8');
  const replaced=text.replaceAll('Luo Family: 200 original stickers, 20 moods','Luo Family: 50 premium stickers, 5 character families')
    .replaceAll('200 original stickers','50 premium stickers').replaceAll('20 moods','5 character families');
  if(replaced!==text)await writeSource(current,replaced);
 }
}
await updateReleaseCopy('src');
console.log('PASS: validated 50 new stickers across 5 families; removed 200-sticker catalog and renderer.');

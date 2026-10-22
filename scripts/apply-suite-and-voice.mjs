import {readFile,appendFile,writeFile} from 'node:fs/promises';
const owner='<meta name="google-site-verification" content="y09hvb9dhGQPvM_sozzO_Q3z09BT30HekpDvlDsVR-w" />';
const [old,css,html,voice]=await Promise.all([readFile('public/luo-modern.css','utf8'),readFile('public/luo-suite-voice.css','utf8'),readFile('public/index.html','utf8'),readFile('public/luo-inline-voice.js','utf8')]);
if(!html.includes(owner))throw Error('Google verification missing');
if(!css.includes('Luo Chat full-suite and inline voice UI')||!voice.includes('MediaRecorder'))throw Error('Missing UI/recorder source');
if(!old.includes('/* Luo Chat full-suite and inline voice UI'))await appendFile('public/luo-modern.css','\n'+css);
// Keep old script tags until the preceding legacy build/revision stages finish.
let out=html;
for(const name of ['luo-suite-fixes.js','luo-inline-voice.js']){const tag='<script defer src="/'+name+'"></script>';if(!out.includes(tag))out=out.replace('</body>',tag+'</body>')}
if(!out.includes('</body>'))throw Error('Malformed HTML');
await writeFile('public/index.html',out);
console.log('All-pages fixes and inline voice installed; defer legacy-script removal until final revision');

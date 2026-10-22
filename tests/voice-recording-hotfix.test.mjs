import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
test('microphone denial remains visible and can retry',async()=>{
 const html='<html><body><div class="app" data-screen="room"><section id="room"><div id="roomtitle">Friend</div><div id="fileBar" class="hidden"></div><form id="sendform"><textarea id="body"></textarea><button class="send" type="submit">Send</button></form><input type="file" id="mediaFile"></section></div></body></html>';
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://luo-chat-luokai25.vercel.app'}),w=dom.window,d=w.document;
 Object.defineProperty(w.navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{const e=new Error('denied');e.name='NotAllowedError';throw e}}});
 w.MediaRecorder=class{};w.URL.createObjectURL=()=> 'blob:mock';w.URL.revokeObjectURL=()=>{};
 w.eval(await readFile('public/luo-inline-voice.js','utf8'));d.dispatchEvent(new w.Event('DOMContentLoaded'));
 d.querySelector('#luoInlineMic').click();await new Promise(r=>setTimeout(r,0));
 assert.equal(d.querySelector('#luoVoiceStage').textContent,'MICROPHONE ERROR');
 assert.equal(d.querySelector('#luoVoiceRetry').hidden,false);
 assert.equal(d.querySelector('#room').classList.contains('luo-voice-open'),true);
 assert.match(d.querySelector('#luoVoiceFeedback').textContent,/Microphone permission denied/);
 d.querySelector('#luoVoiceDiscard').click();assert.equal(d.querySelector('#room').classList.contains('luo-voice-open'),false);w.close()
});
test('new recorder keeps all real media handling and gesture cleanup',async()=>{
 const js=await readFile('public/luo-inline-voice.js','utf8');
 for(const item of ['getUserMedia','recorder.start(250)','recorder.ondataavailable','file.dispatchEvent','form.requestSubmit','getByteTimeDomainData','luoVoiceRetry','setTimeout(()=>{ignoreClick=false},420)'])assert.ok(js.includes(item),item);
 assert.ok(!js.includes("['recording','paused','requesting'].includes(state)"));
});
test('Google verification is retained and original suites run',async()=>{
 const html=await readFile('public/index.html','utf8');
 assert.ok(html.includes('<meta name="google-site-verification" content="y09hvb9dhGQPvM_sozzO_Q3z09BT30HekpDvlDsVR-w" />'));
 const pkg=JSON.parse(await readFile('package.json','utf8'));assert.ok(pkg.scripts['release:check:full']);assert.ok(pkg.scripts['release:check'].includes('--test'));
});

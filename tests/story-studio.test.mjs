import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installStoryStudio,validateStoryStudioFiles,storyLayoutSlots} from '../src/story-studio.js';

function harness() {
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://luo.example/',pretendToBeVisual:true});
 const win=dom.window,document=win.document,drawn=[],outputs=[],notices=[];
 let actor={id:'owner-one'},sourceFile=null,saveCallback=null;
 win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 win.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 win.HTMLCanvasElement.prototype.getContext=function(){
  return {
   createLinearGradient:()=>({addColorStop(){}}),
   fillRect(){drawn.push('background')},beginPath(){},rect(){},clip(){},save(){},restore(){},drawImage(){drawn.push('photo')},
   arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},fillText(v){drawn.push('caption:'+v)},strokeText(){},
   set fillStyle(v){},set font(v){},set lineWidth(v){},set filter(v){},set shadowColor(v){},set shadowBlur(v){},
   set textAlign(v){},set textBaseline(v){},set strokeStyle(v){},set lineCap(v){},set lineJoin(v){}
  };
 };
 win.HTMLCanvasElement.prototype.toBlob=function(callback){if(saveCallback){saveCallback(callback);return}callback(new win.Blob(['png output'],{type:'image/png'}))};
 win.createImageBitmap=async file=>({width:1000,height:1600,close(){drawn.push('closed:'+file.name)}});
 const api=installStoryStudio({win,getUser:()=>actor,getSourceFile:()=>sourceFile,onApply:file=>outputs.push(file),note:x=>notices.push(x)});
 const canvas=api.canvas;
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:270,height:480,right:270,bottom:480});
 const click=text=>{const b=[...api.dialog.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,'button '+text+' found');b.click();return b};
 const select=(index,value)=>{const s=api.dialog.querySelectorAll('select')[index];s.value=value;s.dispatchEvent(new win.Event('change'))};
 return {dom,win,document,api,drawn,outputs,notices,click,select,setOwner:v=>actor=v,setSource:v=>sourceFile=v,setSaveCallback:v=>saveCallback=v};
}
test('story layouts fill vertical frame and never silently hide photo three in duo mode',()=>{
 const grid=storyLayoutSlots(3,'grid'),duo=storyLayoutSlots(3,'duo');
 assert.equal(grid.length,3);assert.equal(duo.length,3);
 assert.deepEqual(storyLayoutSlots(2,'duo'),[{x:0,y:0,w:270,h:960},{x:270,y:0,w:270,h:960}]);
 assert.deepEqual(storyLayoutSlots(1,'single'),[{x:0,y:0,w:540,h:960}]);
});
test('story photo validation rejects executable files, oversized media and too many files',()=>{
 const ok={type:'image/jpeg',size:2048};
 assert.equal(validateStoryStudioFiles([ok]).length,1);
 assert.throws(()=>validateStoryStudioFiles([]),/one and four/);
 assert.throws(()=>validateStoryStudioFiles(Array(5).fill(ok)),/one and four/);
 assert.throws(()=>validateStoryStudioFiles([{type:'application/octet-stream',size:100}]),/JPG, PNG or WebP/);
 assert.throws(()=>validateStoryStudioFiles([{type:'image/png',size:13*1024*1024}]),/12 MB/);
});
test('photo Studio renders a composed image locally and requires separate Story publishing',async()=>{
 const h=harness();h.api.open();assert.equal(h.api.dialog.open,true);
 const pictures=[new h.win.File(['1'],'first.png',{type:'image/png'}),new h.win.File(['2'],'second.png',{type:'image/png'})];
 const upload=h.api.dialog.querySelector('input[type=file]');Object.defineProperty(upload,'files',{configurable:true,value:pictures});upload.dispatchEvent(new h.win.Event('change'));
 for(let i=0;i<4;i++)await Promise.resolve();
 assert.ok(h.drawn.includes('photo'),'decoded photos render in the canvas');
 h.select(0,'duo');h.select(3,'sticker');
 h.api.canvas.dispatchEvent(new h.win.MouseEvent('pointerdown',{bubbles:true,clientX:135,clientY:240}));
 const caption=h.api.dialog.querySelector('input[type=text]');caption.value='<b>Safe memory</b>';h.click('Add caption');
 assert.ok(h.drawn.some(v=>v.includes('<b>Safe memory</b>')),'caption is painted, not parsed as HTML');
 assert.equal(h.api.dialog.querySelector('b'),null,'markup is not turned into DOM');
 h.click('Use this Story');
 for(let i=0;i<4;i++)await Promise.resolve();
 assert.equal(h.outputs.length,1);
 assert.equal(h.outputs[0].type,'image/png');
 assert.ok(h.outputs[0].size>0);
 assert.equal(h.api.file(),h.outputs[0]);
 assert.equal(h.api.dialog.open,false);
 assert.match(h.notices[0],/Choose who can see it/);
 h.dom.window.close();
});
test('signout invalidates a delayed image export and releases all private studio content',async()=>{
 const h=harness();h.api.open();
 let callback;h.setSaveCallback(c=>callback=c);
 h.click('Use this Story');
 await Promise.resolve();
 h.setOwner(null);h.api.signedOut();
 callback(new h.win.Blob(['late'],{type:'image/png'}));
 for(let i=0;i<4;i++)await Promise.resolve();
 assert.equal(h.outputs.length,0);
 assert.equal(h.api.file(),null);
 assert.equal(h.api.dialog.open,false);
 h.dom.window.close();
});

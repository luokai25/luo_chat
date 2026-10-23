// Luo Story Studio. All source imagery and edits stay on-device until Share.
export function validateStoryStudioFiles(files) {
 const list=Array.from(files||[]);
 if (!list.length || list.length>4) throw Error('Select between one and four photos.');
 for (const file of list) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size || file.size>12*1024*1024)
   throw Error('Choose JPG, PNG or WebP photos up to 12 MB each.');
 }
 return list;
}
export function storyLayoutSlots(count,layout='grid') {
 if(layout==='single'||count===1)return [{x:0,y:0,w:540,h:960}];
 if(layout==='duo'&&count===2)return [{x:0,y:0,w:270,h:960},{x:270,y:0,w:270,h:960}].slice(0,count);
 const slots=[{x:0,y:0,w:270,h:480},{x:270,y:0,w:270,h:480},{x:0,y:480,w:270,h:480},{x:270,y:480,w:270,h:480}];
 if(count===2)return [{x:0,y:0,w:540,h:480},{x:0,y:480,w:540,h:480}];
 if(count===3)return [{x:0,y:0,w:540,h:480},{x:0,y:480,w:270,h:480},{x:270,y:480,w:270,h:480}];
 return slots.slice(0,count);
}
export function installStoryStudio({win,getUser,getSourceFile,onApply,note}) {
 const doc=win.document,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
 let epoch=0,source=[],layers=[],mode='draw',drag=null,prepared=null,pending=false;
 const dialog=el('dialog','luo-story-studio');
 dialog.id='luoStoryStudio';dialog.setAttribute('aria-labelledby','luoStoryStudioTitle');
 const heading=el('div','luo-story-studio-head'),title=el('h2','','Story studio'),close=el('button','ghost','Close');
 title.id='luoStoryStudioTitle';close.type='button';heading.append(title,close);
 const hint=el('p','muted','Create a 9:16 story. Add photos, captions, stickers, and hand-drawn details. Only the finished picture is uploaded when you share.');
 const files=el('input','field');files.type='file';files.accept='image/jpeg,image/png,image/webp';files.multiple=true;files.setAttribute('aria-label','Choose up to four Story photos');
 const canvas=el('canvas','luo-story-studio-canvas');canvas.width=540;canvas.height=960;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Live vertical Story preview; drag to draw or move a selected element');
 const stage=el('div','luo-story-studio-stage');stage.append(canvas);
 const controls=el('section','luo-story-studio-controls');
 const selector=(name,choices)=>{const label=el('label','',name),s=el('select','field');for(const [v,text] of choices){const o=el('option','',text);o.value=v;s.append(o)}label.append(s);controls.append(label);return s};
 const layout=selector('Photo arrangement',[['single','Full picture'],['duo','Side by side'],['grid','Collage']]);
 const theme=selector('Background',[['gold','Golden dusk'],['obsidian','Obsidian'],['rose','Rose'],['stars','Starlight']]);
 const filter=selector('Photo filter',[['none','Original'],['warm','Golden warmth'],['mono','Monochrome'],['cool','Midnight']]);
 const tool=selector('Touch tool',[['draw','Draw'],['sticker','Place sticker'],['move','Move caption or sticker']]);
 const color=el('input','field');color.type='color';color.value='#edc578';
 const thickness=el('input','field');thickness.type='range';thickness.min='2';thickness.max='24';thickness.value='8';thickness.setAttribute('aria-label','Pen thickness');
 const pen=el('label','','Pen color and size');pen.append(color,thickness);controls.append(pen);
 const sticker=selector('Sticker',[['✨','Sparkles'],['💛','Gold heart'],['🌹','Rose'],['🦋','Butterfly'],['⭐','Star'],['🎉','Confetti'],['🐉','Dragon']]);
 const caption=el('input','field');caption.type='text';caption.maxLength=120;caption.placeholder='Write a caption';caption.setAttribute('aria-label','Story caption text');
 const add=el('button','ghost','Add caption');add.type='button';controls.append(caption,add);
 const actions=el('div','luo-story-studio-actions');
 const undo=el('button','ghost','Undo'),clear=el('button','ghost','Clear decorations'),save=el('button','primary','Use this Story');
 for(const b of [undo,clear,save])b.type='button';actions.append(undo,clear,save);
 const status=el('p','luo-story-studio-status','Choose photos, or create a graphic Story using the background.');status.setAttribute('role','status');
 dialog.append(heading,hint,files,stage,controls,actions,status);doc.body.append(dialog);
 const css=el('style');css.textContent=[
 '.luo-story-studio{width:min(96vw,980px);max-width:980px;max-height:94dvh;border:1px solid #9f7b42;border-radius:20px;padding:18px;background:#131214;color:#f6e4c5;overflow:auto;box-sizing:border-box}',
 '.luo-story-studio::backdrop{background:#000d;backdrop-filter:blur(5px)}',
 '.luo-story-studio-head{display:flex;justify-content:space-between;align-items:center;gap:10px}',
 '.luo-story-studio-head h2{margin:0;color:#e9c27e}',
 '.luo-story-studio-stage{width:min(100%,360px);margin:12px auto;border:1px solid #b18b4c;border-radius:16px;overflow:hidden;background:#171315;box-shadow:0 16px 40px #0007}',
 '.luo-story-studio-canvas{width:100%;height:auto;aspect-ratio:9 / 16;display:block;touch-action:none;cursor:crosshair}',
 '.luo-story-studio-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:8px 14px}',
 '.luo-story-studio-controls label{display:grid;gap:4px;color:#e8d0a2;font-size:13px}',
 '.luo-story-studio .field{min-width:0;width:100%;box-sizing:border-box;min-height:40px;background:#211c1a;color:#fff4d9;border:1px solid #735c3f;border-radius:10px;padding:9px}',
 '.luo-story-studio-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:end;margin-top:16px}',
 '.luo-story-studio-status{color:#dfc28d;min-height:20px}',
 '@media(min-width:700px){.luo-story-studio{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,1fr);column-gap:22px}.luo-story-studio-head,.luo-story-studio>p,.luo-story-studio>input,.luo-story-studio-actions{grid-column:1/-1}.luo-story-studio-stage{grid-column:1;margin:10px auto}.luo-story-studio-controls{grid-column:2;align-content:start;grid-template-columns:1fr 1fr}.luo-story-studio-controls label{grid-column:span 1}}',
 '@media(prefers-reduced-motion:reduce){.luo-story-studio::backdrop{backdrop-filter:none}}'
 ].join('\n');doc.head.append(css);
 let ctx=null;
 const gradients={gold:['#2f1c14','#9f6830','#130f1c'],obsidian:['#0c0c11','#27202b','#0d0c11'],rose:['#361526','#ba7076','#201622'],stars:['#0a0f2c','#25284d','#090817']};
 const paint=(x=0,y=0,w=540,h=960)=>{
  if(!ctx)return;
  const g=ctx.createLinearGradient(0,0,540,960),colors=gradients[theme.value]||gradients.gold;colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));ctx.fillStyle=g;ctx.fillRect(0,0,540,960);
  if(theme.value==='stars'){for(let i=0;i<60;i++){ctx.fillStyle='rgba(254,224,164,'+(.1+(i%6)*.1)+')';ctx.beginPath();ctx.arc((i*127)%540,(i*193)%960,1+i%2,0,Math.PI*2);ctx.fill()}}
  if(source.length){const slots=storyLayoutSlots(source.length,layout.value);slots.forEach((rect,i)=>{const img=source[i]?.image;if(!img)return;const iw=img.width,ih=img.height;if(!iw||!ih)return;const scale=Math.max(rect.w/iw,rect.h/ih),sw=rect.w/scale,sh=rect.h/scale,sx=(iw-sw)/2,sy=(ih-sh)/2;ctx.save();ctx.beginPath();ctx.rect(rect.x+3,rect.y+3,rect.w-6,rect.h-6);ctx.clip();ctx.filter=filter.value==='warm'?'sepia(.25) saturate(1.2)':filter.value==='mono'?'grayscale(1)':filter.value==='cool'?'hue-rotate(30deg) saturate(.75)':'none';ctx.drawImage(img,sx,sy,sw,sh,rect.x+3,rect.y+3,rect.w-6,rect.h-6);ctx.restore()})}
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const layer of layers){if(layer.type==='stroke'){if(layer.points.length<1)continue;ctx.save();ctx.strokeStyle=layer.color;ctx.fillStyle=layer.color;ctx.lineWidth=layer.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<layer.points.length;i++){const p=layer.points[i];i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}if(layer.points.length===1){const p=layer.points[0];ctx.arc(p.x,p.y,layer.width/2,0,Math.PI*2);ctx.fill()}else ctx.stroke();ctx.restore()}else if(layer.type==='sticker'){ctx.save();ctx.font='65px "Apple Color Emoji","Segoe UI Emoji",sans-serif';ctx.fillText(layer.value,layer.x,layer.y);ctx.restore()}else if(layer.type==='text'){ctx.save();ctx.shadowColor='#000b';ctx.shadowBlur=10;ctx.strokeStyle='#120c1299';ctx.lineWidth=9;ctx.font='bold 44px system-ui,sans-serif';const words=String(layer.value).match(/.{1,23}(?:\s|$)|.{1,23}/g)||[layer.value];words.slice(0,5).forEach((line,i)=>{const pos=layer.y+i*52;ctx.strokeText(line.trim(),layer.x,pos,500);ctx.fillStyle='#ffe6ad';ctx.fillText(line.trim(),layer.x,pos,500)});ctx.restore()}}
  if(!source.length&&!layers.length){ctx.fillStyle='#ffe0a3';ctx.font='600 32px system-ui';ctx.fillText('Your story begins here',270,480)}
 };
 const dispose=()=>{for(const row of source){try{row.image?.close?.()}catch{};if(row.url)win.URL.revokeObjectURL(row.url)}source=[]};
 const load=async (inputFiles)=>{
  const rows=validateStoryStudioFiles(inputFiles),seq=++epoch;
  status.textContent='Preparing your photos…';const loaded=[];
  try{
   for(const file of rows){let img,url=null;
    if(typeof win.createImageBitmap==='function'){img=await win.createImageBitmap(file)}
    else {if(!win.URL?.createObjectURL)throw Error('Photo decoding is unavailable on this device.');url=win.URL.createObjectURL(file);img=await new Promise((resolve,reject)=>{const image=new win.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('This photo cannot be opened.'));image.src=url})}
    if(img.width*img.height>14000000){try{img.close?.()}catch{}if(url)win.URL.revokeObjectURL(url);throw Error('Photo is too large for a stable mobile edit. Choose an image under 14 megapixels.')}
    loaded.push({image:img,url});if(seq!==epoch)break;
   }
   if(seq!==epoch||!getUser()){for(const row of loaded){row.image?.close?.();if(row.url)win.URL.revokeObjectURL(row.url)}return}
   dispose();source=loaded;paint();status.textContent=source.length+' photos loaded. Drag on the canvas to draw or place decorations.';
  }catch(err){for(const row of loaded){row.image?.close?.();if(row.url)win.URL.revokeObjectURL(row.url)}if(seq===epoch)status.textContent=err.message||'Could not load photo.'}
 };
 function open(){if(!getUser())return;try{ctx=canvas.getContext('2d',{alpha:false})}catch{ctx=null}prepared=null;const first=getSourceFile?.();layout.value='single';theme.value='gold';filter.value='none';tool.value='draw';mode='draw';layers=[];dispose();paint();status.textContent='Your Story is private until you share it.';files.value='';dialog.showModal();if(first&&['image/jpeg','image/png','image/webp'].includes(first.type))load([first]).catch(e=>{status.textContent=e.message})}
 function closeStudio(){epoch++;dispose();drag=null;if(dialog.open)dialog.close()}
 close.onclick=closeStudio;dialog.addEventListener('close',()=>{epoch++;dispose();drag=null});
 files.onchange=()=>load(files.files).catch(e=>{status.textContent=e.message||'Could not import photos.'});
 for(const node of [layout,theme,filter])node.onchange=paint;
 tool.onchange=()=>{mode=tool.value;status.textContent=mode==='sticker'?'Tap a position on the story to add your sticker.':mode==='move'?'Drag a caption or sticker to move it.':'Draw using your finger or mouse.'};
 function coords(e){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(540,(e.clientX-r.left)/Math.max(1,r.width)*540)),y:Math.max(0,Math.min(960,(e.clientY-r.top)/Math.max(1,r.height)*960))}}
 canvas.addEventListener('pointerdown',e=>{if(!dialog.open)return;const p=coords(e);if(mode==='sticker'){layers.push({type:'sticker',value:sticker.value,x:p.x,y:p.y});paint();return}if(mode==='draw'){const layer={type:'stroke',color:color.value,width:Number(thickness.value),points:[p]};layers.push(layer);drag={type:'stroke',layer}}else{const layer=[...layers].reverse().find(l=>(l.type==='text'||l.type==='sticker')&&Math.hypot(l.x-p.x,l.y-p.y)<125);if(layer)drag={type:'move',layer,dx:layer.x-p.x,dy:layer.y-p.y}}if(drag){try{canvas.setPointerCapture(e.pointerId)}catch{}}paint()});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const p=coords(e);if(drag.type==='stroke'){if(drag.layer.points.length<320)drag.layer.points.push(p)}else {drag.layer.x=p.x+drag.dx;drag.layer.y=p.y+drag.dy}paint()});
 const release=()=>{drag=null};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
 add.onclick=()=>{const val=caption.value.trim();if(!val)return;layers.push({type:'text',value:val,x:270,y:source.length?720:480});caption.value='';paint();status.textContent='Caption added. Choose Move to reposition it.'};
 undo.onclick=()=>{layers.pop();paint()};
 clear.onclick=()=>{layers=[];paint();status.textContent='Decorations cleared.'};
 save.onclick=async()=>{if(pending||!getUser())return;pending=true;save.disabled=true;const seq=epoch;status.textContent='Creating your finished story…';try{if(!ctx)throw Error('Canvas graphics are unavailable on this device.');const blob=await new Promise((resolve,reject)=>canvas.toBlob?canvas.toBlob(b=>b?resolve(b):reject(Error('Image export failed.')),'image/png'):reject(Error('Image export unsupported.')));if(seq!==epoch||!getUser()||!dialog.open)return;if(!blob.size||blob.size>50*1024*1024)throw Error('Finished image is too large. Remove some photos and retry.');const file=new win.File([blob],'luo-story-'+Date.now()+'.png',{type:'image/png'});prepared=file;onApply(file);closeStudio();note('Story design ready. Choose who can see it, then tap Share for 24 hours.')}catch(e){if(seq===epoch)status.textContent=e.message||'Could not finish Story.'}finally{pending=false;save.disabled=false}};
 return {open,file(){return prepared},clear(){prepared=null},signedOut(){epoch++;prepared=null;layers=[];closeStudio()},dialog,canvas};
}

// Local previews only. Nothing is uploaded until the existing Publish form succeeds.
export function mountSocialMediaPicker({win,input,host,kind='photos'}){
 const doc=win.document,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const root=el('section','luo-media-picker'),grid=el('div','luo-media-preview-grid'),status=el('p','luo-media-selection-status');status.setAttribute('role','status');
 const hint=el('p','luo-media-picker-hint',kind==='video'?'Preview your vertical clip before publishing. Up to 90 seconds.':'Add up to six photos. Remove any you do not want to share.');
 root.append(grid,hint,status);if(host.tagName==='LABEL')host.after(root);else host.append(root);input.classList.add('luo-social-file-picker');
 let files=null,disposed=false,generation=0;const urls=new Set();
 function clear(){generation++;for(const video of grid.querySelectorAll('video')){video.onloadedmetadata=video.onerror=null;video.pause();video.removeAttribute('src');video.load()}grid.replaceChildren();for(const url of urls)win.URL.revokeObjectURL(url);urls.clear()}
 function render(){
  clear();if(disposed)return;const ticket=generation,chosen=files||[];status.classList.remove('is-error');
  const valid=kind==='video'?chosen.length===1&&['video/mp4','video/webm'].includes(chosen[0]?.type)&&chosen[0].size>0&&chosen[0].size<=50*1024*1024:chosen.length<=6&&chosen.every(f=>['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size>0&&f.size<=8*1024*1024)&&chosen.reduce((n,f)=>n+f.size,0)<=20*1024*1024;
  if(chosen.length&&!valid){status.textContent=kind==='video'?'Choose one MP4 or WebM video up to 50 MB.':'Use up to six JPG, PNG or WebP photos, 8 MB each and 20 MB total.';status.classList.add('is-error');return}
  status.textContent=chosen.length?chosen.length+' '+(kind==='video'?'video':'photo'+(chosen.length===1?'':'s'))+' selected · only uploaded when you publish.':'No media selected.';
  for(const [index,file]of chosen.entries()){
   const tile=el('div','luo-media-preview-tile'+(kind==='video'?' is-video':'')),remove=el('button','luo-media-remove','×');remove.type='button';remove.setAttribute('aria-label','Remove '+(kind==='video'?'video':'photo '+(index+1)));
   remove.onclick=event=>{event.preventDefault();event.stopPropagation();if(disposed||ticket!==generation)return;files.splice(index,1);if(!files.length)input.value='';else if(win.DataTransfer)try{const transfer=new win.DataTransfer();for(const selected of files)transfer.items.add(selected);input.files=transfer.files}catch{}render()};
   if(win.URL.createObjectURL){const url=win.URL.createObjectURL(file);urls.add(url);
    if(kind==='video'){const video=el('video');video.controls=true;video.playsInline=true;video.muted=true;video.preload='metadata';video.src=url;video.setAttribute('aria-label','Selected clip preview');video.onloadedmetadata=()=>{if(disposed||ticket!==generation)return;const seconds=video.duration;if(!Number.isFinite(seconds)||seconds<=0||seconds>90){status.textContent='Choose a video between 1 and 90 seconds.';status.classList.add('is-error')}else status.textContent=Math.ceil(seconds)+' sec · '+(file.size/1048576).toFixed(1)+' MB · ready to publish.'};video.onerror=()=>{if(!disposed&&ticket===generation){status.textContent='This video cannot be previewed on this device. Choose a supported MP4 or WebM.';status.classList.add('is-error')}};tile.append(video)}
    else{const image=el('img');image.src=url;image.alt='Selected photo '+(index+1);tile.append(image)}
   }else tile.append(el('span','',file.name));
   tile.append(remove);grid.append(tile)
  }
 }
 const changed=()=>{if(disposed)return;files=Array.from(input.files||[]);render()};input.addEventListener('change',changed);render();
 return {getFiles:()=>files===null?Array.from(input.files||[]):[...files],dispose(){if(disposed)return;disposed=true;input.removeEventListener('change',changed);clear();files=[];root.remove()}};
}

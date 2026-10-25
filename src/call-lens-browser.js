import {CALL_EFFECTS} from './call-effects.js';
// Thumbnails are local camera snapshots processed by the same preset, never stock AR imagery.
export function installCallLensBrowser({win,sheet,rail,getStream,isCurrent,prefix='call'}){
 const doc=win.document,favorites=new Set();let source=null,timer=null,generation=0;
 const browse=doc.createElement('button');browse.type='button';browse.id=prefix+'BrowseEffects';browse.textContent='Browse effects';browse.setAttribute('aria-expanded','false');
 const favorite=doc.createElement('button');favorite.type='button';favorite.id=prefix+'FavoriteEffect';favorite.textContent='Favorite selected';
 const search=doc.createElement('input');search.type='search';search.id=prefix+'EffectSearch';search.placeholder='Search bundled effects';search.setAttribute('aria-label','Search bundled effects');search.hidden=true;
 const category=doc.createElement('select');category.id=prefix+'EffectCategory';category.setAttribute('aria-label','Effect category');category.hidden=true;for(const [id,label] of [['all','All bundled'],['favorites','Session favorites'],['cinematic','Cinematic'],['luo','Luo Exclusive']]){const option=doc.createElement('option');option.value=id;option.textContent=label;category.append(option)}
 const bar=doc.createElement('div');bar.className='luo-lens-discovery';bar.append(browse,favorite,search,category);rail.before(bar);
 const empty=doc.createElement('p');empty.className='luo-lens-empty';empty.hidden=true;empty.textContent='No matching bundled effects.';rail.after(empty);
 for(const button of rail.children){const effect=CALL_EFFECTS.find(e=>e.id===button.dataset.effect);const canvas=doc.createElement('canvas');canvas.width=canvas.height=72;canvas.setAttribute('aria-hidden','true');const label=doc.createElement('span');label.textContent=effect.label;button.replaceChildren(canvas,label);button.title=effect.id==='original'?'Unmodified camera':'Luo Chat bundled color effect: '+effect.label;}
 function filter(){let visible=0;for(const button of rail.children){const id=button.dataset.effect,label=CALL_EFFECTS.find(e=>e.id===id).label;button.hidden=!label.toLowerCase().includes(search.value.toLowerCase())||(category.value==='favorites'&&!favorites.has(id))||(category.value==='luo'&&id!=='golden')||(category.value==='cinematic'&&['original','golden'].includes(id));if(!button.hidden)visible++;button.dataset.favorite=String(favorites.has(id))}empty.hidden=!!visible;const active=rail.querySelector('[aria-pressed="true"]');favorite.setAttribute('aria-pressed',String(favorites.has(active?.dataset.effect)));}
 browse.onclick=()=>{const expanded=sheet.classList.toggle('luo-lenses-expanded');search.hidden=category.hidden=!expanded;browse.setAttribute('aria-expanded',String(expanded));browse.textContent=expanded?'Quick carousel':'Browse effects';if(expanded)search.focus()};
 search.oninput=category.onchange=filter;
 favorite.onclick=()=>{const id=rail.querySelector('[aria-pressed="true"]')?.dataset.effect;if(!id)return;favorites.has(id)?favorites.delete(id):favorites.add(id);filter()};
 function stop(){generation++;win.clearInterval(timer);timer=null;source?.pause();if(source)source.srcObject=null;source=null;for(const canvas of rail.querySelectorAll('canvas')){canvas.width=72;canvas.height=72;}}
 function frame(){if(sheet.hidden||!isCurrent()){stop();return}if(source?.readyState<2)return;for(const button of rail.children){if(button.hidden)continue;const canvas=button.querySelector('canvas'),context=canvas.getContext('2d');if(!context)continue;const effect=CALL_EFFECTS.find(e=>e.id===button.dataset.effect);context.filter=effect.filter;const width=source.videoWidth,height=source.videoHeight;if(width&&height){const size=Math.min(width,height);context.drawImage(source,(width-size)/2,(height-size)/2,size,size,0,0,72,72)}}}
 return{
  async open(){stop();filter();const active=rail.querySelector('[aria-pressed="true"]');active?.scrollIntoView?.({block:'nearest',inline:'center'});if(!win.CanvasRenderingContext2D||!win.MediaStream)return;const seq=generation;source=doc.createElement('video');source.muted=true;source.playsInline=true;source.srcObject=new win.MediaStream(getStream()?.getVideoTracks()||[]);try{await source.play();if(seq!==generation||sheet.hidden||!isCurrent())return;frame();timer=win.setInterval(()=>{try{frame()}catch{stop()}},500)}catch{if(seq===generation)stop()}},
  selected(){filter();rail.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({block:'nearest',inline:'center'})},
  stop,clear(){stop();favorites.clear();search.value='';category.value='all';filter()}
 };
}

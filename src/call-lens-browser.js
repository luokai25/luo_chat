import {CALL_EFFECTS} from './call-effects.js';
import {CALL_AR_EFFECTS} from './call-ar-effects.js';

// Face-tracked AR lenses are real (drawn into the outgoing WebRTC canvas), but
// miniatures are badges until the on-device model is selected. No fake previews.
const ALL=[...CALL_EFFECTS,...CALL_AR_EFFECTS];
export function installCallLensBrowser({win,sheet,rail,getStream,isCurrent,prefix='call'}){
 const doc=win.document,favorites=new Set();let source=null,timer=null,generation=0;
 const browse=doc.createElement('button');browse.type='button';browse.id=prefix+'BrowseEffects';browse.textContent='Browse effects';browse.setAttribute('aria-expanded','false');
 const favorite=doc.createElement('button');favorite.type='button';favorite.id=prefix+'FavoriteEffect';favorite.textContent='Favorite selected';
 const search=doc.createElement('input');search.type='search';search.id=prefix+'EffectSearch';search.placeholder='Search 240 AR lenses and color effects';search.setAttribute('aria-label','Search bundled effects');search.hidden=true;
 const category=doc.createElement('select');category.id=prefix+'EffectCategory';category.setAttribute('aria-label','Effect category');category.hidden=true;
 for(const [id,label] of [['all','All effects'],['favorites','Session favorites'],['cinematic','Cinematic colors'],['luo','Luo Gold'],['ar','240 face-tracked AR'],['fantasy','Fantasy masks'],['animal','Animal ears'],['party','Fun and celebration'],['tech','Cyber and sci-fi']]){const option=doc.createElement('option');option.value=id;option.textContent=label;category.append(option)}
 const bar=doc.createElement('div');bar.className='luo-lens-discovery';bar.append(browse,favorite,search,category);rail.before(bar);
 const empty=doc.createElement('p');empty.className='luo-lens-empty';empty.hidden=true;empty.textContent='No matching bundled effects.';rail.after(empty);
 const group=(effect,selection)=>selection==='favorites'?favorites.has(effect.id):
  selection==='luo'?effect.id==='golden':
  selection==='cinematic'?effect.kind!=='ar'&&!['original','golden'].includes(effect.id):
  selection==='ar'?effect.kind==='ar':
  selection==='animal'?['cat','fox','bunny','dragon'].includes(effect.theme):
  selection==='fantasy'?['crown','halo','devil','dragon','flower','butterfly','snow'].includes(effect.theme):
  selection==='party'?['party','stars','comic','glasses','mustache','beard'].includes(effect.theme):
  selection==='tech'?['space','robot','cyber','pirate'].includes(effect.theme):true;
 for(const button of rail.children){
  const effect=ALL.find(e=>e.id===button.dataset.effect);if(!effect)continue;
  const canvas=doc.createElement('canvas');canvas.width=canvas.height=72;canvas.setAttribute('aria-hidden','true');
  const label=doc.createElement('span');label.textContent=effect.label;button.replaceChildren(canvas,label);
  button.title=effect.kind==='ar'?'Face-tracked overlay: '+effect.label+'. Downloads the model only when selected.':
   effect.id==='original'?'Unmodified camera':'Color effect: '+effect.label;
  if(effect.kind==='ar'){button.dataset.ar='true';const mark=doc.createElement('small');mark.textContent='AR';mark.setAttribute('aria-hidden','true');button.append(mark);
   const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#1e1c26';ctx.fillRect(0,0,72,72);ctx.fillStyle=effect.color;ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.fillText('AR',36,40)}}
 }
 function filter(){
  const expanded=sheet.classList.contains('luo-lenses-expanded'),needle=search.value.trim().toLowerCase();let count=0,visible=0;
  for(const button of rail.children){const id=button.dataset.effect,effect=ALL.find(e=>e.id===id);
   if(!effect)continue;
   const candidate=effect.label.toLowerCase().includes(needle)&&group(effect,category.value);
   const isSelected=button.getAttribute('aria-pressed')==='true';
   button.hidden=!candidate||(!expanded&&count>=14&&!isSelected);
   if(candidate)count++;if(!button.hidden)visible++;button.dataset.favorite=String(favorites.has(id))
  }
  empty.hidden=!!visible;const active=rail.querySelector('[aria-pressed="true"]');favorite.setAttribute('aria-pressed',String(favorites.has(active?.dataset.effect)));
 }
 browse.onclick=()=>{const expanded=sheet.classList.toggle('luo-lenses-expanded');search.hidden=category.hidden=!expanded;browse.setAttribute('aria-expanded',String(expanded));browse.textContent=expanded?'Quick carousel':'Browse effects';filter();if(expanded)search.focus()};
 search.oninput=category.onchange=filter;
 favorite.onclick=()=>{const id=rail.querySelector('[aria-pressed="true"]')?.dataset.effect;if(!id)return;favorites.has(id)?favorites.delete(id):favorites.add(id);filter()};
 function stop(){generation++;win.clearInterval(timer);timer=null;source?.pause();if(source)source.srcObject=null;source=null;for(const canvas of rail.querySelectorAll('button:not([data-ar]) canvas')){canvas.width=72;canvas.height=72}}
 function frame(){
  if(sheet.hidden||!isCurrent()){stop();return}if(source?.readyState<2)return;
  let done=0;
  for(const button of rail.children){if(button.hidden||button.dataset.ar==='true'||++done>12)continue;
   const canvas=button.querySelector('canvas'),context=canvas?.getContext('2d');
   if(!context)continue;const effect=CALL_EFFECTS.find(e=>e.id===button.dataset.effect);if(!effect)continue;
   context.filter=effect.filter;const width=source.videoWidth,height=source.videoHeight;
   if(width&&height){const size=Math.min(width,height);context.drawImage(source,(width-size)/2,(height-size)/2,size,size,0,0,72,72)}
  }
 }
 return{
  async open(){stop();filter();const active=rail.querySelector('[aria-pressed="true"]');active?.scrollIntoView?.({block:'nearest',inline:'center'});if(!win.CanvasRenderingContext2D||!win.MediaStream)return;
   const seq=generation;source=doc.createElement('video');source.muted=true;source.playsInline=true;source.srcObject=new win.MediaStream(getStream()?.getVideoTracks()||[]);
   try{await source.play();if(seq!==generation||sheet.hidden||!isCurrent())return;frame();timer=win.setInterval(()=>{try{frame()}catch{stop()}},750)}catch{if(seq===generation)stop()}
  },
  selected(){filter();rail.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({block:'nearest',inline:'center'})},
  stop,clear(){stop();favorites.clear();search.value='';category.value='all';sheet.classList.remove('luo-lenses-expanded');search.hidden=category.hidden=true;filter()}
 };
}

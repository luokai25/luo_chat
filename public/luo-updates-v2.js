/* Luo Updates V2. Native story reads, signed links, upload and reactions remain authoritative. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),app=document.querySelector('.app'),chats=$('chats'),feed=$('storyFeed'),stories=$('storiesDialog'),newStory=$('newStory'),source=$('openStories');
 if(!app||!chats||!feed||!stories||!newStory||!source)return;
 const el=(tag,cls,value)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=String(value);return x};
 const button=(cls,label,fn,aria)=>{const x=el('button',cls,label);x.type='button';if(aria)x.setAttribute('aria-label',aria);x.addEventListener('click',fn);return x};
 const signedIn=()=>app.dataset.screen==='home'||app.dataset.screen==='room';
 let active=false,cards=[],current=null,index=-1,stamp=0,interval=null,timeLeft=7000,duration=7000,lastTime=0,paused=false,sending=false;
 const page=el('section','luo-status-v2');page.id='luoUpdatesV2';page.hidden=true;page.setAttribute('aria-label','Updates');
 const header=el('header','luo-status-v2-header');header.append(el('h1','','Updates'));
 const search=el('input','luo-status-v2-search');search.type='search';search.placeholder='Search updates';search.setAttribute('aria-label','Search status updates');search.hidden=true;
 const options=el('div','luo-status-v2-menu');options.hidden=true;
 header.append(button('luo-status-icon','⌕',()=>{search.hidden=!search.hidden;if(!search.hidden)search.focus()},'Search updates'),button('luo-status-icon','⋮',()=>options.hidden=!options.hidden,'Updates options'));
 options.append(button('','Refresh',()=>{options.hidden=true;refresh()}),button('','Story privacy',()=>{options.hidden=true;compose('text')}));
 const rail=el('div','luo-status-v2-rail');rail.id='luoUpdatesV2Rail';rail.setAttribute('aria-label','Status updates');
 const empty=el('p','luo-status-v2-empty','Your contacts’ statuses appear here.');empty.setAttribute('role','status');
 const tools=el('div','luo-status-v2-actions');
 tools.append(button('luo-status-v2-pencil','✎',()=>compose('text'),'Create text status'),button('luo-status-v2-camera','▣',()=>compose('media'),'Create photo or video status'));
 page.append(header,options,search,el('h2','luo-status-v2-section','Status'),rail,empty,tools);chats.append(page);
 const viewer=el('dialog','luo-status-v2-viewer');viewer.id='luoUpdatesV2Viewer';
 const progress=el('div','luo-status-v2-progress'),head=el('header','luo-status-v2-vhead'),avatar=el('span','luo-status-v2-avatar','L'),idLabel=el('div','luo-status-v2-who'),name=el('strong','','Status'),age=el('small','','');
 idLabel.append(name,age);
 const popup=el('div','luo-status-v2-view-menu');popup.hidden=true;
 head.append(avatar,idLabel,button('luo-status-icon','⋮',()=>popup.hidden=!popup.hidden,'Story options'),button('luo-status-icon','✕',closeViewer,'Close status'));
 const media=el('div','luo-status-v2-media'),caption=el('p','luo-status-v2-caption'),message=el('p','luo-status-v2-view-message');message.setAttribute('role','status');
 const footer=el('footer','luo-status-v2-footer'),reply=el('form','luo-status-v2-reply'),replyInput=el('input');replyInput.type='text';replyInput.maxLength=10000;replyInput.placeholder='Reply to status';replyInput.setAttribute('aria-label','Reply to status');
 const send=el('button','luo-status-v2-send','➤');send.type='submit';send.setAttribute('aria-label','Send status reply');reply.append(replyInput,send);
 const drawer=el('div','luo-status-v2-reactions');drawer.hidden=true;const reactToggle=button('luo-status-v2-react','♡',()=>drawer.hidden=!drawer.hidden,'React to status');
 for(const emoji of ['❤️','👍','😂','🎉','😮','😢'])drawer.append(button('luo-status-v2-emoji',emoji,()=>react(emoji),'React '+emoji));
 footer.append(reply,reactToggle,drawer);
 const back=button('luo-status-v2-hit luo-status-v2-hit-back','',()=>move(-1),'Previous status'),next=button('luo-status-v2-hit luo-status-v2-hit-next','',()=>move(1),'Next status');
 viewer.append(progress,head,popup,media,caption,message,back,next,footer);document.body.append(viewer);
 const live=()=>[...feed.querySelectorAll(':scope > .story-card')].filter(x=>x.isConnected&&(!x.dataset.storyExpires||Date.parse(x.dataset.storyExpires)>Date.now()));
 const title=x=>(x?.dataset.storyOwnerName||x?.querySelector('h3')?.textContent?.split(' · ')[0]||'Luo friend').trim().slice(0,80);
 const body=x=>(x?.querySelector('p')?.textContent||'').slice(0,2000);
 const mediaButton=x=>[...x.querySelectorAll('button')].find(b=>b.textContent.trim()==='Open story media');
 function repaint(){
  cards=live();rail.replaceChildren();const query=search.value.trim().toLowerCase();let visible=0;
  const mine=cards.find(x=>x.dataset.storyOwn==='true');
  const own=button('luo-status-v2-tile luo-status-v2-my','',()=>mine?view(cards.indexOf(mine)):compose('text'),'My status');
  own.append(el('span','luo-status-v2-tile-art luo-status-v2-my-art','L'),el('span','luo-status-v2-label','My status'),el('span','luo-status-v2-plus','+'));rail.append(own);
  cards.forEach((card,i)=>{
   if(card.dataset.storyOwn==='true'||(query&&!(title(card)+' '+body(card)).toLowerCase().includes(query)))return;
   const item=button('luo-status-v2-tile','',()=>view(i),'View status from '+title(card));
   item.dataset.storyId=card.dataset.storyId||'';
   const art=el('span','luo-status-v2-tile-art');art.style.setProperty('--status-hue',String(i*37%260)+'deg');
   art.append(el('span','luo-status-v2-initial',title(card)[0]?.toUpperCase()||'L'),el('span','luo-status-v2-excerpt',body(card)||(mediaButton(card)?'Photo or video':'Status')));
   item.append(art,el('span','luo-status-v2-label',title(card)));rail.append(item);visible++;
  });
  empty.hidden=visible>0;empty.textContent=query?'No matching statuses.':'Your contacts’ statuses appear here.';
  if(current&&!current.isConnected)closeViewer();
 }
 new MutationObserver(repaint).observe(feed,{childList:true,subtree:true});search.addEventListener('input',repaint);
 function refresh(){
  if(!signedIn())return;
  if(typeof source.onclick==='function')void source.onclick();else source.click();
  if(stories.open)stories.close();
  repaint();
 }
 function compose(mode){
  if(!signedIn())return;
  if(typeof newStory.onclick==='function')void newStory.onclick();else newStory.click();
  window.LuoDeepPagesV3?.storyMode?.(mode);
  if(mode==='text')$('storyBody')?.focus();
  if(mode==='media')$('storyMedia')?.click();
 }
 function open(){
  if(!signedIn())return;
  if(app.dataset.screen==='room')$('back')?.click();
  if(app.dataset.tab!=='chats')document.querySelector('.workspace-nav [data-tab="chats"]')?.click();
  app.classList.remove('luo-status-page','luo-community-page','luo-calls-open');
  page.hidden=false;app.classList.add('luo-updates-v2-open');active=true;
  for(const n of document.querySelectorAll('#luoApprovedNav button[data-target]'))n.setAttribute('aria-current',String(n.dataset.target==='updates'?'page':'false'));
  refresh();
 }
 function hide(){active=false;page.hidden=true;app.classList.remove('luo-updates-v2-open');options.hidden=true;search.hidden=true;search.value='';closeViewer()}
 function stop(){if(interval!==null)clearInterval(interval);interval=null}
 function clearMedia(){for(const x of media.querySelectorAll('video,audio')){x.pause();x.removeAttribute('src');x.load?.()}media.replaceChildren()}
 function closeViewer(){stamp++;stop();clearMedia();index=-1;current=null;if(viewer.open)viewer.close();replyInput.value='';drawer.hidden=true;popup.hidden=true;message.textContent=''}
 viewer.addEventListener('close',()=>{if(index>=0)closeViewer()});
 const paintProgress=()=>{[...progress.children].forEach((x,i)=>x.firstChild.style.width=(i<index?'100':i>index?'0':String(Math.max(0,Math.min(100,100*(1-timeLeft/duration)))))+'%')};
 function timer(ms){
  stop();duration=ms;timeLeft=ms;lastTime=Date.now();paused=false;paintProgress();
  interval=setInterval(()=>{if(!viewer.open||document.hidden||paused){lastTime=Date.now();return}let now=Date.now();timeLeft-=Math.max(0,now-lastTime);lastTime=now;paintProgress();if(timeLeft<=0)move(1)},90);
 }
 function move(n){if(n===0)return;const to=index+n;if(to<0||to>=cards.length){closeViewer();return}view(to)}
 async function signedMedia(card,token){
  const button=mediaButton(card);if(!button)return null;
  for(const m of card.querySelectorAll('.story-media')){m.removeAttribute('src');m.remove()}
  button.click();const started=Date.now();while(Date.now()-started<9000){if(token!==stamp||!viewer.open||!card.isConnected)return null;const el=card.querySelector('.story-media');if(el)return el;await new Promise(ok=>setTimeout(ok,130))}return null;
 }
 async function view(i){
  const currentCards=live();if(i<0||i>=currentCards.length){closeViewer();return}cards=currentCards;index=i;current=cards[i];const card=current,token=++stamp;stop();clearMedia();replyInput.value='';drawer.hidden=true;popup.hidden=true;
  name.textContent=title(card);avatar.textContent=title(card)[0]?.toUpperCase()||'L';age.textContent=card.querySelector('h3')?.textContent?.split(' · ').slice(1).join(' · ')||'';
  caption.textContent=body(card);message.textContent='';
  progress.replaceChildren(...cards.map(()=>{const bar=el('span','luo-status-v2-bar');bar.append(el('i'));return bar}));
  back.disabled=i===0;next.disabled=i===cards.length-1;
  const own=card.dataset.storyOwn==='true';reply.hidden=own||!card.dataset.storyUsername;reactToggle.hidden=own;
  popup.replaceChildren();
  if(own){for(const [text,label] of [['Private reactions','View reactions'],['Delete my story','Delete status']]){const original=[...card.querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(original)popup.append(button('',label,()=>{popup.hidden=true;original.click()}))}}
  if(!viewer.open)viewer.showModal();timer(7000);
  if(!mediaButton(card))return;
  paused=true;message.textContent='Opening private media…';const original=await signedMedia(card,token);
  if(token!==stamp||!viewer.open)return;
  if(!original){message.textContent='Media unavailable or expired.';timer(7000);return}
  message.textContent='';const tag=original.tagName.toLowerCase(),copy=el(tag==='video'?'video':tag==='audio'?'audio':'img');
  copy.src=original.src;if(tag==='img')copy.alt='Status from '+title(card);else{copy.controls=true;copy.preload='metadata';if(tag==='video')copy.playsInline=true}
  media.append(copy);
  if(tag==='img')timer(7000);else{timer(55000);copy.addEventListener('ended',()=>{if(token===stamp)move(1)},{once:true});copy.play().catch(()=>{message.textContent='Tap Play to watch.'})}
 }
 function react(emoji){
  if(!viewer.open||!current||current.dataset.storyOwn==='true')return;
  const native=[...current.querySelectorAll('button')].find(b=>b.textContent.trim()===emoji);
  if(!native){message.textContent='Reaction unavailable.';return}native.click();drawer.hidden=true;message.textContent='Reaction requested.';
 }
 reply.addEventListener('submit',e=>{
  e.preventDefault();if(sending||!current)return;
  const username=current.dataset.storyUsername||'',body=replyInput.value.trim();
  if(!body||!/^[a-z0-9_]{3,24}$/.test(username)){message.textContent='Unable to reply to this status.';return}
  sending=true;send.disabled=true;
  window.dispatchEvent(new CustomEvent('luo:status-reply',{detail:{username,body,storyId:current.dataset.storyId||''}}));
  hide();sending=false;send.disabled=false;
 });
 let touchX=0,touchY=0,touchAt=0;
 viewer.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,video,audio,form'))return;touchX=e.clientX;touchY=e.clientY;touchAt=Date.now();paused=true});
 viewer.addEventListener('pointerup',e=>{if(!touchAt)return;const dx=e.clientX-touchX,dy=e.clientY-touchY,held=Date.now()-touchAt;touchAt=0;paused=false;lastTime=Date.now();if(dy< -70){drawer.hidden=false;return}if(Math.abs(dx)>60){move(dx<0?1:-1);return}if(held<400){const x=e.clientX/window.innerWidth;move(x<.33?-1:x>.68?1:0)}});
 viewer.addEventListener('pointercancel',()=>{touchAt=0;paused=false;lastTime=Date.now()});
 document.addEventListener('keydown',e=>{if(!viewer.open)return;if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1)});
 new MutationObserver(()=>{if(app.dataset.screen==='auth'||(active&&app.dataset.tab!=='chats'))hide()}).observe(app,{attributes:true,attributeFilter:['data-screen','data-tab']});
 window.LuoUpdatesV2={open,hide,active:()=>active,refresh};
})();

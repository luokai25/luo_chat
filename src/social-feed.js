import {renderConversationAvatar} from './avatars.js';
import {SUPABASE_URL} from './config.js';

const paths={heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',comment:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',save:'M5 3h14v18l-7-4-7 4V3Z',play:'m9 5 11 7-11 7V5Z',sound:'m11 5-6 4H2v6h3l6 4V5Zm5 3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14',muted:'m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6',more:'M5 12h.01M12 12h.01M19 12h.01',close:'m6 6 12 12M6 18 18 6',arrow:'m9 5 7 7-7 7'};

// This is a presentation layer over the existing authorization-aware RPC.
// Public additionally excludes non-public rows; the client never grants visibility.
export function mountSocialFeed({win,db,getUser,output,note,openPerson,mode='friends',clipsOnly=false,onNavigate,onMode,initialClip=null}){
 const doc=win.document,owner=getUser()?.id;
 let disposed=false,loading=false,activeCard=null,allowPlayback=clipsOnly,muted=true;
 const timers=new Set();
 const later=(fn,ms)=>{const id=win.setTimeout(()=>{timers.delete(id);fn()},ms);timers.add(id);return id};
 const cancel=id=>{win.clearTimeout(id);timers.delete(id)};
 const valid=()=>!disposed&&!!owner&&getUser()?.id===owner&&root.isConnected;
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
 const icon=name=>{const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=doc.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.more);svg.append(p);return svg};
 function button(text,fn,cls='luo-feed-icon',symbol){const b=el('button',cls);b.type='button';b.setAttribute('aria-label',text);b.title=text;if(symbol)b.append(icon(symbol));b.append(el('span','',text));b.onclick=async()=>{if(b.disabled||!valid())return;b.disabled=true;try{await fn(b)}catch(e){if(valid())note(e.message||'Please try again.')}finally{if(valid())b.disabled=false}};return b}
 function deadline(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=win.setTimeout(()=>reject(Error('Connection timed out. Try again.')),12000)})]).finally(()=>win.clearTimeout(timer))}
 async function rpc(action,input){if(!valid())throw Error('Please reopen Social.');const r=await deadline(db.rpc('luo_space',{action,input}));if(r.error)throw Error(r.error.message);return r.data}
 const root=el('section','luo-feed'+(clipsOnly?' luo-feed-reels':''));root.setAttribute('aria-label',clipsOnly?'Luo Clips':mode==='public'?'Public feed':'Friends feed');
 const list=el('div','luo-feed-list'),feedback=el('p','luo-feed-feedback');feedback.setAttribute('role','status');
 const more=button('Load more',load,'luo-feed-more');root.append(list,feedback,more);output.append(root);
 if(clipsOnly){
  const top=el('nav','luo-reels-top');top.setAttribute('aria-label','Clip navigation');
  top.append(button('Back to Social',()=>onNavigate?.('feed'),'luo-reels-back','arrow'),el('strong','','Reels'));
  for(const [value,title]of [['public','Explore'],['friends','Friends']]){const b=button(title,()=>onMode?.(value),'luo-reels-tab');b.setAttribute('aria-pressed',String(mode===value));top.append(b)}
  const create=button('Create clip',()=>onNavigate?.('publish-clip'),'luo-reels-create');create.prepend(el('b','','+'));top.append(create);root.prepend(top);
 }
 const kinds=clipsOnly?['clip']:['post','clip'];
 const streams=new Map(kinds.map(kind=>[kind,{before:null,before_id:null,more:true}]));
 const seen=new Set(),media=new Map();
 const reduced=!!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const saver=!!win.navigator.connection?.saveData;
 let observer;
 if(win.IntersectionObserver)observer=new win.IntersectionObserver(entries=>{
  if(!valid())return;
  for(const entry of entries){const state=media.get(entry.target);if(!state)continue;if(entry.isIntersecting&&entry.intersectionRatio>=.65){activeCard=entry.target;for(const [card,s]of media)if(card!==activeCard)s.video?.pause();if(allowPlayback&&!state.userPaused&&!saver&&!reduced&&!doc.hidden&&!sheet.open)state.play().catch(()=>{});const cards=[...list.children];if(cards.indexOf(entry.target)>=cards.length-2&&!more.hidden)load()}else{state.video?.pause();if(activeCard===entry.target)activeCard=null}}
 },{root:list,threshold:[0,.65]});
 const visibility=()=>{if(doc.hidden)for(const [card,s]of media){s.video?.pause();if(s.video)s.video.playbackRate=1;card.classList.remove('luo-reels-fast')}};doc.addEventListener('visibilitychange',visibility);

 async function signed(path,item){
  if(typeof path!=='string'||!path.startsWith(item.owner_id+'/'+item.id+'/')||path.includes('..'))throw Error('This media is unavailable.');
  const r=await deadline(db.storage.from('luo-social').createSignedUrl(path,300));if(r.error)throw Error(r.error.message);
  const url=new URL(r.data?.signedUrl);if(url.origin!==new URL(SUPABASE_URL).origin||!url.pathname.startsWith('/storage/v1/object/sign/luo-social/'))throw Error('Unexpected media host');return url.href;
 }
 function date(value){const d=new Date(value);return Number.isFinite(d.valueOf())?d.toLocaleDateString(undefined,{month:'short',day:'numeric'}):''}
 function updateCount(button,value,label){button.querySelector('span').textContent=String(value);button.setAttribute('aria-label',label+' · '+value)}
 function visit(id){for(const s of media.values())s.video?.pause();return openPerson?.(id)}
 function avatar(item){const author=item.author||{},b=button('View @'+(author.username||'profile'),()=>visit(author.id||item.owner_id),'luo-feed-avatar');renderConversationAvatar(b,{kind:'direct',person:author},{label:author.display_name||author.username||'L',projectUrl:SUPABASE_URL});return b}
 function card(item){
  const article=el('article','luo-feed-card luo-feed-'+item.kind);article.dataset.entryId=item.id;article.tabIndex=0;
  const author=item.author||{},head=el('header','luo-feed-author'),identity=button(author.display_name||'@'+(author.username||'Luo friend'),()=>visit(author.id||item.owner_id),'luo-feed-name');
  identity.append(el('small','','@'+(author.username||'luo')+' · '+date(item.created_at)));head.append(avatar(item),identity);
  if(item.owner_id===owner)head.append(button('Delete post',async()=>{if(!win.confirm('Permanently delete this '+item.kind+'?'))return;await rpc('entry.delete',{id:item.id});if(!valid())return;media.get(article)?.video?.pause();observer?.unobserve(article);media.delete(article);article.remove()},'luo-feed-icon luo-feed-delete','close'));
  const stage=el('div','luo-feed-stage');stage.append(el('span','luo-feed-watermark','LUO'));
  const content=el('div','luo-feed-caption');if(item.title)content.append(el('h3','',item.title));if(item.body&&(item.kind==='clip'||item.media?.length)){const text=el('p','luo-feed-body',item.body);content.append(text);if(item.body.length>240){text.classList.add('luo-feed-clamped');content.append(button('Read more',b=>{text.classList.toggle('luo-feed-clamped');b.querySelector('span').textContent=text.classList.contains('luo-feed-clamped')?'Read more':'Show less'},'luo-feed-read'))}}
  if(item.kind==='post'&&!item.media?.length){stage.classList.add('luo-feed-text-stage');stage.append(el('span','luo-feed-quote','“'),el('p','luo-feed-text',item.body||item.title||'A moment from '+(author.username||'a friend')))}
  const footer=el('div','luo-feed-footer'),actions=el('div','luo-feed-actions');
  let liked=!!item.mine?.reaction,saved=!!item.mine?.save,count=Number(item.reactions)||0,comments=Number(item.comments)||0;
  const love=button('Love',async b=>{const next=!liked;await rpc('response',{id:item.id,kind:'reaction',body:next?'Love':'',operation:win.crypto.randomUUID()});if(!valid())return;count=Math.max(0,count+(next?1:-1));liked=next;b.setAttribute('aria-pressed',String(liked));updateCount(b,count,'Love')},'luo-feed-icon','heart');love.setAttribute('aria-pressed',String(liked));updateCount(love,count,'Love');
  const comment=button('Comments',()=>openComments(item,()=>{comments++;updateCount(comment,comments,'Comments')}),'luo-feed-icon','comment');updateCount(comment,comments,'Comments');
  const save=button('Save',async b=>{const next=!saved;await rpc('response',{id:item.id,kind:'save',body:next?'saved':'',operation:win.crypto.randomUUID()});if(!valid())return;saved=next;b.setAttribute('aria-pressed',String(saved));b.setAttribute('aria-label',saved?'Unsave':'Save');b.title=saved?'Unsave':'Save'},'luo-feed-icon','save');save.setAttribute('aria-pressed',String(saved));
  actions.append(love,comment,save);
  if(item.kind==='clip'){
   const share=button('Share clip',()=>openShare(item),'luo-feed-icon','arrow');share.querySelector('path').setAttribute('d','m22 2-7 20-4-9-9-4 20-7Zm0 0L11 13');actions.append(share,button('More options',()=>openOptions(item),'luo-feed-icon','more'));
   content.append(el('p','luo-reels-audio','♫ Original audio · @'+(author.username||'creator')));
  }
  footer.append(actions,content);
  article.append(head,stage,footer);list.append(article);
  if(item.kind==='clip'){
   const play=button('Play clip',()=>{allowPlayback=true;return state.play()},'luo-feed-play','play');stage.append(play);
   const sound=button('Unmute',b=>{muted=!muted;for(const s of media.values())if(s.video)s.video.muted=muted;for(const b of list.querySelectorAll('.luo-feed-sound')){b.replaceChildren(icon(muted?'muted':'sound'),el('span','',muted?'Unmute':'Mute'));b.setAttribute('aria-label',muted?'Unmute':'Mute')}},'luo-feed-icon luo-feed-sound','muted');stage.append(sound);
   const hint=el('span','luo-feed-clip-label',mode==='public'?'PUBLIC · LUO CLIPS':'FRIENDS · LUO CLIPS');stage.append(hint);
   const seek=el('input','luo-reels-seek');seek.type='range';seek.min='0';seek.max='100';seek.step='.1';seek.value='0';seek.disabled=true;seek.setAttribute('aria-label','Seek clip');stage.append(seek);
   seek.oninput=()=>{const v=state.video;if(v&&Number.isFinite(v.duration)&&v.duration>0)v.currentTime=v.duration*Number(seek.value)/100};
   const state={video:null,pending:false,userPaused:false,async play(){if(state.pending||!valid()||!article.isConnected||doc.hidden||sheet.open)return;state.pending=true;activeCard=article;play.disabled=true;try{
    if(!state.video){const url=await signed(item.media?.[0]?.path,item);if(!valid()||!article.isConnected||activeCard!==article||doc.hidden)return;const video=el('video');video.loop=true;video.playsInline=true;video.muted=muted;video.preload='metadata';video.src=url;video.setAttribute('aria-label',item.body||'Luo Clip');state.video=video;stage.prepend(video);
     video.ontimeupdate=()=>{if(!valid())return;seek.disabled=!(Number.isFinite(video.duration)&&video.duration>0);if(!seek.disabled){seek.value=String(video.currentTime/video.duration*100);seek.setAttribute('aria-valuetext',Math.floor(video.currentTime)+' of '+Math.floor(video.duration)+' seconds')}};
     video.onloadedmetadata=()=>{seek.disabled=!(Number.isFinite(video.duration)&&video.duration>0)};
     video.onplay=()=>{if(!valid()){video.pause();return}play.hidden=true};video.onpause=()=>{play.hidden=false};video.onerror=()=>{if(!valid())return;video.pause();video.removeAttribute('src');video.remove();state.video=null;play.hidden=false;play.querySelector('span').textContent='Retry clip'};
    }
    for(const [other,s]of media)if(other!==article)s.video?.pause();activeCard=article;state.userPaused=false;await state.video.play();
    // Keep at most this clip and its immediate neighbours resident in memory.
    const cards=[...media.keys()],at=cards.indexOf(article);for(const [other,s]of media)if(Math.abs(cards.indexOf(other)-at)>1)s.release?.();
   }catch(e){if(valid()){play.hidden=false;play.querySelector('span').textContent='Tap to retry';note(e.message||'Tap Play to start this clip.')}}finally{state.pending=false;if(valid())play.disabled=false}}};
   state.release=()=>{if(!state.video)return;state.video.onplay=state.video.onpause=state.video.onerror=state.video.ontimeupdate=state.video.onloadedmetadata=null;state.video.pause();state.video.removeAttribute('src');state.video.load();state.video.remove();state.video=null;play.hidden=false;seek.disabled=true;seek.value='0'};
   let tapTimer=null,holdTimer=null,holding=false,start=null;
   const surface=target=>target===stage||target?.tagName==='VIDEO';
   const toggle=()=>{if(!valid())return;if(!state.video||state.video.paused){allowPlayback=true;state.play().catch(()=>{})}else{state.userPaused=true;state.video.pause()}};
   stage.onclick=ev=>{if(!surface(ev.target)||holding)return;if(ev.detail>1){cancel(tapTimer);return}cancel(tapTimer);tapTimer=later(toggle,240)};
   stage.ondblclick=ev=>{if(!surface(ev.target)||holding)return;ev.preventDefault();cancel(tapTimer);if(!liked&&!love.disabled)love.click();const heart=el('span','luo-reels-heart','♥');heart.setAttribute('aria-hidden','true');stage.append(heart);later(()=>heart.remove(),700)};
   const resetHold=()=>{cancel(holdTimer);if(state.video)state.video.playbackRate=1;article.classList.remove('luo-reels-fast')};
   stage.onpointerdown=ev=>{if(!surface(ev.target)||ev.button>0)return;holding=false;start={x:ev.clientX,y:ev.clientY};holdTimer=later(()=>{if(state.video&&!state.video.paused){holding=true;cancel(tapTimer);state.video.playbackRate=2;article.classList.add('luo-reels-fast')}},450)};
   stage.onpointermove=ev=>{if(start&&Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>12){resetHold();start=null}};
   stage.onpointerup=()=>{resetHold();start=null;if(holding)later(()=>{holding=false},0)};stage.onpointercancel=()=>{resetHold();start=null;holding=false};stage.onpointerleave=resetHold;
   stage.append(el('span','luo-reels-fast-label','2× playback'));
   media.set(article,state);observer?.observe(article);
  }else if(item.media?.length){
   let index=0,image=null,photoRun=0;
   const photos=item.media.filter(file=>/\.(jpe?g|png|webp|gif)$/i.test(file.path||''));
   const load=button('View photo',()=>showPhoto(index),'luo-feed-play','play');stage.append(load);
   const carousel=el('div','luo-feed-carousel');
   async function showPhoto(next){
    const ticket=++photoRun,url=await signed(photos[next]?.path,item);if(!valid()||!article.isConnected||ticket!==photoRun)return;
    const img=el('img');img.alt=(item.title||'Post photo')+' · '+(next+1)+' of '+photos.length;img.src=url;
    img.onerror=()=>{if(!valid())return;img.remove();load.hidden=false;note('This photo could not load. Try again.')};
    image?.remove();image=img;stage.prepend(img);index=next;load.hidden=true;count.textContent=(index+1)+' / '+photos.length;
   }
   const count=el('span','','1 / '+photos.length);
   if(photos.length>1){carousel.append(button('Previous photo',()=>showPhoto((index+photos.length-1)%photos.length),'luo-feed-photo-nav'),count,button('Next photo',()=>showPhoto((index+1)%photos.length),'luo-feed-photo-nav'));stage.append(carousel)}
  }
 }

 const sheet=el('dialog','luo-feed-comments');sheet.setAttribute('aria-label','Comments');doc.body.append(sheet);
 let commentRun=0,resumeCard=null,sheetFocus=null;
 function closeComments(){commentRun++;if(sheet.open)sheet.close();sheet.replaceChildren()}
 sheet.addEventListener('close',()=>{commentRun++;sheet.replaceChildren();const card=resumeCard;resumeCard=null;if(valid()&&card===activeCard&&!doc.hidden)media.get(card)?.play().catch(()=>{});if(valid()&&sheetFocus?.isConnected)sheetFocus.focus()});
 function openSheet(title){
  closeComments();sheetFocus=doc.activeElement;resumeCard=activeCard&&media.get(activeCard)?.video&&!media.get(activeCard).video.paused?activeCard:null;
  for(const s of media.values())s.video?.pause();sheet.setAttribute('aria-label',title);
  const handle=el('div','luo-sheet-handle');handle.setAttribute('aria-hidden','true');
  const heading=el('div','luo-feed-sheet-head');heading.append(el('h3','',title),button('Close '+title.toLowerCase(),closeComments,'luo-feed-icon','close'));sheet.append(handle,heading);
  let startY=null;
  for(const surface of [handle,heading]){
   surface.onpointerdown=ev=>{if(ev.target.closest('button'))return;startY=ev.clientY;surface.setPointerCapture?.(ev.pointerId)};
   surface.onpointermove=ev=>{if(startY!==null)sheet.style.transform='translateY('+Math.max(0,ev.clientY-startY)+'px)'};
   surface.onpointerup=ev=>{const close=startY!==null&&ev.clientY-startY>80;startY=null;sheet.style.transform='';if(close)closeComments()};surface.onpointercancel=()=>{startY=null;sheet.style.transform=''};
  }
 }
 function clipLink(item){const url=new URL(win.location.href);url.search='';url.hash='luo-clip='+encodeURIComponent(item.id);return url.href}
 function openShare(item){
  openSheet('Share clip');const explanation=el('p','luo-feed-feedback','The recipient still needs permission to view this clip. Signed media URLs are never shared.');
  sheet.append(explanation,button('Copy link',async()=>{await win.navigator.clipboard.writeText(clipLink(item));if(valid()&&sheet.open)explanation.textContent='Link copied.'},'luo-sheet-action'));
  if(win.navigator.share)sheet.append(button('Share with another app',async()=>{try{await win.navigator.share({title:'Luo Clip',url:clipLink(item)})}catch(e){if(e.name!=='AbortError')throw e}},'luo-sheet-action'));
  sheet.showModal();
 }
 function openOptions(item){
  openSheet('Clip options');const text=el('p','luo-feed-feedback','Only the author can remove a clip. Reports are sent to the existing moderation queue.');
  const reason=el('textarea');reason.maxLength=500;reason.placeholder='Describe the problem';reason.setAttribute('aria-label','Report reason');reason.className='luo-report-reason';
  sheet.append(text,reason,button('Submit report',async()=>{const body=reason.value.trim();if(body.length<3)throw Error('Describe the problem in at least three characters.');const ticket=commentRun;await rpc('response',{id:item.id,kind:'report',body,operation:win.crypto.randomUUID()});if(valid()&&sheet.open&&ticket===commentRun){text.textContent='Report submitted.';reason.value=''}},'luo-sheet-action'));
  sheet.showModal();
 }
 async function openComments(item,onSent){
  openSheet('Comments');const ticket=++commentRun,still=()=>valid()&&sheet.open&&ticket===commentRun;
  const rows=el('div','luo-feed-comment-list'),message=el('p','luo-feed-feedback','Loading comments…');message.setAttribute('role','status');
  const f=el('form','luo-feed-comment-form'),field=el('textarea');field.placeholder='Add a comment…';field.maxLength=300;field.required=true;field.setAttribute('aria-label','Your comment');const send=el('button','','Send');send.type='submit';f.append(field,send);
  let after=null,fetching=false;const ids=new Set();
  const add=r=>{if(r.id&&ids.has(r.id))return;if(r.id)ids.add(r.id);const row=el('article','luo-feed-comment'),identity=el('div','luo-comment-identity'),initial=el('span','luo-comment-avatar',(r.username||'you').slice(0,1).toUpperCase());initial.setAttribute('aria-hidden','true');identity.append(initial,el('strong','','@'+(r.username||'you')));if(r.created_at){const time=el('time','',date(r.created_at));time.dateTime=r.created_at;identity.append(time)}row.append(identity,el('p','',r.body||''));rows.append(row)};
  const next=button('More comments',fetchComments,'luo-feed-more');next.hidden=true;sheet.append(rows,next,message,f);sheet.showModal();
  async function fetchComments(){if(fetching||!still())return;fetching=true;next.disabled=true;try{const data=await rpc('responses',{id:item.id,kind:'comment',...(after?{after}:{})});if(!still())return;const page=Array.isArray(data)?data:[];for(const r of page)add(r);const cursor=page.at(-1)?.id;next.hidden=page.length<50||!cursor||cursor===after;after=cursor;message.textContent=rows.children.length?'':'Start the conversation.'}catch(e){if(still()){message.textContent=e.message||'Comments unavailable.';next.hidden=false}}finally{fetching=false;if(still())next.disabled=false}}
  let pending=false,operation=null,draft='';
  f.onsubmit=async ev=>{ev.preventDefault();const body=field.value.trim();if(!still()||pending||!body)return;pending=true;send.disabled=true;try{if(draft!==body||!operation){draft=body;operation=win.crypto.randomUUID()}await rpc('response',{id:item.id,kind:'comment',body,operation});if(!still())return;add({body});field.value='';operation=null;message.textContent='Comment sent.';onSent()}catch(e){if(still())message.textContent=e.message||'Comment could not be sent.'}finally{pending=false;if(still())send.disabled=false}};
  await fetchComments();
 }
 async function load(){
  if(loading||!valid())return;loading=true;more.disabled=true;feedback.textContent='Finding your next moment…';
  let errors=0,added=0;const batch=[];
  await Promise.all(kinds.map(async kind=>{
   const stream=streams.get(kind);if(!stream.more)return;
   try{const data=await rpc('feed',{kind,mode,...(stream.before?{before:stream.before,before_id:stream.before_id}:{})});if(!valid())return;
    const rows=Array.isArray(data)?data:[];stream.more=rows.length===20;
    const last=rows.at(-1);if(last?.created_at&&last?.id){if(stream.before===last.created_at&&stream.before_id===last.id)stream.more=false;stream.before=last.created_at;stream.before_id=last.id}else if(rows.length)stream.more=false;
    // Both the SQL visibility predicate and this extra public-only filter apply.
    for(const item of rows){if(!item?.id||seen.has(item.id)||item.kind!==kind||item.published===false||mode==='public'&&item.audience!=='public')continue;seen.add(item.id);batch.push(item);added++}
   }catch(e){if(valid()){errors++;feedback.textContent=e.message||'Feed unavailable. Try again.'}}
  }));
  if(!valid())return;batch.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.id).localeCompare(String(a.id)));for(const item of batch)card(item);loading=false;more.disabled=false;more.hidden=![...streams.values()].some(s=>s.more);
  if(!errors)feedback.textContent=!seen.size?(mode==='public'?'No public moments yet. Be the first to share one.':'Your friends’ moments will appear here. Share your first post.'):(more.hidden?'You’re all caught up.':added?'':'No matching moments on this page. Keep exploring.');
  more.querySelector('span').textContent=errors?'Try again':'Load more';
 }
 const onKey=ev=>{if(!clipsOnly||!['ArrowDown','ArrowUp'].includes(ev.key)||/INPUT|TEXTAREA|BUTTON/.test(ev.target.tagName))return;ev.preventDefault();const cards=[...list.children],index=Math.max(0,cards.indexOf(activeCard||doc.activeElement));cards[Math.min(cards.length-1,Math.max(0,index+(ev.key==='ArrowDown'?1:-1)))]?.scrollIntoView?.({behavior:reduced?'instant':'smooth',block:'start'})};list.addEventListener('keydown',onKey);
 async function start(){if(initialClip&&/^[0-9a-f-]{36}$/i.test(initialClip)){try{const item=await rpc('entry.get',{id:initialClip});if(valid()&&item?.id&&item.kind==='clip'&&item.published!==false){seen.add(item.id);card(item)}}catch(e){if(valid())note(e.message||'This shared clip is unavailable.')}}if(valid())load()}
 start();
 return ()=>{disposed=true;for(const timer of timers)win.clearTimeout(timer);timers.clear();observer?.disconnect();doc.removeEventListener('visibilitychange',visibility);list.removeEventListener('keydown',onKey);for(const state of media.values())state.release?.();media.clear();closeComments();sheet.remove();root.remove()};
}

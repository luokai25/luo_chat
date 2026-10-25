import {renderConversationAvatar} from './avatars.js';
import {SUPABASE_URL} from './config.js';

// Optional, capability-negotiated API. Missing backend support leaves the v1 feed intact.
export function createReelFeatures({win,db,getUser,getChats=()=>[],valid,note,openSheet,sheet}){
 const doc=win.document,owner=getUser()?.id,cards=new Map();let probe=null,revision=0,closed=false;
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
 const alive=()=>!closed&&valid()&&getUser()?.id===owner;
 async function call(action,input={}){if(!alive())throw Error('Please reopen Reels.');let timer;try{const r=await Promise.race([db.rpc('luo_reels',{action,input}),new Promise((_,reject)=>{timer=win.setTimeout(()=>reject(Error('Connection timed out. Please retry.')),12000)})]);if(r.error)throw Error(r.error.message||'Reels action unavailable.');if(!alive())throw Error('Account changed.');return r.data}finally{win.clearTimeout(timer)}}
 function ready(){return probe??=(async()=>{try{const caps=await call('capabilities');return caps?.version===1&&caps.threads===true&&caps.following===true}catch{return false}})()}
 function button(label,fn,cls='luo-reel-action'){const b=el('button',cls,label);b.type='button';b.onclick=async()=>{if(b.disabled||!alive())return;b.disabled=true;try{await fn(b)}catch(e){if(alive())note(e.message||'Please retry.')}finally{if(alive()&&b.isConnected)b.disabled=b.dataset.sent==='true'}};return b}
 function apply(c,state){c.state=state;if(!c.loaded){c.loaded=true;c.follow.disabled=false;c.repost.disabled=false}c.follow.textContent=state.following?'Following':'Follow';c.follow.setAttribute('aria-pressed',String(!!state.following));c.repost.setAttribute('aria-pressed',String(!!state.reposted));c.repost.setAttribute('aria-label','Repost · '+Number(state.reposts||0));c.repost.querySelector('span').textContent=String(Number(state.reposts)||0);if(Number.isFinite(state.comments))c.onCommentCount?.(state.comments)}
 async function activate(article){const c=cards.get(article);if(!c||c.pending)return;c.pending=true;const version=c.version;try{if(!await ready()||!alive()||!article.isConnected)return;const state=await call('state',{id:c.item.id});if(alive()&&article.isConnected&&version===c.version)apply(c,state)}catch(e){if(alive())note(e.message)}finally{c.pending=false}}
 async function mount({article,item,head,actions,isActive,onCommentCount}){
  if(!await ready()||!alive()||!article.isConnected)return;
  const c={item,state:{},pending:false,version:0,loaded:false,onCommentCount};
  c.follow=button('Follow',async()=>{for(const other of cards.values())if(other.item.owner_id===item.owner_id)other.version++;const state=await call('follow',{id:item.id,enabled:!c.state.following});if(!alive())return;for(const other of cards.values())if(other.item.owner_id===item.owner_id){other.state.following=state.following;other.follow.textContent=state.following?'Following':'Follow';other.follow.setAttribute('aria-pressed',String(state.following))}},'luo-reel-follow');
  c.follow.hidden=item.owner_id===owner;c.follow.disabled=true;head.append(c.follow);
  c.repost=button('',async()=>{c.version++;const state=await call('repost',{id:item.id,enabled:!c.state.reposted});if(alive()&&article.isConnected)apply(c,state)},'luo-feed-icon luo-reel-repost');
  const symbol=doc.createElementNS('http://www.w3.org/2000/svg','svg'),path=doc.createElementNS(symbol.namespaceURI,'path');symbol.setAttribute('viewBox','0 0 24 24');symbol.setAttribute('aria-hidden','true');path.setAttribute('d','M4 7h15l-4-4m4 4-4 4M20 17H5l4-4m-4 4 4 4');symbol.append(path);c.repost.append(symbol,el('span','','0'));c.repost.setAttribute('aria-label','Repost · 0');c.repost.hidden=item.audience!=='public';c.repost.disabled=true;actions.insertBefore(c.repost,actions.children[2]||null);cards.set(article,c);
  if(isActive())activate(article);
 }
 function scope(item,title){openSheet(title);const ticket=++revision;sheet.dataset.reel=item.id;return ()=>alive()&&ticket===revision&&sheet.open&&sheet.dataset.reel===item.id}
 async function comments(item,onSent){
  const still=scope(item,'Comments'),rows=el('div','luo-feed-comment-list'),feedback=el('p','luo-feed-feedback','Loading…');feedback.setAttribute('role','status');
  const form=el('form','luo-feed-comment-form'),field=el('textarea'),replyLabel=el('p','luo-reel-reply-target');field.maxLength=300;field.required=true;field.placeholder='Add a comment…';field.setAttribute('aria-label','Your comment');
  const send=el('button','','Send');send.type='submit';form.append(field,send);let replying=null,operation=null,lastDraft='',pending=false,after=null,fetching=false;const shown=new Set(),threadNodes=new Map(),pinBindings=new Map();
  const cancel=button('Cancel reply',()=>{replying=null;replyLabel.replaceChildren();field.focus()});cancel.hidden=true;
  function add(r,container=rows){
   if(shown.has(r.id))return;shown.add(r.id);const row=el('article','luo-feed-comment'),identity=el('div','luo-comment-identity'),avatar=el('div','luo-comment-avatar');renderConversationAvatar(avatar,{kind:'direct',person:{id:r.user_id,username:r.username,avatar_url:r.avatar_url}},{label:r.username||'Member',projectUrl:SUPABASE_URL});
   const pinned=el('small','',r.pinned?'Pinned by creator':'');identity.append(avatar,el('strong','','@'+(r.username||'member')),pinned);const text=el('p','',r.body),tools=el('div','luo-comment-tools'),children=el('div','luo-comment-replies');
   if(r.created_at){const time=el('time','',new Date(r.created_at).toLocaleDateString());time.dateTime=r.created_at;identity.append(time)}
   if(!r.removed){
    const like=button('Like comment · '+(r.likes||0),async b=>{const out=await call('comment.like',{id:item.id,comment_id:r.id,enabled:!r.liked});if(!still())return;r=out;b.textContent='Like comment · '+r.likes;b.setAttribute('aria-pressed',String(r.liked))});like.setAttribute('aria-pressed',String(!!r.liked));tools.append(like);
    if(!r.parent_id)tools.append(button('Reply',()=>{replying={id:r.id,username:r.username};replyLabel.textContent='Replying to @'+(r.username||'member');cancel.hidden=false;field.focus()}));
    if(owner===item.owner_id&&!r.parent_id){const pin=button(r.pinned?'Unpin':'Pin',async()=>{const out=await call('comment.pin',{id:item.id,comment_id:r.id,enabled:!r.pinned});if(still()){r=out;for(const [id,update]of pinBindings)update(id===r.id&&r.pinned)}});pinBindings.set(r.id,value=>{r.pinned=value;pinned.textContent=value?'Pinned by creator':'';pin.textContent=value?'Unpin':'Pin'});tools.append(pin)}
    if(owner===r.user_id||owner===item.owner_id)tools.append(button('Remove',async()=>{if(!win.confirm('Remove this comment?'))return;await call('comment.remove',{id:item.id,comment_id:r.id});if(still()){text.textContent='[Comment removed]';tools.replaceChildren();pinned.textContent=''}}));
   }
   if(!r.parent_id&&r.replies){let replyAfter=null;const seenReplies=new Set();const moreReplies=button('View replies · '+r.replies,async b=>{const page=await call('comments',{id:item.id,parent_id:r.id,...(replyAfter?{after:replyAfter}:{})});if(!still())return;for(const reply of page){if(!seenReplies.has(reply.id)){seenReplies.add(reply.id);add(reply,children)}}const next=page.at(-1)?.id;b.hidden=page.length<50||next===replyAfter;replyAfter=next;b.textContent='More replies'});tools.append(moreReplies)}
   row.append(identity,text,tools,children);if(!r.parent_id)threadNodes.set(r.id,children);container.append(row);
  }
  async function load(){if(fetching||!still())return;fetching=true;more.disabled=true;try{const page=await call('comments',{id:item.id,...(after?{after}:{})});if(!still())return;for(const r of page)add(r);const next=page.at(-1)?.id;more.hidden=page.length<50||!next||next===after;after=next;feedback.textContent=rows.children.length?'':'Start the conversation.'}catch(e){if(still()){feedback.textContent=e.message;more.hidden=false}}finally{fetching=false;if(still())more.disabled=false}}
  const more=button('More comments',load,'luo-feed-more');more.hidden=true;sheet.append(rows,more,feedback,replyLabel,cancel,form);sheet.showModal();
  form.onsubmit=async ev=>{ev.preventDefault();const body=field.value.trim();if(!body||pending||!still())return;const draft=JSON.stringify([body,replying?.id||null]);if(draft!==lastDraft||!operation){operation=win.crypto.randomUUID();lastDraft=draft}pending=true;send.disabled=true;try{const r=await call('comment',{id:item.id,body,operation,...(replying?{parent_id:replying.id}:{})});if(!still())return;add(r,threadNodes.get(r.parent_id)||rows);field.value='';replying=null;replyLabel.replaceChildren();cancel.hidden=true;operation=null;feedback.textContent='Comment sent.';onSent()}catch(e){if(still())feedback.textContent=e.message}finally{pending=false;if(still())send.disabled=false}};
  await load();
 }
 async function share(item){
  const still=scope(item,'Send clip'),feedback=el('p','luo-feed-feedback','Finding conversations whose recipients can view this clip…'),search=el('input');search.placeholder='Search recent direct chats';search.setAttribute('aria-label','Search recipients');const rows=el('div','luo-reel-recipient-list');sheet.append(search,rows,feedback,button('Copy link',async()=>{const url=new URL(win.location.href);url.search='';url.hash='luo-clip='+item.id;await win.navigator.clipboard.writeText(url.href);if(still())feedback.textContent='Link copied. Viewing permissions still apply.'}));sheet.showModal();
  try{const rooms=(getChats()||[]).filter(c=>c.kind==='direct').slice(0,100).map(c=>c.id);const people=await call('recipients',{id:item.id,rooms});if(!still())return;feedback.textContent=people.length?'Choose a recipient. Visibility is checked again when sending.':'No eligible recent direct conversations. Private clips cannot be sent to people without access.';
   for(const p of people){const row=el('div','luo-reel-recipient'),name=p.display_name||p.username||'Friend';row.dataset.search=(name+' '+p.username).toLowerCase();let operation=null;row.append(el('span','',name+' · @'+p.username),button('Send',async b=>{operation??=win.crypto.randomUUID();await call('share',{id:item.id,room:p.id,operation});if(still()){b.textContent='Sent';b.disabled=true;b.dataset.sent='true';feedback.textContent='Clip sent.'}},'luo-reel-send'));rows.append(row)}
   search.oninput=()=>{const q=search.value.trim().toLowerCase();for(const row of rows.children)row.hidden=!row.dataset.search.includes(q)};
  }catch(e){if(still())feedback.textContent=e.message}
 }
 async function preference(item,kind){await call('interest',{id:item.id,kind,enabled:true});if(alive())note(kind==='hidden'?'Preference saved. This clip will be excluded from Explore and Following.':'Interest saved. This is a preference, not a promise of personalized ranking.')}
 return {ready,call,mount,activate,comments,share,preference,close(){closed=true;revision++;cards.clear()}};
}

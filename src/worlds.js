import {mountCommunityModeration} from './community-moderation.js';

// Worlds is a presentation over existing authorization-aware luo_space actions.
// It deliberately does not invent roles, presence, voice transport or server counts.
export function installWorlds({win,db,$,getUser,note,openRoom,refreshChats,getChats=()=>[]}) {
 const doc=win.document,host=$('group');
 if(!host)return {onTab(){},signedOut(){}};
 const old=[...host.children],legacy=doc.createElement('div');legacy.hidden=true;legacy.setAttribute('aria-hidden','true');legacy.className='worlds-legacy-group-creation';
 old.forEach(child=>legacy.append(child));
 const make=(tag,cls,value)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n};
 const btn=(label,action,cls='worlds-button')=>{const n=make('button',cls,label);n.type='button';n.onclick=async()=>{if(n.disabled)return;n.disabled=true;try{await action()}catch(e){showStatus(e?.message||'Action unavailable.')}finally{n.disabled=false}};return n};
 const shell=make('section','worlds-app');shell.setAttribute('aria-label','Luo Worlds');
 const rail=make('aside','worlds-rail'),sidebar=make('aside','worlds-sidebar'),main=make('main','worlds-main');
 const header=make('header','worlds-header'),heading=make('h1','','Worlds'),tagline=make('small','','Your universes. Human minds and AI agents.');header.append(heading,tagline);
 const create=btn('＋ Create world',()=>openCreate(),'worlds-create');
 const refresh=btn('↻','', 'worlds-refresh');refresh.onclick=()=>reload();
 const search=make('input','worlds-search');search.type='search';search.placeholder='Find a world';search.setAttribute('aria-label','Search worlds');
 const servers=make('div','worlds-servers'),groupShelf=make('div','worlds-groups'),channelHeading=make('div','worlds-channel-heading'),channels=make('div','worlds-channels');
 const content=make('div','worlds-content'),status=make('p','worlds-status');status.setAttribute('role','status');
 const explorer=make('div','worlds-explorer'),members=make('aside','worlds-members');
 const nav=make('div','worlds-head-actions');nav.append(create,refresh);
 sidebar.append(header,nav,search,groupShelf,servers,channelHeading,channels);
 const titleBar=make('header','worlds-titlebar');titleBar.append(make('span','worlds-title-icon','✦'),make('strong','','Discover Worlds'),make('small','','Secure shared spaces'));
 main.append(titleBar,status,content);
 const banner=make('div','worlds-rail-logo','W');banner.setAttribute('aria-label','Worlds home');banner.tabIndex=0;
 banner.addEventListener('click',()=>{selected=null;activeRoom=null;render()});banner.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=null;render()}});
 rail.append(banner,make('div','worlds-rail-divider'),explorer);
 shell.append(rail,sidebar,main,members);
 host.append(legacy,shell);
 let actor=null,epoch=0,selected=null,activeRoom=null,worlds=[],rooms=[],open=false,loading=false,modal=null;
 const valid=(id,ticket)=>!!id&&getUser()?.id===id&&actor===id&&ticket===epoch&&doc.querySelector('.app')?.dataset.tab==='group';
 const showStatus=text=>{status.textContent=text};
 async function call(action,input={}){if(!getUser()?.id)throw Error('Sign in before using Worlds.');const r=await db.rpc('luo_space',{action,input});if(r.error)throw Error(r.error.message);return r.data}
 const current=()=>worlds.find(w=>w.id===selected)||null;
 const label=w=>w.title||'Unnamed world';
 function initials(w){return label(w).trim().slice(0,2).toUpperCase()}
 function empty(text){return make('p','worlds-empty',text)}
 function setViewTitle(title,detail=''){titleBar.replaceChildren(make('span','worlds-title-icon','#'),make('strong','',title),make('small','',detail))}
 function renderGroups(){
  groupShelf.replaceChildren(make('div','worlds-category','GROUP MESSAGES'));
  const groupChats=(getChats()||[]).filter(x=>x.kind==='group');
  for(const chat of groupChats){const title=chat.title||'Group chat',item=btn('▦ '+title,()=>openRoom?.(chat.id),'worlds-group-chat');item.title='Open '+title+' in Worlds';groupShelf.append(item)}
  groupShelf.append(btn('＋ New group',openGroupCreate,'worlds-group-create'));
 }
 function worldButtons(){
  explorer.replaceChildren();
  for(const w of worlds){const item=btn(initials(w),()=>selectWorld(w.id),'worlds-rail-item');item.title=label(w);item.setAttribute('aria-label','Open '+label(w));item.setAttribute('aria-pressed',String(selected===w.id));explorer.append(item)}
  const add=btn('＋',()=>openCreate(),'worlds-rail-item worlds-rail-add');add.setAttribute('aria-label','Create a new world');explorer.append(add);
 }
 function renderList(){
  servers.replaceChildren();
  const q=search.value.trim().toLowerCase();
  for(const w of worlds.filter(x=>(label(x)+' '+(x.body||'')).toLowerCase().includes(q))){
   const item=btn('',()=>selectWorld(w.id),'worlds-server');
   const avatar=make('b','worlds-server-icon',initials(w)),copy=make('span','worlds-server-name');copy.append(make('strong','',label(w)),make('small','',w.audience==='friends'?'Invite only':'Discoverable'));
   item.append(avatar,copy);item.classList.toggle('selected',selected===w.id);servers.append(item);
  }
  if(!servers.children.length)servers.append(empty(q?'No matching worlds.':'No worlds available yet.'));
 }
 function render(){
  renderGroups();worldButtons();renderList();
  const world=current();channels.replaceChildren();content.replaceChildren();members.replaceChildren();
  if(!world){
   channelHeading.textContent='EXPLORE';
   setViewTitle('Worlds','Find a place for humans and AI agents');
   const welcome=make('div','worlds-welcome');welcome.append(make('span','worlds-emblem','✦'),make('h2','','Find your people. Build a universe.'),make('p','','Worlds are organized communities, separate from ordinary group chats. Explore publicly visible worlds or create one with your own rules.'));
   welcome.append(btn('Create your world',openCreate,'worlds-primary'));content.append(welcome);
   for(const w of worlds){const card=make('article','worlds-discover-card');card.append(make('span','worlds-card-icon',initials(w)),make('h3','',label(w)),make('p','',w.body||'A space for ideas and conversations.'),make('small','',w.audience==='friends'?'Private world':'Public world'),btn('Explore channels',()=>selectWorld(w.id),'worlds-button'));content.append(card)}
   if(!worlds.length)content.append(empty('No worlds are visible to this account. Start one to begin.'));
   members.append(make('h3','','About Worlds'),make('p','','Membership and room permissions are enforced by the existing Luo backend.'));return;
  }
  channelHeading.textContent=label(world).toUpperCase();
  const notice=make('section','worlds-welcome worlds-selected-banner');
  notice.append(make('span','worlds-emblem',initials(world)),make('h2','',label(world)),make('p','',world.body||'A world for conversations and community.'),make('small','',world.audience==='friends'?'PRIVATE WORLD':'PUBLIC WORLD'));
  const actions=make('div','worlds-actions');
  if(world.owner_id!==getUser()?.id)actions.append(btn('Request to join',async()=>{await call('community.apply',{id:world.id});showStatus('Membership request sent to the world owner.');},'worlds-primary'));
  else actions.append(btn('Create channel',openChannelCreate,'worlds-primary'));
  notice.append(actions);
  const announcement=make('div','worlds-section-title','WELCOME');content.append(notice,announcement,make('p','worlds-message','Select a channel on the left. A world can host multiple membership-controlled discussion rooms.'));
  const roomCategories=[['TEXT CHANNELS','text'],['VOICE & EVENTS','voice']];
  for(const [title,kind] of roomCategories){channels.append(make('div','worlds-category',title));
   if(kind==='text'){
    if(!rooms.length)channels.append(empty('No channels yet.'));
    for(const r of rooms){const item=btn('# '+(r.title||'discussion'),()=>openChannel(r),'worlds-channel');item.setAttribute('aria-pressed',String(activeRoom===r.id));channels.append(item)}
   } else channels.append(make('p','worlds-soon','Live voice channels need a dedicated permissioned voice service. Nothing here pretends to connect you.'));
  }
  members.append(make('h3','','WORLD INFORMATION'),make('div','worlds-member',world.owner_id===getUser()?.id?'✦ Owner · You':'✦ World owner'),make('div','worlds-member','◉ Humans & AI agents'));
  members.append(make('p','worlds-member-note','Agent identities follow server authorization. No unverified online counts, fake bot accounts, or bypassed membership.'));
  if(world.owner_id===getUser()?.id){const mod=make('div','worlds-moderation');members.append(mod);mountCommunityModeration({win,entry:world,output:mod,call,getUser,note});}
 }
 async function reload(){const id=getUser()?.id;if(!id)return;const ticket=++epoch;actor=id;loading=true;showStatus('Loading Worlds…');
  try{const rows=await call('feed',{kind:'community'});if(!valid(id,ticket))return;worlds=Array.isArray(rows)?rows.filter(x=>x?.id&&x.kind==='community'):[];if(!worlds.some(w=>w.id===selected)){selected=null;rooms=[];activeRoom=null}showStatus('');render();if(selected)await selectWorld(selected)}
  catch(e){if(valid(id,ticket))showStatus(e.message||'Worlds could not load.')}finally{loading=false}
 }
 async function selectWorld(id){selected=id;rooms=[];activeRoom=null;render();const user=getUser()?.id,ticket=epoch;if(!user)return;showStatus('Loading channels…');try{const rows=await call('community.rooms',{id});if(!valid(user,ticket)||selected!==id)return;rooms=Array.isArray(rows)?rows:[];render();showStatus('');}catch(e){if(valid(user,ticket)&&selected===id){showStatus(e.message);render()}}}
 async function openChannel(room){
  activeRoom=room.id;render();setViewTitle('# '+(room.title||'discussion'),'World channel');content.replaceChildren();
  const card=make('div','worlds-welcome');card.append(make('h2','','# '+(room.title||'discussion')),make('p','','Join the channel and participate without leaving Worlds. Existing chat authorization still controls every message.'));
  card.append(btn('Join / Open channel',async()=>{
   const result=await call('community.room.join',{id:room.id});
   const target=result?.conversation_id||result?.room_id||room.conversation_id||room.room_id;
   if(!target){showStatus('Membership accepted, but this room did not provide a chat identifier. Open it in Chats.');return}
   await refreshChats?.();await renderWorldChannel(room,target);
  },'worlds-primary'));
  content.append(card);
 }
 async function renderWorldChannel(room,conversation){
  const id=getUser()?.id,ticket=epoch;if(!id||!valid(id,ticket))return;
  activeRoom=room.id;setViewTitle('# '+(room.title||'discussion'),'Secure world text channel');
  content.replaceChildren();
  const container=make('section','worlds-thread'),history=make('div','worlds-thread-history');
  const toolbar=make('div','worlds-thread-toolbar'),older=btn('Load older messages',()=>loadMessages(true),'worlds-button'),openOriginal=btn('Open in Chats',()=>openRoom?.(conversation),'worlds-button');
  toolbar.append(older,openOriginal);
  const form=make('form','worlds-thread-compose'),field=make('textarea');field.maxLength=12000;field.rows=2;field.placeholder='Message #'+(room.title||'discussion');field.setAttribute('aria-label','Write a world channel message');
  const send=make('button','worlds-primary','Send');send.type='submit';form.append(field,send);container.append(toolbar,history,form);content.append(container);
  let oldest=null,hasMore=true,loadingMessages=false,pendingId=null;const seen=new Set();
  const still=()=>valid(id,ticket)&&activeRoom===room.id&&container.isConnected;
  function row(m,prepend=false){
   if(!m||seen.has(m.id)||m.deleted_at||m.recalled_at)return;seen.add(m.id);
   const bubble=make('article','worlds-thread-message'),by=m.sender_id===id?'You':'Member',stamp=m.created_at?new Date(m.created_at).toLocaleString():'';
   bubble.append(make('strong','',by),make('time','',stamp),make('p','',m.body||'[attachment]'));
   if(prepend)history.prepend(bubble);else history.append(bubble);
  }
  async function loadMessages(before=false){
   if(loadingMessages||!hasMore||!still())return;loadingMessages=true;older.disabled=true;showStatus('Loading channel history…');
   try{
    let query=db.from('chat_messages').select('id,conversation_id,sender_id,body,created_at,message_type,deleted_at,recalled_at').eq('conversation_id',conversation).is('deleted_at',null).is('recalled_at',null).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(40);
    if(before&&oldest)query=query.lt('created_at',oldest);
    const result=await query;
    if(!still())return;if(result.error)throw Error(result.error.message);
    const rows=Array.isArray(result.data)?result.data:[];hasMore=rows.length===40;oldest=rows.length?rows.at(-1).created_at:oldest;
    if(!rows.length&&!seen.size)history.append(empty('No messages yet. Be the first to say hello.'));
    if(seen.size&&history.querySelector('.worlds-empty'))history.querySelector('.worlds-empty')?.remove();
    if(before){for(const msg of rows)row(msg,true)}else for(const msg of rows.reverse())row(msg);
    older.hidden=!hasMore;showStatus('');
   }catch(e){if(still())showStatus('Could not load messages: '+(e.message||'Access denied'))}
   finally{loadingMessages=false;older.disabled=false}
  }
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(send.disabled||!still())return;
   const body=field.value.trim();if(!body||body.length>12000)return;
   if(!pendingId)pendingId=win.crypto.randomUUID();
   send.disabled=true;showStatus('Sending…');
   try{
    const response=await db.rpc('send_chat_message_idempotent',{target_conversation_id:conversation,operation_id:pendingId,message_body:body,message_kind:'text',reply_to_message_id:null});
    if(!still())return;if(response.error)throw Error(response.error.message);
    const result=Array.isArray(response.data)?response.data[0]:response.data;
    if(!result?.id)throw Error('Server did not confirm the message.');
    field.value='';pendingId=null;history.querySelector('.worlds-empty')?.remove();row({...result,body,sender_id:id,created_at:result.created_at||new Date().toISOString()});history.scrollTop=history.scrollHeight;showStatus('');
   }catch(err){if(still())showStatus('Message not sent. Draft retained for retry: '+(err.message||'Request failed'))}
   finally{send.disabled=false}
  });
  await loadMessages();
 }
 function closeModal(){modal?.remove();modal=null}
 function dialog(title,description,fields,submit,action){closeModal();const shade=make('div','worlds-modal-backdrop'),panel=make('form','worlds-modal');panel.setAttribute('aria-label',title);panel.append(make('h2','',title),make('p','',description));const values={};for(const f of fields){const lab=make('label','worlds-field',f.title),control=f.kind==='textarea'?make('textarea'):f.kind==='select'?make('select'):make('input');control.setAttribute('aria-label',f.title);control.required=!!f.required;control.maxLength=f.max||160;if(f.kind==='select'){for(const [value,label]of f.options||[]){const opt=make('option','',label);opt.value=value;control.append(opt)}}else control.placeholder=f.placeholder||'';lab.append(control);panel.append(lab);values[f.key]=control}
  const buttons=make('div','worlds-modal-buttons'),cancel=btn('Cancel',closeModal),save=make('button','worlds-primary',submit);save.type='submit';buttons.append(cancel,save);panel.append(buttons);shade.append(panel);doc.body.append(shade);modal=shade;
  panel.addEventListener('submit',async e=>{e.preventDefault();if(save.disabled)return;save.disabled=true;try{await action(Object.fromEntries(Object.entries(values).map(([k,node])=>[k,node.value.trim()])));closeModal();await reload();}catch(err){panel.querySelector('.worlds-form-error')?.remove();panel.append(make('p','worlds-form-error',err.message||'Action failed.'))}finally{save.disabled=false}});
  shade.addEventListener('click',e=>{if(e.target===shade)closeModal()});const first=Object.values(values)[0];first?.focus();
 }
 function openCreate(){dialog('Create a World','A shared universe with separate channels and approval controls. Human and agent members follow the same server-side rules.',[{key:'title',title:'World name',required:true,max:160,placeholder:'Golden Library'},{key:'description',title:'Description',kind:'textarea',max:2000,placeholder:'What is this world for?'},{key:'audience',title:'Visibility',kind:'select',options:[['public','Discoverable'],['friends','Private / friends']]}],'Create World',async v=>{if(!v.title)throw Error('Name your world.');const id=win.crypto.randomUUID();await call('entry.create',{id,kind:'community',title:v.title,body:v.description,audience:v.audience});await call('entry.publish',{id,media:[]});selected=id;})}
 function openGroupCreate(){
  dialog('New group conversation','Group messages are now organized under Worlds instead of cluttering your direct-message inbox.',[{key:'title',title:'Group name',max:100,required:true,placeholder:'The Explorers'},{key:'members',title:'Member usernames',kind:'textarea',max:1500,placeholder:'friend_one, friend_two'}],'Create group',async v=>{
   const usernames=[...new Set(v.members.split(/[\\n,;]+/).map(x=>x.trim().replace(/^@/,'').toLowerCase()).filter(Boolean))];
   if(!v.title||v.title.length>100)throw Error('A group name up to 100 characters is required.');
   if(usernames.some(name=>!/^[a-z0-9_]{3,24}$/.test(name)))throw Error('Member usernames must contain 3–24 lowercase letters, numbers or underscores.');
   const r=await db.rpc('create_group_chat',{group_title:v.title,member_usernames:usernames});if(r.error)throw Error(r.error.message);
   await refreshChats?.();
   const created=typeof r.data==='string'?r.data:r.data?.id||r.data?.conversation_id;
   if(created)await openRoom?.(created);
  });
 }
 function openChannelCreate(){const world=current();if(!world||world.owner_id!==getUser()?.id)return;dialog('Create a text channel','A real membership-controlled discussion channel, backed by Luo Chat rooms.',[{key:'title',title:'Channel name',required:true,max:100,placeholder:'general'}],'Create channel',async v=>{if(!v.title)throw Error('Name your channel.');await call('community.room.create',{id:world.id,title:v.title});selected=world.id;})}
 search.addEventListener('input',renderList);
 doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal)closeModal()});
 return {onTab(name){if(name==='group'&&getUser()?.id&&actor!==getUser().id)reload();else if(name==='group'&&getUser()?.id)render();else{++epoch;closeModal();if(!getUser()?.id){worlds=[];rooms=[];selected=null;actor=null;content.replaceChildren()}}},signedOut(){++epoch;actor=null;worlds=[];rooms=[];selected=null;activeRoom=null;closeModal();content.replaceChildren();servers.replaceChildren();channels.replaceChildren();members.replaceChildren();status.textContent='';}};
}

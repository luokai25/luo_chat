/* Luo Chat: approved mobile layout connected to existing app handlers. No backend credentials. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const svg={
social:'<path d="M12 3l2.9 6.1L22 10l-5.2 4.9L18 22l-6-3.3L6 22l1.2-7.1L2 10l7.1-.9Z"/>',
camera:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7l2-3h4l2 3"/><circle cx="12" cy="14" r="3"/>',
more:'<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
chat:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.95L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5Z"/>',
updates:'<circle cx="12" cy="12" r="8" stroke-dasharray="2 4"/><circle cx="12" cy="12" r="3"/>',
users:'<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M16 15a5 5 0 0 1 6 5"/>',
phone:'<path d="M4 4l5 1 2 5-3 2c2 4 4 6 8 8l2-3 5 2-1 5C11 27-2 14 4 4Z"/>',
video:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
newchat:'<path d="M20 11a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 20l1.8-5a8 8 0 1 1 15.2-4Z"/><path d="M12 8v7M8.5 11.5h7"/>',
archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v12h14V9M10 13h4"/>',
mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>'
};
const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+svg[name]+'</svg>';
const action=(name,original)=>{const b=document.createElement('button');b.type='button';b.className='luo-approved-icon';b.setAttribute('aria-label',name);b.innerHTML=icon(name.toLowerCase().includes('camera')?'camera':'more');b.addEventListener('click',original);return b};
const screen=()=>document.querySelector('.app');
function clickTab(name){document.querySelector('.workspace-nav [data-tab="'+name+'"]')?.click()}
function openTools(name){const all=[...document.querySelectorAll('#roomMenu .room-menu-items button')];const btn=all.find(b=>b.textContent?.trim()===name);if(btn){btn.click();return true}return false}
function makeCall(kind){if(screen()?.dataset.screen!=='room')return;openTools(kind==='video'?'Video call':'Voice call')}
function create(){
 const app=screen(),chats=$('chats'),room=$('room'),inbox=$('inboxFilter');
 if(!app||!chats||!room||!inbox||$('luoApprovedHeader'))return;
 const header=document.createElement('header');header.id='luoApprovedHeader';const branding=document.createElement('div');branding.className='luo-brand';
 const orig=document.querySelector('.app-header .logo img');if(orig){const img=orig.cloneNode(false);img.alt='Luo Chat';branding.append(img)}
 const name=document.createElement('span');name.append(document.createTextNode('Luo '));const gold=document.createElement('b');gold.textContent='Chat';name.append(gold);branding.append(name);
 const buttons=document.createElement('div');buttons.className='luo-approved-actions';
 buttons.append(action('Open camera',()=>{$('openStories')?.click();setTimeout(()=>$('newStory')?.click(),10)}),action('More options',()=>{const more=$('luoModernMore');if(more)more.click();else clickTab('profile')}));
 header.append(branding,buttons);chats.prepend(header);
 const search=$('search');if(search)search.placeholder='Search or start a new chat';
 const toolbar=chats.querySelector('.toolbar');
 const chips=document.createElement('div');chips.id='luoApprovedFilters';chips.setAttribute('role','group');chips.setAttribute('aria-label','Chat filters');
 const choices=[['All','active'],['Unread','unread'],['Groups','group'],['Favorites','favorites']];
 let filter='active';const chipButtons=new Map();
 for(const [label,val] of choices){const b=document.createElement('button');b.type='button';b.className='luo-approved-chip';b.textContent=label;b.dataset.approvedFilter=val;chipButtons.set(val,b);chips.append(b);
 b.addEventListener('click',()=>{if(val==='group'){closeCalls();clickTab('group');return}filter=val;if(val==='favorites'){inbox.value='active';inbox.dispatchEvent(new Event('change',{bubbles:true}));applyFavorites()}else{inbox.value=val;inbox.dispatchEvent(new Event('change',{bubbles:true}));applyFavorites()}refreshChips()})}
 function refreshChips(){for(const [v,b]of chipButtons)b.setAttribute('aria-pressed',String(v===filter))}
 function applyFavorites(){for(const row of $('chatlist')?.querySelectorAll('.chatrow')||[]){row.hidden=filter==='favorites'&&!row.classList.contains('inbox-pinned')&&!row.classList.contains('pinned-chat')}}
 inbox.addEventListener('change',()=>{if(filter!=='favorites'){filter=inbox.value==='unread'?'unread':'active';refreshChips()}});
 refreshChips();toolbar?.after(chips);
 const archive=document.createElement('button');archive.type='button';archive.id='luoApprovedArchive';archive.innerHTML=icon('archive')+'<span>Archived</span><span class="luo-archive-indicator">›</span>';
 archive.addEventListener('click',()=>{filter='active';inbox.value='archived';inbox.dispatchEvent(new Event('change',{bubbles:true}));refreshChips()});chips.after(archive);
 const fab=document.createElement('button');fab.type='button';fab.id='luoApprovedFab';fab.setAttribute('aria-label','New chat');fab.innerHTML=icon('newchat');fab.addEventListener('click',()=>$('inboxCompose')?.click());chats.append(fab);
 const calls=document.createElement('section');calls.id='luoApprovedCalls';calls.setAttribute('aria-label','Call contacts');calls.innerHTML='<h2 class="luo-calls-title">Calls</h2><p class="luo-calls-explain">Choose a conversation to start a real Luo Chat voice or video call.</p><div class="luo-calls-list"></div>';const callList=calls.querySelector('.luo-calls-list');chats.append(calls);
 function populateCalls(){callList.replaceChildren();const list=[...($('chatlist')?.querySelectorAll('.chatrow')||[])].slice(0,80);for(const source of list){const name=source.querySelector('.chatinfo strong')?.textContent?.trim();if(!name)continue;const row=document.createElement('div');row.className='luo-call-contact';const label=document.createElement('span');label.className='luo-call-person';label.textContent=name;const voice=document.createElement('button');voice.type='button';voice.className='luo-approved-icon';voice.setAttribute('aria-label','Voice call '+name);voice.innerHTML=icon('phone');const video=document.createElement('button');video.type='button';video.className='luo-approved-icon';video.setAttribute('aria-label','Video call '+name);video.innerHTML=icon('video');
 for(const [btn,kind] of [[voice,'audio'],[video,'video']])btn.addEventListener('click',()=>{source.click();let n=0;const handle=()=>{if(app.dataset.screen==='room'){obs.disconnect();makeCall(kind)}else if(++n>25)obs.disconnect()};const obs=new MutationObserver(handle);obs.observe(app,{attributes:true,attributeFilter:['data-screen']});setTimeout(()=>{obs.disconnect();if(app.dataset.screen==='room')makeCall(kind)},450)});
 row.append(label,voice,video);callList.append(row)}if(!list.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='Start a conversation to call someone.';callList.append(empty)}}
 const nav=document.createElement('nav');nav.id='luoApprovedNav';nav.setAttribute('aria-label','Main mobile navigation');
 const entries=[['Chats','chat','chats'],['Updates','updates','updates'],['Worlds','users','group'],['Calls','phone','calls'],['Social','social','social']];
 let active='chats';let callsOpen=false,updatesRequest=0;
 function refresh(){for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-current',b.dataset.target===active?'page':'false')}
 function closeCalls(){callsOpen=false;app.classList.remove('luo-calls-open')}
 function navTo(key){const updatesTicket=++updatesRequest;if(key!=='calls')closeCalls();if(key==='chats'){clickTab('chats');active='chats'}else if(key==='updates'){if(app.dataset.screen==='room')clickTab('chats');const showUpdates=()=>{if(updatesTicket!==updatesRequest||app.dataset.screen!=='home'||$('storiesDialog')?.open)return;const dialog=$('storiesDialog'),open=$('openStories');if(dialog&&!dialog.open)dialog.showModal();if(typeof open?.onclick==='function')void open.onclick();else open?.click()};active='updates';setTimeout(showUpdates,0);setTimeout(showUpdates,160);setTimeout(showUpdates,500)}else if(key==='group'){clickTab('group');active='group'}else if(key==='social'){clickTab('social');active='social'}else if(key==='calls'){clickTab('chats');populateCalls();callsOpen=true;app.classList.add('luo-calls-open');active='calls'}refresh()}
 for(const [label,picto,key] of entries){const b=document.createElement('button');b.type='button';b.dataset.target=key;b.setAttribute('aria-label',label);b.innerHTML='<span class="luo-nav-icon">'+icon(picto)+'</span><span>'+label+'</span>';b.addEventListener('click',()=>navTo(key));nav.append(b)}app.append(nav);refresh();
 const tools=room.querySelector('.roomtools');
 for(const [label,kind] of [['Voice call','audio'],['Video call','video']]){const b=document.createElement('button');b.type='button';b.className='luo-approved-icon';b.id=kind==='audio'?'luoApprovedVoiceCall':'luoApprovedVideoCall';b.setAttribute('aria-label',label);b.innerHTML=icon(kind==='audio'?'phone':'video');b.addEventListener('click',()=>makeCall(kind));tools?.prepend(b)}
 const form=$('sendform'),body=$('body'),file=$('fileBar');
 if(form&&body){const mic=document.createElement('button');mic.type='button';mic.id='luoApprovedMic';mic.setAttribute('aria-label','Record voice message');mic.title='Record voice message';mic.innerHTML=icon('mic');mic.addEventListener('click',()=>{if(!$('recordChatVoice'))return;$('recordChatVoice').click()});form.append(mic);
 const sync=()=>{const hasText=!!body.value.trim();const hasFile=file&&!file.classList.contains('hidden');form.classList.toggle('luo-can-record',!hasText&&!hasFile)};
 body.addEventListener('input',sync);new MutationObserver(sync).observe(file||form,{attributes:true,attributeFilter:['class']});sync()}
 const appObs=new MutationObserver(()=>{if(app.dataset.screen==='home'&&!callsOpen){const tab=app.dataset.tab;if(tab==='chats')active='chats';else if(tab==='group')active='group';else if(tab==='new')active='updates';else if(tab==='social')active='social';refresh()}if(app.dataset.screen!=='home'){closeCalls();if(active==='calls')active='chats';refresh()}});
 appObs.observe(app,{attributes:true,attributeFilter:['data-screen','data-tab']});
 const chatsObs=new MutationObserver(()=>{if(filter==='favorites')applyFavorites()});
 if($('chatlist'))chatsObs.observe($('chatlist'),{childList:true});
 document.documentElement.dataset.luoApproved='2026';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',create,{once:true});else create();
})();
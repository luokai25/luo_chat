/* Luo Chat Modern: progressive UX only, preserves original Supabase / auth / message handlers. */
(()=>{'use strict';
const $=id=>document.getElementById(id), make=(tag,cl,text)=>{const el=document.createElement(tag);if(cl)el.className=cl;if(text!==undefined)el.textContent=text;return el;};
const click=id=>{const el=$(id);if(el&&!el.disabled){el.click();return true;}return false;};
function navTab(tab){const btn=document.querySelector('.workspace-nav .tab[data-tab="'+tab+'"]');if(btn)btn.click();}
function showToast(msg){let toast=$('luoModernToast');if(!toast){toast=make('div','luo-modern-toast');toast.id='luoModernToast';toast.setAttribute('role','status');document.body.append(toast)}toast.textContent=msg;toast.hidden=false;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.hidden=true,3500);}
function navigation(){const bar=document.querySelector('.workspace-nav');if(!bar||$('luoModernUpdates'))return;
 const updates=make('button','luo-ux-tab');updates.type='button';updates.id='luoModernUpdates';updates.innerHTML='<span class="luo-nav-symbol" aria-hidden="true">◉</span><span>Updates</span>';updates.setAttribute('aria-label','View or post stories');updates.addEventListener('click',()=>{if(window.LuoUpdatesV2?.open){window.LuoUpdatesV2.open();return}const original=$('openStories');if(original){if(document.querySelector('.app')?.dataset.screen==='room')click('back');if(document.querySelector('.app')?.dataset.tab!=='new')navTab('new');if(typeof original.onclick==='function')void original.onclick();else original.click();}else showToast('Stories are unavailable.');});
 const settings=bar.querySelector('[data-tab="profile"]');bar.insertBefore(updates,settings||null);
 const more=make('button','luo-ux-tab luo-more-tab');more.id='luoModernMore';more.type='button';more.innerHTML='<span class="luo-nav-symbol" aria-hidden="true">⋯</span><span>More</span>';more.setAttribute('aria-label','More app sections');more.addEventListener('click',()=>{let d=$('luoMoreDialog');if(!d){d=make('dialog','luo-modern-menu');d.id='luoMoreDialog';d.setAttribute('aria-label','More sections');const heading=make('h2','', 'More in Luo Chat');d.append(heading);for(const [label,tab] of [['Saved messages','saved'],['Scheduled messages','scheduled'],['Settings','profile']]){const b=make('button','ghost',label);b.type='button';b.addEventListener('click',()=>{d.close();navTab(tab)});d.append(b)}const close=make('button','ghost','Close');close.type='button';close.onclick=()=>d.close();d.append(close);document.body.append(d);}d.showModal()});bar.insertBefore(more,settings||null);
 const stories=$('storiesDialog');stories?.addEventListener('close',()=>updates.classList.remove('active'));
 const original=$('openStories');original?.addEventListener('click',()=>{updates.classList.add('active')});
}
function inbox(){const list=$('chatlist'),heading=document.querySelector('#chats .inbox-heading'),filter=$('inboxFilter');if(!list||!heading||!filter)return;
 let chips=$('luoModernChips');if(!chips){chips=make('div','luo-inbox-chips');chips.id='luoModernChips';chips.setAttribute('aria-label','Filter conversations');const entries=[['All','active'],['Unread','unread'],['Groups','groups'],['Archived','archived']];for(const [label,value] of entries){const button=make('button','luo-chip',label);button.type='button';button.dataset.filter=value;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{if(value==='groups'){navTab('group');return;}filter.value=value;filter.dispatchEvent(new Event('change',{bubbles:true}));sync()});chips.append(button);}const toolbar=list.previousElementSibling;list.before(chips);}
 function sync(){for(const button of chips.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.filter===filter.value));}
 filter.addEventListener('change',sync);sync();
 const hint=$('luoInboxHint')||make('span','luo-form-helper','Tap a conversation to open it. Swipe a message to reply.');hint.id='luoInboxHint';if(!heading.querySelector('#luoInboxHint')){hint.style.display='none';heading.append(hint);}
}
function intro(parent,id,symbol,title,desc){if(!parent||$(id))return;const b=make('section','luo-page-intro');b.id=id;const icon=make('span','luo-icon',symbol),body=make('div');body.append(make('strong','',title),make('small','',desc));b.append(icon,body);const titleNode=parent.querySelector('h2');if(titleNode)titleNode.after(b);else parent.prepend(b);}
function contacts(){const p=$('new');if(!p)return;intro(p,'luoFindIntro','♡','Stay close to your people','Find someone by their exact username, save them to contacts, or start a private chat.');const target=$('target');if(target){target.placeholder='Search by @username';target.autocomplete='off';}const save=$('saveContact');if(save)save.textContent='♡ Add to contacts';const look=$('lookup');if(look)look.textContent='Find user';const start=$('start');if(start)start.textContent='Message';const ct=p.querySelector('.contact-book .section-heading h3');if(ct)ct.textContent='My contacts';}
function groups(){const group=$('group'),members=$('members'),create=$('createGroup');if(!group||!members||!create||$('luoGroupPicker'))return;
 intro(group,'luoGroupIntro','♧','Bring everyone together','Choose a group name, add usernames and confirm members before creating a conversation.');
 const box=make('div','luo-group-picker');box.id='luoGroupPicker';const label=make('label','','Add people');label.htmlFor='luoAddUsername';const row=make('div','luo-input-row'),addInput=make('input','luo-add-person'),add=make('button','', 'Add');addInput.id='luoAddUsername';addInput.setAttribute('aria-label','Username to add to group');addInput.placeholder='@username';add.type='button';row.append(addInput,add);const chips=make('div','luo-member-chips');chips.id='luoGroupMembers';chips.setAttribute('aria-label','Selected group members');const note=make('small','luo-member-note','Members will be checked by Luo Chat when the group is created.');const contactsArea=make('div','luo-contact-shortcuts');contactsArea.id='luoRecentContacts';box.append(label,row,chips,contactsArea,note);members.before(box);
 function users(){return [...new Set(members.value.split(/[\n,;]+/).map(x=>x.trim().replace(/^@/,'').toLowerCase()).filter(x=>/^[a-z0-9_]{2,24}$/.test(x)))].slice(0,80)}
 function update(){const all=users();chips.replaceChildren();for(const username of all){const b=make('button','luo-member-chip','@'+username+'  ×');b.type='button';b.title='Remove '+username;b.addEventListener('click',()=>{members.value=all.filter(u=>u!==username).join(', ');members.dispatchEvent(new Event('input',{bubbles:true}));});chips.append(b)}note.textContent=all.length?all.length+' people selected. Group membership is verified when you create it.':'Add usernames below or select saved contacts. You can also paste a list.';}
 function addUser(){const value=addInput.value.trim().replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_]{2,24}$/.test(value)){showToast('Enter a valid username (letters, numbers or _).');return;}const all=users();if(!all.includes(value)){members.value=[...all,value].join(', ');members.dispatchEvent(new Event('input',{bubbles:true}));}addInput.value='';addInput.focus();}
 add.addEventListener('click',addUser);addInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addUser()}});members.addEventListener('input',update);update();
 function fromSavedContacts(){const items=[...document.querySelectorAll('#contactList .contact-row')];contactsArea.replaceChildren();if(!items.length){contactsArea.append(make('small','luo-member-note','Your saved contacts appear here after opening People.'));return;}contactsArea.append(make('small','luo-member-note','Saved contacts:'));for(const item of items.slice(0,36)){const user=item.querySelector('small')?.textContent?.trim().replace(/^@/,'');if(!user||!/^[a-z0-9_]{2,24}$/i.test(user))continue;const b=make('button','', '@'+user);b.type='button';b.addEventListener('click',()=>{addInput.value=user;addUser()});contactsArea.append(b)}}
 // Recheck when tab opened, after contact data is loaded; no new read of private records.
 const tab=document.querySelector('.workspace-nav [data-tab="group"]');tab?.addEventListener('click',()=>setTimeout(fromSavedContacts,50));fromSavedContacts();
 const labelOld=members.getAttribute('aria-label');members.setAttribute('aria-label',labelOld||'Usernames to add, separated by commas or lines');members.placeholder='Or paste multiple usernames here…';create.textContent='Create group →';
}
function messageActions(){const room=$('room'),messages=$('messages');if(!room||!messages)return;
 const hint=make('p','luo-message-help','Swipe to reply · Hold a message for reactions · Tap More for actions');hint.id='luoMessageHint';
 const form=$('sendform');if(form&&!room.querySelector('#luoMessageHint'))form.before(hint);
 // The app already implements swipe and long-press. Enhance discoverability on desktop while delegating to real handlers.
 messages.addEventListener('dblclick',event=>{const bubble=event.target.closest('.bubble[data-message]');if(!bubble||event.target.closest('button,a,input,video,audio,summary,details'))return;const more=bubble.querySelector('.message-extra-tools summary');if(more){more.click();more.scrollIntoView({block:'nearest',behavior:'instant'});}});
 const upgrade=()=>{messages.querySelectorAll('.bubble[data-message]').forEach(b=>{if(b.dataset.luoUpgraded)return;b.dataset.luoUpgraded='1';b.title='Swipe to reply, hold to react, or double-click for more actions';const bar=make('div','luo-bubble-actions');const reply=make('button','','↩');reply.type='button';reply.title='Reply to this message';reply.setAttribute('aria-label','Reply to message');reply.addEventListener('click',e=>{e.stopPropagation();const native=b.querySelector('[data-action=reply]');if(native)native.click();});const react=make('button','','♡');react.type='button';react.title='React to message';react.setAttribute('aria-label','React to message');react.addEventListener('click',e=>{e.stopPropagation();const native=b.querySelector('.message-extra-tools summary');if(native){native.click();b.querySelector('.reaction-chip')?.scrollIntoView?.({block:'nearest'});}});bar.append(reply,react);b.append(bar);});};
 const observer=new MutationObserver(upgrade);observer.observe(messages,{childList:true,subtree:false});upgrade();
}
function stories(){const dialog=$('storiesDialog'),composer=$('storyComposer');if(!dialog||!composer)return;
 const head=dialog.querySelector('#storiesDialogHeading');if(head)head.textContent='Updates';
 const upload=$('newStory');if(upload)upload.textContent='＋ Add to my status';
 const refresh=$('refreshStories');if(refresh)refresh.textContent='↻ Refresh';
 const title=$('storyComposerHeading');if(title)title.textContent='Create a status';
 const publish=$('publishStory');if(publish)publish.textContent='Share status →';
 const mediaLabel=composer.querySelector('label[for="storyMedia"]');if(mediaLabel)mediaLabel.textContent='Photo, video, GIF or audio (max 50 MB)';
 const contact=$('storyUseContacts');if(contact)contact.textContent='Choose saved contacts';
 const description=make('section','luo-page-intro');description.id='luoStoryIntro';description.append(make('span','luo-icon','◉'));
 const t=make('div');t.append(make('strong','','Private 24-hour status'),make('small','','Your chosen contacts can see your update for 24 hours. You control its audience.'));description.append(t);
 if(!composer.querySelector('#luoStoryIntro'))composer.querySelector('.dialog-heading')?.after(description);
 const storyDescription=make('p','luo-form-helper','Choose recipients before sharing. An empty audience means only you can see the status.');storyDescription.id='luoStoryPrivacyHint';if(!composer.querySelector('#luoStoryPrivacyHint'))$('storyAudience')?.after(storyDescription);
}
function authAndUX(){document.body.classList.add('luo-modern-theme');document.querySelector('#subtitle')?.setAttribute('aria-label','Luo Chat private conversations');const main=$('home');main?.setAttribute('aria-label','Luo Chat conversation workspace');
 const app=document.querySelector('.app');if(app){let wasAuth=app.dataset.screen==='auth';new MutationObserver(()=>{const nowAuth=app.dataset.screen==='auth';if(nowAuth&&!wasAuth){const members=$('members');if(members)members.value='';const add=$('luoAddUsername');if(add)add.value='';$('luoGroupMembers')?.replaceChildren();$('luoRecentContacts')?.replaceChildren();$('luoMoreDialog')?.close();}wasAuth=nowAuth;}).observe(app,{attributes:true,attributeFilter:['data-screen']});}}

function init(){if(!document.querySelector('.workspace-nav')||!$('chatlist')||!$('sendform'))return;
 try{authAndUX();navigation();inbox();contacts();groups();messageActions();stories();}catch(e){console.warn('Luo Modern UI: enhancement unavailable',e?.message||'error');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* Luo Chat 2026 media presentation hotfix: additive, never alters stored messages. */
(()=>{'use strict';
const media='img.media-preview,video.media-preview,audio.media-preview';
const fileRx=/\.(?:png|jpe?g|webp|gif|svg|avif|mp4|webm|m4v|mov|mp3|m4a|ogg|opus|wav|pdf|txt)(?:[?#]\S*)?$/i;
const urlRx=/^(?:https?:\/\/|blob:|\/)[^\s<>]+$/i;
function onlyMediaText(value,file){const s=(value||'').trim();if(!s||s.length>2048||s.includes('\n'))return false;
return (!!file&&s===file)||/^(?:sticker|gif|image|video|audio|file):\s*https?:\/\/\S+$/i.test(s)||
(urlRx.test(s)&&(fileRx.test(s)||/\/(?:storage\/v1\/object|stickers\/|image\/|media\/)/i.test(s)))}
function makeCard(link){if(link.dataset.luoMediaCard)return;const old=link.textContent||'';
const name=old.replace(/^Open\s+/i,'').replace(/\s+\([\d.]+\s+MB\)$/i,'').trim();
const ext=(name.match(/\.([a-z\d]+)$/i)||[,''])[1].toLowerCase();
const kind=['mp4','webm','m4v','mov'].includes(ext)?'video':['mp3','m4a','ogg','opus','wav'].includes(ext)?'audio':['pdf','txt'].includes(ext)?'document':'file';
const prefix={video:'▶ Play video',audio:'♫ Play audio',document:'▤ Open document',file:'↗ Open attachment'}[kind];
link.dataset.luoMediaCard=kind;link.classList.add('luo-media-card');link.textContent=prefix+(name?' · '+name:'');
link.title='Open '+name}
function upgrade(b){if(!b?.classList?.contains('bubble'))return;const previews=b.querySelectorAll(media);
const links=b.querySelectorAll('a.attachment-link');
const failed=Array.from(previews).some(p=>p.dataset.luoBroken==='yes');
if(previews.length&&!failed){
 links.forEach(a=>{a.hidden=true;a.classList.remove('luo-media-card')});
 previews.forEach(p=>{if(p.tagName==='IMG'&&!p.dataset.luoErrorWatcher){
   p.dataset.luoErrorWatcher='yes';p.addEventListener('error',()=>{
     p.dataset.luoBroken='yes';p.hidden=true;upgrade(b);
   },{once:true});
 }});
}else links.forEach(a=>{a.hidden=false;makeCard(a)});
const body=b.querySelector('.bubble-body');if(!body||!previews.length)return;
if(onlyMediaText(body.textContent,b.dataset.stickerName||'')){body.hidden=true;body.dataset.luoHiddenDuplicate='yes'}
else if(body.dataset.luoHiddenDuplicate==='yes'){body.hidden=false;delete body.dataset.luoHiddenDuplicate}}
function scan(){document.querySelectorAll('.bubble').forEach(upgrade)}
let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;scan()})}
function init(){if(document.getElementById('luo-media-fix'))return;const style=document.createElement('style');style.id='luo-media-fix';
style.textContent='.bubble a.attachment-link[hidden],.bubble .bubble-body[hidden]{display:none!important}'+
'.bubble img.chat-sticker{display:block;max-width:min(240px,60vw);height:auto;object-fit:contain;background:transparent}'+
'.bubble .luo-media-card{display:flex;gap:.5rem;align-items:center;text-decoration:none;border:1px solid rgba(212,174,93,.32);border-radius:12px;padding:.65rem .8rem;min-height:44px;overflow-wrap:anywhere}';
document.head.append(style);scan();new MutationObserver(schedule).observe(document.getElementById('messages')||document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()
})();

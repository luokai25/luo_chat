/* Messenger-style ergonomics: maps each control to the audited, existing action. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),app=document.querySelector('.app'),room=$('room'),form=$('sendform'),input=$('body'),messages=$('messages');
 if(!app||!room||!form||!input||!messages)return;
 const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x};
 const button=(label,cls,fn)=>{const x=el('button',cls,label);x.type='button';x.setAttribute('aria-label',label);x.addEventListener('click',fn);return x};
 const info=room.querySelector('.luo-dm-info'),header=room.querySelector('.roomhead'),identity=room.querySelector('.room-identity');
 if($('openChatTools'))$('openChatTools').textContent='More message actions';
 if($('openPersonalize'))$('openPersonalize').textContent='Chat appearance';
 if(info){info.textContent='ⓘ';info.title='Conversation details';info.setAttribute('aria-label','Open conversation details and themes')}
 if(identity){
  identity.classList.add('luo-dm-tappable');
  identity.tabIndex=0;identity.setAttribute('role','button');identity.setAttribute('aria-label','Open conversation details');
  identity.addEventListener('click',()=>info?.click());
  identity.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();info?.click()}});
 }
 const attach=$('attach'),file=$('mediaFile'),sheet=el('div','luo-dm-attach-sheet');sheet.id='luoDmAttachSheet';sheet.hidden=true;
 const choose=(accept,capture)=>{sheet.hidden=true;if(!file)return;const prev=file.getAttribute('accept');if(accept)file.setAttribute('accept',accept);else if(prev)file.setAttribute('accept',prev);if(capture)file.setAttribute('capture','environment');else file.removeAttribute('capture');file.click()};
 const restore=()=>{if(!file)return;file.removeAttribute('capture');file.setAttribute('accept','image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/mp4,audio/ogg,audio/webm,video/mp4,video/webm,application/pdf,text/plain')};
 file?.addEventListener('change',restore);
 sheet.append(button('Photo or video','luo-dm-sheet-action',()=>choose('image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm',false)),button('Camera','luo-dm-sheet-action',()=>choose('image/*,video/*',true)),button('Document','luo-dm-sheet-action',()=>choose(null,false)));
 const poll=$('createPoll');if(poll)sheet.append(button('Poll','luo-dm-sheet-action',()=>{sheet.hidden=true;poll.click()}));
 const schedule=$('scheduleText');if(schedule)sheet.append(button('Schedule message','luo-dm-sheet-action',()=>{sheet.hidden=true;schedule.click()}));
 form.before(sheet);
 if(attach){attach.setAttribute('aria-label','Add to conversation');attach.setAttribute('aria-expanded','false');
  attach.addEventListener('click',e=>{if(e.detail===0)return;});
  // replace the old file-only action with an accessible attachment sheet
  attach.onclick=e=>{e.preventDefault();sheet.hidden=!sheet.hidden;attach.setAttribute('aria-expanded',String(!sheet.hidden));};
 }
 document.addEventListener('click',e=>{if(sheet.hidden)return;if(!sheet.contains(e.target)&&e.target!==attach){sheet.hidden=true;attach?.setAttribute('aria-expanded','false')}});
 // Native reply actions already honor message authorization. Double tapping should use those handlers.
 let lastTap=0,lastMessage='';
 messages.addEventListener('pointerup',e=>{
  const bubble=e.target.closest('.bubble[data-message]');if(!bubble||e.target.closest('button,a,input,textarea'))return;
  const now=Date.now(),id=bubble.dataset.message;
  if(id===lastMessage&&now-lastTap<340){const heart=[...bubble.querySelectorAll('.reaction-chip')].find(b=>b.textContent.trim()==='❤️');if(heart&&!heart.disabled)heart.click();else bubble.querySelector('button[data-action="reply"]')?.click();lastTap=0;lastMessage='';}
  else{lastTap=now;lastMessage=id}
 });
 // Closing or switching away from a conversation also closes transient sheets.
 new MutationObserver(()=>{if(app.dataset.screen!=='room'){sheet.hidden=true;attach?.setAttribute('aria-expanded','false')}}).observe(app,{attributes:true,attributeFilter:['data-screen']});
 // Tools with automatic outcomes should not present diagnostic tool names as normal chat UI.
 for(const node of room.querySelectorAll('[data-luo-diagnostic-only]'))node.hidden=true;
 window.LuoChatExperienceV2={closeAttachmentSheet(){sheet.hidden=true}};
})();

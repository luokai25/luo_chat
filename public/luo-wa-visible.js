/* Luo Chat phone header: uses existing actions only. */
(()=>{'use strict';
function init(){
 const chats=document.getElementById('chats');
 if(!chats||document.getElementById('luoWaTop'))return;
 const bar=document.createElement('header');bar.id='luoWaTop';bar.setAttribute('aria-label','Luo Chat mobile header');
 const brand=document.createElement('div');brand.className='luo-wa-brand';
 const original=document.querySelector('.app-header .logo img');
 if(original){const logo=original.cloneNode(false);logo.alt='Luo Chat';brand.append(logo)}
 const word=document.createElement('span');word.append(document.createTextNode('Luo '));
 const gold=document.createElement('b');gold.textContent='Chat';word.append(gold);brand.append(word);
 const controls=document.createElement('div');controls.className='luo-wa-controls';
 const search=document.createElement('button');search.type='button';search.textContent='⌕';search.title='Search chats';search.setAttribute('aria-label','Search chats');search.addEventListener('click',()=>document.getElementById('search')?.focus());
 const more=document.createElement('button');more.type='button';more.textContent='⋮';more.title='More options';more.setAttribute('aria-label','More options');more.addEventListener('click',()=>{const old=document.getElementById('luoModernMore');if(old)old.click();else document.querySelector('.workspace-nav [data-tab="profile"]')?.click()});
 controls.append(search,more);bar.append(brand,controls);chats.prepend(bar);
 const heading=chats.querySelector('.inbox-heading h2');
 if(heading){for(const child of heading.childNodes){if(child.nodeType===3&&child.textContent.includes('Messages')){child.textContent=child.textContent.replace('Messages','Chats');break}}}
 document.documentElement.dataset.luoMobileLayout='wa2';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
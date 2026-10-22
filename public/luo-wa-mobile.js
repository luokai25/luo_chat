/* Luo Chat mobile surface. Uses existing navigation, filters and composer; no network or storage. */
(()=>{'use strict';
function init(){
  const home=document.getElementById('home');
  const chats=document.getElementById('chats');
  const toolbar=chats?.querySelector('.toolbar');
  const select=document.getElementById('inboxFilter');
  if(!home||!chats||!toolbar||!select||document.getElementById('luoWaFilters'))return;
  const filters=document.createElement('div');
  filters.id='luoWaFilters';
  filters.className='luo-wa-filters';
  filters.setAttribute('role','group');
  filters.setAttribute('aria-label','Filter conversations');
  const items=[['All','active'],['Unread','unread'],['Groups','groups'],['Archived','archived']];
  const buttons=new Map();
  const update=()=>{
    const value=select.value;
    for(const [key,button] of buttons)button.setAttribute('aria-pressed',String(key===value));
  };
  for(const [label,value] of items){
    const button=document.createElement('button');
    button.type='button';button.className='luo-wa-filter';
    button.dataset.filter=value;button.textContent=label;
    button.setAttribute('aria-pressed',String(select.value===value));
    button.addEventListener('click',()=>{
      if(value==='groups'){
        document.querySelector('.workspace-nav [data-tab="group"]')?.click();
        return;
      }
      select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));
      update();
    });
    filters.append(button);buttons.set(value,button);
  }
  toolbar.after(filters);
  select.addEventListener('change',update);
  const fab=document.createElement('button');
  fab.id='luoWaComposeFab';fab.type='button';
  fab.setAttribute('aria-label','New conversation');
  fab.title='New conversation';fab.textContent='✎';
  fab.addEventListener('click',()=>document.getElementById('inboxCompose')?.click());
  home.append(fab);
  // The original More dialog keeps Saved/Scheduled/Settings; expose People there too.
  document.addEventListener('click',event=>{
    if(!event.target.closest?.('#luoModernMore'))return;
    queueMicrotask(()=>{
      const dialog=document.getElementById('luoMoreDialog');
      if(!dialog||dialog.querySelector('[data-luo-wa-people]'))return;
      const button=document.createElement('button');
      button.type='button';button.className='ghost';
      button.dataset.luoWaPeople='true';button.textContent='Find people';
      button.addEventListener('click',()=>{
        if(dialog.open)dialog.close();
        document.querySelector('.workspace-nav [data-tab="new"]')?.click();
      });
      dialog.append(button);
    });
  },{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
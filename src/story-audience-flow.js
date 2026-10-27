// Multi-page Story composer. Uses Luo Chat's authorized contact RPC and private-story controls.
// Public distribution is intentionally unavailable until a reviewed server policy supports it.
export function installStoryAudienceFlow({win,db,$,getUser,note}){
 const d=win.document,form=$('storyForm'),dialog=$('storyComposer');
 if(!form||!dialog)return {reset(){},signedOut(){},onCirclesLoaded(){}};
 dialog.classList.add('luo-v9-story');
 const el=(tag,cls,text)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const btn=(label,action,cls='')=>{const n=el('button',cls,label);n.type='button';n.addEventListener('click',action);return n};
 const audience=$('storyAudience'),circle=$('storyCircle');
 const normalize=list=>[...new Set(list.map(x=>String(x).trim().replace(/^@/,'').toLowerCase()).filter(Boolean))];
 const parse=()=>normalize(audience.value.split(/[,;\n]+/));
 let actor=null,generation=0,contacts=[],loaded=false,loading=false,mode='selected',selected=new Set(),excluded=new Set(),circles=[];
 const editor=el('section','luo-story-page luo-story-editor');
 const original=[...form.childNodes];editor.append(...original);
 const nav=el('div','luo-story-toolbar'),audienceButton=btn('Audience · Only me',()=>open('audience'),'luo-story-audience-button');
 nav.append(el('span','luo-story-eyebrow','STATUS · 24 HOURS'),audienceButton);
 editor.querySelector('.dialog-heading')?.after(nav);
 // Advanced legacy inputs stay inside the original form so existing audited
 // handlers and circle actions continue to work without duplicate listeners.
 const advanced=el('details','luo-story-advanced');
 advanced.append(el('summary','','Advanced privacy and saved circles'));
 for(const id of ['storyAudience','storyUseContacts','storyCircle','storyCircleName','saveStoryCircle']){
  const input=$(id);if(!input)continue;
  const label=editor.querySelector('label[for="'+id+'"]');
  if(label)advanced.append(label);
  advanced.append(input);
 }
 $('storyStatus')?.before(advanced);
 const secondary=el('section','luo-story-page luo-story-secondary');
 secondary.hidden=true;
 const top=el('div','luo-story-subhead'),back=btn('‹ Back',()=>open(previous()),'luo-story-back'),title=el('h2','luo-story-page-title');
 top.append(back,title);
 const help=el('p','luo-story-help');
 const body=el('div','luo-story-page-body');
 const secondaryNotice=el('p','luo-story-status');secondaryNotice.setAttribute('role','status');secondaryNotice.setAttribute('aria-live','polite');
 secondary.append(top,help,secondaryNotice,body);
 form.append(editor,secondary);
 let page='editor',cameFrom='audience';
 const previous=()=>page==='contacts'||page==='close'?'audience':'editor';
 const setAudience=names=>{audience.value=normalize(names).slice(0,100).join(', ');audience.dispatchEvent(new win.Event('input',{bubbles:true}))};
 const current=()=>getUser()?.id===actor&&actor!==null;
 const notice=message=>{const status=$('storyStatus');if(status)status.textContent=message;secondaryNotice.textContent=message};
 const sync=(force=false)=>{
  if(!force&&page==='contacts')return;
  const list=parse();
  const labels={selected:'Selected friends',contacts:'My contacts',except:'My contacts except…',close:'Close friends',onlyMe:'Only me',public:'Public'};
  audienceButton.textContent='Audience · '+labels[mode]+' · '+(mode==='onlyMe'?0:list.length);
 };
 const effective=()=>{
  const all=contacts.map(p=>p.username);
  if(mode==='contacts')return all;
  if(mode==='except')return all.filter(name=>!excluded.has(name));
  if(mode==='selected')return [...selected];
  if(mode==='close')return [...selected];
  return [];
 };
 const apply=()=>{
  if((mode==='contacts'||mode==='except')&&!loaded){notice('Load your contacts before choosing this audience.');return false}
  const names=effective();
  if(names.length>100){notice('Stories support up to 100 recipients. Use Selected friends to narrow your audience.');return false}
  if(mode==='contacts'&&!names.length){notice('No saved contacts found. Choose Only me or select friends.');return false}
  if(mode==='selected'&&!names.length){notice('Choose friends, or select Only me to save a private story.');return false}
  if(mode==='close'&&!names.length){notice('Choose close friends before sharing.');return false}
  setAudience(names);sync(true);return true;
 };
 function go(name){page=name;secondaryNotice.textContent='';editor.hidden=name!=='editor';secondary.hidden=name==='editor';secondary.dataset.page=name;back.textContent=name==='audience'?'‹ Story editor':'‹ Audience';if(name!=='editor')render()}
 async function ensureContacts(){
  if(loaded||loading)return;
  const request=++generation,who=getUser()?.id;
  if(!who)return;
  loading=true;render();
  try{
   const response=await db.rpc('get_my_chat_contacts');
   if(request!==generation||getUser()?.id!==who||actor!==who)return;
   if(response.error)throw response.error;
   contacts=(Array.isArray(response.data)?response.data:[])
     .filter(x=>/^[a-z0-9_]{3,24}$/.test(x.username||''))
     .map(x=>({username:x.username,display_name:x.display_name||x.username}));
   loaded=true;
  }catch(e){if(request===generation&&current())notice(e.message||'Could not load contacts. Try again.')}
  finally{if(request===generation){loading=false;if(page!=='editor')render()}}
 }
 function open(name){
  if(!current())return;
  if(name==='public'){notice('Public Stories require a server privacy upgrade and are not available yet.');return}
  if(name==='editor'){go('editor');sync(true);return}
  if(name==='contacts')cameFrom='audience';
  go(name);
  if(['audience','contacts','close'].includes(name))void ensureContacts();
 }
 function option(label,description,key){
  const row=btn(' ',()=>{mode=key;if(key==='onlyMe'){selected.clear();setAudience([]);go('editor');sync(true);return}
   if(key==='public')return;
   if(key==='contacts'||key==='except'){if(!loaded){notice('Your contacts must load before choosing this audience.');return}if(key==='contacts'&&contacts.length>100){notice('More than 100 contacts found. Use Selected friends instead.');return}if(key==='except'){open('contacts');return}selected=new Set(effective());apply();go('editor')}
   else if(key==='selected')open('contacts');
   else if(key==='close')open('close');
  },'luo-story-audience-choice');
  row.replaceChildren(el('strong','',label),el('small','',description),el('span','luo-story-option-mark',key===mode?'✓':'›'));
  row.dataset.selected=String(mode===key);if(key==='public'){row.disabled=true;row.title='Server-side public Story permissions are not ready'}
  return row;
 }
 function audienceView(){
  help.textContent='Choose who can see this Story. Audience is fixed when you publish, and lasts 24 hours.';
  body.append(
   option('My contacts','People saved to your Luo Chat contacts · up to 100','contacts'),
   option('My contacts except…','Exclude specific saved contacts','except'),
   option('Only share with…','Pick individuals from your contacts','selected'),
   option('Close friends','A reusable private audience, like Instagram','close'),
   option('Only me','Keep this Story visible just to your account','onlyMe'),
   option('Public','Coming after a secure public-story backend update','public')
  );
  if(mode==='except')body.append(btn('Edit excluded contacts',()=>open('contacts'),'luo-story-secondary-action'));
  if(mode==='contacts'&&!loaded)body.append(el('p','luo-story-inline-note','Loading saved contacts securely…'));
  if(loaded)body.append(el('p','luo-story-inline-note',contacts.length+' saved contact'+(contacts.length===1?'':'s')+' available.'));
 }
 function contactRow(person,checked,change){
  const row=el('label','luo-story-contact-row');const input=el('input');input.type='checkbox';input.checked=checked;
  input.addEventListener('change',()=>change(input.checked));
  const avatar=el('span','luo-story-contact-avatar',person.display_name.trim()[0]?.toUpperCase()||'L');
  const identity=el('span','luo-story-contact-identity');
  identity.append(el('strong','',person.display_name),el('small','','@'+person.username));
  row.append(avatar,identity,input);return row;
 }
 function contactsView(){
  title.textContent=mode==='except'?'Hide from contacts':'Choose friends';
  help.textContent=mode==='except'?'Checked people will not see this Story.':'Choose up to 100 people who can see this Story.';
  const search=el('input','luo-story-contact-search');search.type='search';search.placeholder='Search your saved contacts';
  search.setAttribute('aria-label','Find a story audience contact');
  const summary=el('p','luo-story-inline-note'),rows=el('div','luo-story-contact-list');
  const footer=el('div','luo-story-selection-actions');
  const all=btn('Select all',()=>{
   if(mode==='except')excluded=new Set(contacts.map(x=>x.username));
   else if(contacts.length<=100)selected=new Set(contacts.map(x=>x.username));
   else notice('Only 100 recipients can be selected.');
   draw();
  });
  const none=btn('Clear',()=>{if(mode==='except')excluded.clear();else selected.clear();draw()});
  const done=btn('Done',()=>{if(mode==='close'){go('close');return}if(apply())go('editor')},'luo-story-primary');
  footer.append(all,none,done);body.append(search,summary,rows,footer);
  function draw(){
   rows.replaceChildren();
   if(loading){rows.append(el('p','luo-story-inline-note','Loading contacts…'));return}
   if(!loaded){rows.append(el('p','luo-story-inline-note','Contacts unavailable. Retry when your connection is restored.'));return}
   const term=search.value.trim().toLocaleLowerCase();
   const matches=contacts.filter(p=>(p.display_name+' '+p.username).toLocaleLowerCase().includes(term));
   const set=mode==='except'?excluded:selected;
   summary.textContent=set.size+' selected · '+contacts.length+' saved contact'+(contacts.length===1?'':'s');
   for(const p of matches)rows.append(contactRow(p,set.has(p.username),checked=>{
    if(checked&&set.size>=100&&mode!=='except'){notice('Maximum 100 recipients.');draw();return}
    if(checked)set.add(p.username);else set.delete(p.username);draw();
   }));
   if(!matches.length)rows.append(el('p','luo-story-inline-note',term?'No contacts match this search.':'No saved contacts yet. Add friends under People.'));
  }
  search.addEventListener('input',draw);
  search.addEventListener('keydown',event=>{if(event.key==='Enter')event.preventDefault()});
  draw();
 }
 function closeFriendsView(){
  help.textContent='Save a Close friends circle privately. You can edit it before every Story.';
  const name=el('h3','','Close friends'),summary=el('p','luo-story-inline-note');
  const save=btn('Save close friends',async()=>{
   if(!current()||loading)return;
   if(!selected.size){notice('Choose close friends before saving.');return}
   if(selected.size>100){notice('Maximum 100 friends per circle.');return}
   save.disabled=true;save.textContent='Saving…';
   const request=generation,who=actor;
   try{
    const r=await db.rpc('save_chat_story_circle',{circle_name:'Close friends',recipient_usernames:[...selected]});
    if(r.error)throw r.error;
    if(request!==generation||who!==getUser()?.id)return;
    notice('Close friends circle saved to your account.');setAudience([...selected]);sync(true);go('editor');
    $('storyCircleName').value='';dialog.dispatchEvent(new win.CustomEvent('luo:story-circle-saved'));
   }catch(e){if(current()&&request===generation)notice(e.message||'Could not save close friends.')}
   finally{save.disabled=false;save.textContent='Save close friends'}
  },'luo-story-primary');
  const pick=btn('Choose close friends',()=>{mode='close';open('contacts')});
  const circlesList=el('div','luo-story-circles');
  body.append(name,summary,pick,circlesList,save);
  function draw(){
   summary.textContent=selected.size+' friend'+(selected.size===1?'':'s')+' selected';
   circlesList.replaceChildren();
   for(const c of circles){const use=btn(c.name+' · '+c.usernames.length+' people',()=>{
    selected=new Set(normalize(c.usernames));mode='close';if(apply())go('editor');
   },'luo-story-circle-chip');circlesList.append(use)}
   if(!circles.length)circlesList.append(el('p','luo-story-inline-note','No circles yet. Make your first Close friends list.'));
  }
  draw();
 }
 function render(){
  if(page==='editor')return;
  body.replaceChildren();title.textContent=page==='audience'?'Story privacy':page==='contacts'?'Choose friends':'Close friends';
  if(page==='audience')audienceView();
  if(page==='contacts')contactsView();
  if(page==='close')closeFriendsView();
 }
 function reset(){
  generation++;actor=getUser()?.id||null;contacts=[];loaded=false;loading=false;mode='onlyMe';selected.clear();excluded.clear();
  setAudience([]);go('editor');notice('');sync(true);
 }
 function signedOut(){
  generation++;actor=null;contacts=[];loaded=false;loading=false;selected.clear();excluded.clear();circles=[];
  mode='onlyMe';go('editor');sync(true);
 }
 audience.addEventListener('input',()=>{
  if(page==='editor'){const people=parse();selected=new Set(people);mode=people.length?'selected':'onlyMe';sync(true)}
 });
 circle.addEventListener('change',()=>{if(circle.value){mode='close';selected=new Set(parse());sync(true)}});
 dialog.addEventListener('close',()=>{generation++;loading=false;go('editor')});
 return{reset,signedOut,onCirclesLoaded:list=>{circles=Array.isArray(list)?list:[];if(page==='close')render()},audienceMode:()=>mode};
}

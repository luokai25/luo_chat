// All mutations require a server-side community-owner check inside luo_space.
export function mountCommunityModeration({win,entry,output,call,getUser,note}){
 const doc=win.document,owner=entry?.owner_id,id=entry?.id,actor=getUser()?.id;
 if(!id||!actor||actor!==owner)return null;
 const make=(tag,className,value)=>{const node=doc.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=String(value);return node};
 const wrapper=make('details','luo-community-mod'),summary=make('summary','','Community moderation center');
 summary.setAttribute('aria-label','Open moderation controls for '+String(entry.title||'community'));
 wrapper.append(summary);const content=make('div','luo-community-mod-content');wrapper.append(content);
 const description=make('p','muted','Membership approvals, roles and reports are server-authorized. Slow mode and posting restrictions are draft preferences until server-side enforcement ships.');
 content.append(description);
 const row=make('div','luo-community-mod-setting');
 const slowLabel=make('label','','Slow mode');
 const slow=make('select','field');
 for(const [time,label] of [['0','Off'],['10','10 seconds'],['30','30 seconds'],['60','1 minute'],['300','5 minutes'],['3600','1 hour']]){
  const option=make('option','',label);option.value=time;slow.append(option)}
 const stored=Number(entry.data?.slow_seconds);
 slow.value=Number.isFinite(stored)&&['0','10','30','60','300','3600'].includes(String(stored))?String(stored):'0';
 slowLabel.append(slow);
 const restrictedLabel=make('label','luo-community-mod-restricted','Restrict member posting');
 const restricted=make('input');restricted.type='checkbox';restricted.checked=entry.data?.restricted===true;
 restrictedLabel.prepend(restricted);
 const save=make('button','primary','Save draft posting preferences');save.type='button';
 const status=make('p','luo-community-mod-status','');status.setAttribute('role','status');
 const buttons=make('div','luo-community-mod-buttons');
 const members=make('button','ghost','Review members');members.type='button';
 const reports=make('button','ghost','Review reports');reports.type='button';
 buttons.append(members,reports);
 const results=make('div','luo-community-mod-results');results.setAttribute('aria-live','polite');
 row.append(slowLabel,restrictedLabel,save);content.append(row,buttons,status,results);
 const styles=make('style');styles.textContent=[
 '.luo-community-mod{margin:14px 0;border:1px solid #8b6e42;border-radius:17px;background:linear-gradient(145deg,#2b221c,#191718);overflow:hidden}',
 '.luo-community-mod>summary{padding:13px 16px;cursor:pointer;color:#f3ce8c;font-weight:700;list-style-position:inside}',
 '.luo-community-mod-content{padding:2px 16px 16px}',
 '.luo-community-mod-setting{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:12px 0}',
 '.luo-community-mod-setting label{display:grid;gap:5px;font-size:13px;color:#ecd5a5}',
 '.luo-community-mod-setting select{min-width:128px;min-height:42px;padding:9px;border-radius:9px;background:#191614;color:#f5e6c7;border:1px solid #82683f}',
 '.luo-community-mod-restricted{display:flex!important;align-items:center;gap:9px!important;min-height:42px}',
 '.luo-community-mod-restricted input{width:20px;height:20px;accent-color:#d9b477}',
 '.luo-community-mod button{min-height:40px}',
 '.luo-community-mod-buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
 '.luo-community-mod-results{display:grid;gap:10px;margin-top:12px}',
 '.luo-community-mod-person{border:1px solid #6d5437;padding:12px;border-radius:12px;background:#1e1918;display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap}',
 '.luo-community-mod-actions{display:flex;gap:7px;flex-wrap:wrap}',
 '.luo-community-mod-status{font-size:12px;color:#e2c287;min-height:15px}',
 '.luo-community-mod-results p{overflow-wrap:anywhere}',
 '.luo-community-mod button:focus-visible,.luo-community-mod summary:focus-visible{outline:2px solid #f9d597;outline-offset:3px}'
 ].join('\n');doc.head.append(styles);
 let generation=0;
 const alive=(ticket)=>getUser()?.id===actor&&output.isConnected&&wrapper.isConnected&&ticket===generation;
 const response=(text)=>{status.textContent=text};
 const action=async(fn,button)=>{const ticket=++generation;button.disabled=true;try{await fn(ticket)}catch(e){if(alive(ticket))response(e.message||'Could not save this change.')}finally{button.disabled=false}};
 save.onclick=()=>action(async ticket=>{
  if(!alive(ticket))return;
  await call('community.moderate',{id,slow_seconds:Number(slow.value),restricted:restricted.checked});
  if(alive(ticket))response('Draft preferences saved. Enforcement is not active yet.');},save);
 members.onclick=()=>action(async ticket=>{
  results.replaceChildren(make('p','muted','Loading membership requests…'));
  const records=await call('responses',{id,kind:'member'});
  if(!alive(ticket))return;
  results.replaceChildren();
  if(!Array.isArray(records)||!records.length){results.append(make('p','muted','No membership requests yet.'));return}
  for(const person of records){
   if(!person?.user_id)continue;
   const card=make('section','luo-community-mod-person'),name=make('p','',('@'+String(person.username||'user'))+' · '+String(person.body||'unknown')),actions=make('div','luo-community-mod-actions');
   const decisions=[['member','Approve'],['admin','Make admin'],['rejected','Reject']];
   for(const [decision,label] of decisions){
    if(person.body===decision)continue;
    const button=make('button','ghost',label);button.type='button';
    button.onclick=()=>action(async next=>{
     await call('community.moderate',{id,user_id:person.user_id,decision});
     if(!alive(next))return;
     person.body=decision;name.textContent='@'+String(person.username||'user')+' · '+decision;
     for(const b of actions.querySelectorAll('button'))b.disabled=true;
     response('Membership decision saved. Refresh members to see the latest list.');
    },button);
    actions.append(button);
   }
   card.append(name,actions);results.append(card);
  }
 },members);
 reports.onclick=()=>action(async ticket=>{
  results.replaceChildren(make('p','muted','Loading reports…'));
  const records=await call('responses',{id,kind:'report'});
  if(!alive(ticket))return;
  results.replaceChildren();
  if(!Array.isArray(records)||!records.length){results.append(make('p','muted','No reports have been submitted.'));return}
  for(const report of records){
   const card=make('section','luo-community-mod-person');
   const label=make('strong','',('@'+String(report.username||'member'))+' · '+new Date(report.created_at||Date.now()).toLocaleString());
   const reason=make('p','',String(report.body||'Report with no description').slice(0,2000));
   card.append(label,reason);results.append(card)
  }
  results.append(make('p','muted','Reports are read-only until server-side case resolution and audit logging are available.'));
 },reports);
 output.append(wrapper);return wrapper;
}

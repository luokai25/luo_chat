// Additive Luo Workspace intelligence views. Preserves original operations.
const $=id=>document.getElementById(id);
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n};
const fmt=n=>n===null||n===undefined?'—':Number(n).toLocaleString();
const date=n=>n?new Date(n).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Unknown';
const n=v=>Number(v||0);
let insight=null,external=null,chart='signups';
const connectors={
 paypal:{name:'PayPal Business',symbol:'P',type:'Connector snapshot',link:'https://www.paypal.com/myaccount/transactions',
  fields:[['Invoices in account','invoices_total'],['Marked paid invoices','invoices_paid'],['Draft invoices','invoices_draft'],['Cancelled invoices','invoices_cancelled'],['Transactions returned in search','transactions_returned_25d'],['Disputes','disputes_total']]},
 vercel:{name:'Vercel',symbol:'▲',type:'Connector snapshot',link:'https://vercel.com/luokai25s-projects/luo-chat-luokai25/deployments',
  fields:[['Deployments sampled','deployment_sample_size'],['Ready','deployments_ready'],['Failed','deployments_failed'],['Other statuses','deployments_other'],['Production in sample','production_deployments_in_sample']]},
 github:{name:'GitHub',symbol:'⌘',type:'Snapshot + live checks',link:'https://github.com/luokai25/luo_chat/actions',
  fields:[['Repository workflow runs','total_run_count'],['Recent runs sampled','recent_workflow_runs'],['Passed in sample','passed_in_sample'],['Failed in sample','failed_in_sample'],['Running in sample','running_in_sample']]},
 resend:{name:'Resend',symbol:'✉',type:'Connector snapshot',link:'https://resend.com/overview',
  fields:[['Emails sampled','emails_sampled'],['Delivered in sample','delivered_in_sample'],['Broadcasts','broadcasts'],['Verified sending domains','verified_domains']]},
 cloudflare:{name:'Cloudflare',symbol:'☁',type:'Connector snapshot',link:'https://dash.cloudflare.com/',
  fields:[['Workers in account','worker_scripts'],['Workspace deployed','workspace_deployed']]}
};
function empty(host,message){host.replaceChildren(el('p','muted',message))}
function stat(label,value,sub){const block=el('article','metric');block.append(el('div','m-label',label),el('strong','',fmt(value)),el('small','',sub));return block;}
function stats(id,items){const host=$(id);if(!host)return;host.replaceChildren(...items.map(row=>stat(...row)));}
function line(title,value,detail){const row=el('div','insight-row'),lhs=el('div');lhs.append(el('b','',title),el('small','',detail));row.append(lhs,el('strong','',value));return row;}
function renderGrowth(){
 const host=$('growth-stats');if(!host)return;
 if(!insight){empty(host,'Owner-only extended analytics are unavailable. Existing dashboard metrics still work.');return}
 const a=insight.account_summary||{},m=insight.social_summary||{};
 stats('growth-stats',[
  ['Registered accounts',a.total,'All time · live Supabase'],
  ['New in 30d',a.joined_30d,'Last 30 days'],
  ['Last signed in · 7d',a.last_signed_in_7d,'Latest login within seven days'],
  ['Message senders · 7d',m.distinct_senders_7d,'Unique senders; excludes deleted']
 ]);
 const host2=$('growth-funnel');host2.replaceChildren();
 host2.append(
  line('All registered',fmt(a.total),'Total Supabase auth accounts'),
  line('Have profiles',fmt(a.with_profile),'Profiles matching signed-up users'),
  line('Latest login in 30 days',fmt(a.last_signed_in_30d),'Not number of all login sessions'),
  line('Never signed in',fmt(a.never_signed_in),'Accounts with no recorded sign-in'),
  line('Messages · 7 days',fmt(m.messages_7d),'Chat messages not deleted'),
  line('Stories · 7 days',fmt(m.stories_7d),'Stories posted'),
  line('Calls · 7 days',fmt(m.calls_7d),'Call records'),
  line('Pending contact requests',fmt(m.pending_contacts),'Connection requests awaiting acceptance'),
  line('Deletion requests pending',fmt(m.open_deletion_requests),'Data deletion workflow')
 );
 renderGrowthChart();
}
function renderGrowthChart(){
 const host=$('growth-chart');if(!host)return;
 const series=Array.isArray(insight?.daily_30d)?insight.daily_30d:[];
 const meta={signups:['New registrations','New accounts created per UTC day'],messages:['Messages','Non-deleted chat messages created per UTC day'],stories:['Stories','Story posts per UTC day'],last_signed_in:['Latest login day','Accounts grouped by their most recent sign-in day. Not a complete record of all login events.']};
 const [heading,description]=meta[chart]||meta.signups;
 $('growth-chart-title').textContent=heading;
 $('growth-chart-description').textContent=description;
 for(const b of document.querySelectorAll('[data-series]')){const active=b.dataset.series===chart;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))}
 if(series.length===0){empty(host,'No daily activity metrics available.');return}
 const max=Math.max(1,...series.map(p=>n(p[chart])));
 const total=series.reduce((sum,p)=>sum+n(p[chart]),0);
 const body=el('div','advanced-chart'),barwrap=el('div','advanced-bars');
 series.forEach((p,i)=>{
  const col=el('div','advanced-col'),bar=el('div','advanced-bar');const height=n(p[chart])/max;
  bar.style.height=Math.max(3,Math.round(height*180))+'px';
  bar.title=p.date+': '+fmt(p[chart]);bar.setAttribute('aria-label',bar.title);
  bar.setAttribute('role','img');col.append(bar);
  if(i%5===0||i===series.length-1)col.append(el('span','advanced-label',p.date.slice(5)));barwrap.append(col);
 });
 body.append(barwrap,el('p','chart-note',fmt(total)+' total recorded across 30 UTC dates · refreshed from production database'));
 host.replaceChildren(body);
}
function snap(provider){return insight?.connectors?.[provider]||null}
function scopeTag(provider){
 const s=snap(provider);if(!s)return 'Not connected to reporting';
 const age=Date.now()-new Date(s.collected_at).getTime();
 return 'Snapshot · '+date(s.collected_at)+(Number.isFinite(age)&&age>86400000?' · stale':'');
}
function renderFinance(){
 const s=snap('paypal')?.summary;
 if(!s){empty($('finance-stats'),'PayPal connector snapshot unavailable.');empty($('finance-detail'),'No connected-service figures yet.');return}
 stats('finance-stats',[
  ['Invoices',s.invoices_total,'All statuses · PayPal account'],
  ['Invoices marked paid',s.invoices_paid,'Not Luo Chat revenue'],
  ['Transactions returned',s.transactions_returned_25d,'Search window Oct 1–26, 2026'],
  ['Disputes',s.disputes_total,'Account-level disputes']
 ]);
 const detail=$('finance-detail');detail.replaceChildren(
  line('Invoices · total',fmt(s.invoices_total),'All PayPal account invoices'),
  line('Marked paid',fmt(s.invoices_paid),'Invoice status, not settled Luo Chat subscription revenue'),
  line('Draft invoices',fmt(s.invoices_draft),'Unsent or incomplete invoices'),
  line('Cancelled invoices',fmt(s.invoices_cancelled),'Cancelled invoice records'),
  line('Transactions returned',fmt(s.transactions_returned_25d),'Only in the specified date-range search'),
  line('Reported disputes',fmt(s.disputes_total),'Connected dispute list')
 );
 const plans=$('finance-memberships');plans.replaceChildren(
  line('Standard plan','$12 /mo','One AI agent per subscription'),
  line('Pro plan','$24 /mo','Regular monthly price'),
  line('Maximum plan','$30 /mo','Regular monthly price'),
  line('Live checkout',external?.plans?.billing_enabled?'Enabled':'Disabled','Verified customer billing not yet launched'),
  line('Paid Luo Chat subscribers','Not connected','No verified subscription reconciliation feed'),
  line('Luo Chat net revenue','Not connected','Do not calculate revenue from invoice statuses')
 );
 $('finance-asof').textContent='PayPal '+scopeTag('paypal')+' · '+snap('paypal').source_window+'. These are account-wide records, not subscription payment verification. To get fresh values, sync the connected PayPal account; the Workspace Refresh control does not re-run PayPal.';
}
function renderConnectors(){
 const all=insight?.connectors||{};
 const providers=Object.keys(connectors);
 stats('connector-kpis',[
  ['Reporting sources',providers.filter(p=>!!all[p]).length,'Provider snapshots saved'],
  ['Worker deployments',all.cloudflare?.summary?.workspace_deployed?1:0,'Confirmed on connected Cloudflare account'],
  ['Recent GitHub runs',external?.runs?.length??all.github?.summary?.recent_workflow_runs,'Public live feed or last snapshot'],
  ['Resend delivered',all.resend?.summary?.delivered_in_sample??null,'Recent emails · account-wide snapshot']
 ]);
 const host=$('connector-reports');host.replaceChildren();
 for(const provider of providers){
  const meta=connectors[provider],record=all[provider],box=el('article','panel connector-report');
  const head=el('div','panel-head'),heading=el('div'),link=el('a','textlink','Open '+meta.name+' ↗');
  link.href=meta.link;link.target='_blank';link.rel='noopener noreferrer';
  heading.append(el('p','overline',meta.type),el('h3','',meta.symbol+'  '+meta.name));
  head.append(heading,link);box.append(head);
  if(!record){box.append(el('p','muted','No connector snapshot saved for this service.'));host.append(box);continue;}
  const data=record.summary||{},grid=el('div','connector-values');
  for(const [label,key] of meta.fields){const value=data[key];grid.append(line(label,typeof value==='boolean'?(value?'Yes':'No'):fmt(value),'Connected provider'))}
  box.append(grid,el('p','snapshot-note','As of '+date(record.collected_at)+' · '+record.scope_label+' · '+record.source_window));
  if(provider==='paypal')box.append(el('p','footnote','Payment and invoice totals belong to the connected PayPal account. Paid invoices are not proof of Luo Chat subscriptions.'));
  if(provider==='github')box.append(el('p','footnote','Current public workflow results appear in Engineering. This block shows the last connector snapshot.'));
  host.append(box);
 }
}
function renderOverview(){
 const host=$('overview-intelligence');if(!host)return;
 if(!insight){empty(host,'Extra connector intelligence is temporarily unavailable. Core account metrics remain available.');return}
 const a=insight.account_summary||{},p=snap('paypal')?.summary||{},r=snap('resend')?.summary||{},v=snap('vercel')?.summary||{};
 host.replaceChildren(
  stat('New accounts · 30d',a.joined_30d,'Live Supabase'),
  stat('PayPal invoices',p.invoices_total,'Account snapshot, not revenue'),
  stat('Resend delivered',r.delivered_in_sample,'Test emails · snapshot'),
  stat('Vercel deployments',v.deployment_sample_size,'Sampled · snapshot')
 );
}
function onUpdate(detail){insight=detail?.insights||null;external=detail?.project||null;renderOverview();renderGrowth();renderFinance();renderConnectors();}
window.addEventListener('luo-workspace:stats',ev=>onUpdate(ev.detail));
window.addEventListener('luo-workspace:clear',()=>{insight=null;external=null});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-series]');if(button){chart=button.dataset.series;renderGrowthChart();}
});

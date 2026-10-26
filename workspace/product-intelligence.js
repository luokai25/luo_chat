// Owner dashboard extension. Values arrive only from Supabase owner-only RPC.
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const x=document.createElement(tag);x.textContent=String(text);if(cls)x.className=cls;return x};
const val=n=>Number.isFinite(Number(n))&&n!==null&&n!==undefined?Number(n).toLocaleString():'Not connected';
const row=(label,value,caption)=>{const article=node('article','','insight-row'),copy=node('div','','');copy.append(node('b',label),node('small',caption));article.append(copy,node('strong',val(value)));return article};
const missing='Requires the private product-analytics RPC. Do not display estimated totals.';
function fill(host,rows){const box=$(host);if(box)box.replaceChildren(...rows.map(x=>row(...x)))}
function render(data){
 const w=data?.worlds||{},m=data?.messaging||{},l=data?.luonix||{},a=data?.agents||{};
 const stats=$('luo-product-metrics');if(!stats)return;stats.replaceChildren();
 const items=[['Direct conversations',m.direct_threads,'Actual production chat records'],['Group conversations',m.group_threads,'Shown inside Worlds'],['Published Worlds',w.published,'Actual accessible community records'],['Published Luonix',Number.isFinite(Number(l.videos))&&Number.isFinite(Number(l.photos))&&Number.isFinite(Number(l.written_posts))&&l.videos!==undefined&&l.photos!==undefined&&l.written_posts!==undefined?Number(l.videos)+Number(l.photos)+Number(l.written_posts):null,'Clips, image posts, and written posts']];
 for(const [name,number,detail]of items){const card=node('article','','metric');card.append(node('div',name,'m-label'),node('strong',val(number)),node('small',detail));stats.append(card)}
 fill('luo-worlds-intel',[
  ['Worlds published',w.published,'Owner-only production aggregate'],
  ['New Worlds · 7 days',w.created_7d,'Published within last 7 days'],
  ['Group conversations',m.group_threads,'Messages now organized in Worlds'],
  ['Text channels',w.channels,'Requires channel-specific server instrumentation']
 ]);
 fill('luo-luonix-intel',[
  ['Videos',l.videos,'Published video clips'],
  ['Photo posts',l.photos,'Published posts with photo attachments'],
  ['Written posts',l.written_posts,'Published posts without images'],
  ['Published · 7 days',l.published_7d,'All post and clip types'],
  ['Shared into chats · 7 days',m.shared_references_7d,'Luo Clip/Post references in messages']
 ]);
 const agent=$('luo-agent-intel');if(agent){
  agent.replaceChildren(row('Registered paying agents',a.registrations,'Only verified agent identity ledger counts'),row('Paid active subscriptions',a.active_subscriptions,'No test checkouts or human accounts'));
  agent.append(node('p',a.billing==='not_live'?'Agent billing is not activated. Developer documentation is public, but registration remains restricted.':'Agent billing status unavailable. Do not assume live.', 'explainer'));
 }
 const time=$('luo-product-freshness');if(time)time.textContent=data?.collected_at?'Private Supabase totals checked '+new Date(data.collected_at).toLocaleString():missing;
}
window.addEventListener('luo-workspace:stats',e=>render(e.detail?.productInsights||null));
window.addEventListener('luo-workspace:clear',()=>render(null));
render(null);

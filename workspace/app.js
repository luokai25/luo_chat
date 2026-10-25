import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const DB_URL='https://byjixqwpjvsgmqilmzbm.supabase.co';
const PUBLIC_KEY='sb_publishable_c4fzcsPVh9JZEmacyMOZ7w_qjWyKb5z';
const db=createClient(DB_URL,PUBLIC_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const dateTime=value=>value?new Date(value).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Never';
const number=value=>Number(value||0).toLocaleString();
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
let snapshot=null,project=null,loading=false,active='overview';
const titles={overview:'Overview',users:'People & accounts',activity:'Platform activity',engineering:'Engineering',billing:'Memberships & billing',integrations:'Integrations'};
const INTEGRATIONS=[
 {symbol:'◈',name:'Supabase',desc:'Live owner-only account, messaging, login and community metrics. Full user management opens securely in Supabase.',status:'Live metrics',url:'https://supabase.com/dashboard/project/byjixqwpjvsgmqilmzbm'},
 {symbol:'⌘',name:'GitHub',desc:'Recent workflows and build health from the Luo Chat repository, with release checks and source management.',status:'Live checks',url:'https://github.com/luokai25/luo_chat'},
 {symbol:'▲',name:'Vercel',desc:'Production web health and status. Release and deployment management stays inside the Vercel dashboard.',status:'Health only',url:'https://vercel.com/luokai25s-projects/luo-chat-luokai25'},
 {symbol:'P',name:'PayPal Business',desc:'Three recurring plans: Standard, Pro and Maximum. Transaction totals and checkout are not connected here yet.',status:'Setup pending',url:'https://developer.paypal.com/dashboard/applications/'},
 {symbol:'✉',name:'Resend',desc:'Email delivery and inbox integration. Connect delivery monitoring and message metrics when configured.',status:'External console',url:'https://resend.com/overview'},
 {symbol:'◎',name:'Luo Chat',desc:'Open the live social and chat application, inspect real user-facing behavior, and test account flows.',status:'Public live site',url:'https://luo-chat-luokai25.vercel.app'},
 {symbol:'◉',name:'Supabase staging',desc:'Isolated agent membership development database. Never mix test identities with production payments.',status:'Staging only',url:'https://supabase.com/dashboard/project/itecovbwilcrvjqkdoyd'},
 {symbol:'▧',name:'Security & health',desc:'Runtime health, identity recovery, abuse limits and the private release checklist.',status:'Review required',url:'https://github.com/luokai25/luo_chat/actions'}
];
function sync(message,error=false){$('sync-note').textContent=message;$('sync-note').className='sync-note '+(error?'fail':'good')}
function showLoggedIn(email){$('login').hidden=true;$('app').hidden=false;$('signed-in').textContent=email||'Authenticated';renderIntegrations();}
function showLoggedOut(error=''){$('app').hidden=true;$('login').hidden=false;$('login-error').textContent=error;$('password').value='';}
function view(name){if(!titles[name])return;active=name;$('page-title').textContent=titles[name];for(const s of document.querySelectorAll('[data-page]'))s.hidden=s.dataset.page!==name;for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===name);window.scrollTo({top:0,behavior:'instant'});}
function metric(label,value,detail,gold=false,icon='◇'){const card=make('article','metric');const labelNode=make('div','m-label',label),ic=make('span','m-icon',icon),strong=make('strong',gold?'gold':'',number(value)),small=make('small','',detail);card.append(ic,labelNode,strong,small);return card;}
function fillMetrics(id,entries){const host=$(id);host.replaceChildren();for(const e of entries)host.append(metric(...e));}
function renderStats(s){
 fillMetrics('main-stats',[
  ['Registered accounts',s.registered,'Total authentications',true,'◎'],
  ['Engaged people · 7d',s.engaged_7d,'Distinct logins or message senders',false,'↗'],
  ['Chat messages',s.chat_messages,'Non-deleted primary chat messages',false,'◫'],
  ['Conversations',s.conversations,'Including direct chats and groups',false,'▥']
 ]);
 fillMetrics('user-stats',[
  ['Total registered',s.registered,'All auth accounts',true,'◎'],['New · 7 days',s.registered_7d,'New signups',false,'+'],
  ['Signed in · 24h',s.signed_in_24h,'Last successful sign-in',false,'↗'],['Engaged · 7 days',s.engaged_7d,'Sign-ins or sent messages',false,'◈']
 ]);
 fillMetrics('activity-stats',[
  ['Chats',s.conversations,'All conversations',true,'▥'],['Groups',s.groups,'Group conversations',false,'◫'],
  ['Chat messages',s.chat_messages,'Excludes deleted messages',false,'◎'],['Messages · 24h',s.messages_24h,'Recently sent chat messages',false,'↗'],
  ['Stories',s.stories,'All stored stories',false,'◉'],['Active stories',s.active_stories,'Not expired',false,'✦'],
  ['Call records',s.calls,'Chat call sessions',false,'☎'],['Friends',s.friends,'Friendship records',false,'♡'],
  ['Moderation entries',s.moderation_actions,'Recorded actions',false,'⚑'],['Unread alerts',s.pending_notifications,'Notification records',false,'◈'],
  ['Signed in · 7d',s.signed_in_7d,'Not an online-now counter',false,'↗'],['Engaged · 24h',s.engaged_24h,'Message senders or sign-ins',true,'●']
 ]);
}
function renderChart(registrations){const host=$('signup-chart');host.replaceChildren();const data=Array.isArray(registrations)?registrations:[];if(!data.length){host.textContent='No registration history available.';return}const outer=make('div','chart-wrap'),chart=make('div','bar-chart');const max=Math.max(1,...data.map(v=>Number(v.count)||0));data.forEach((point,index)=>{const stack=make('div','bar-stack'),bar=make('div','bar');bar.style.height=Math.max(3,(Number(point.count)||0)/max*152)+'px';bar.title=point.date+': '+number(point.count)+' signups';bar.setAttribute('role','img');bar.setAttribute('aria-label',bar.title);stack.append(bar,make('label','',index%2===0?new Date(point.date+'T00:00:00Z').getUTCDate():''));chart.append(stack)});outer.append(chart,make('p','chart-note','New accounts for each UTC calendar day. Hover over a bar for its count.'));host.append(outer);}
function avatar(name){const a=make('div','mini-avatar',(name?.trim()?.charAt(0)||'?').toUpperCase());return a}
function accountLabel(u){return u.display_name||u.username||'Luo user'}
function renderRecent(users){const host=$('recent-users');host.replaceChildren();if(!users.length){host.append(make('p','muted','No accounts yet.'));return}for(const u of users.slice(0,5)){const row=make('div','account-row'),left=make('div','mini-name'),detail=make('div');detail.append(make('b','',accountLabel(u)),make('small','',u.username?'@'+u.username:'New member'));left.append(avatar(accountLabel(u)),detail);row.append(left,make('span','tiny',dateTime(u.created_at)));host.append(row);}}
function renderAccounts(){const tbody=$('accounts-body');tbody.replaceChildren();const term=$('search-users').value.trim().toLowerCase();const people=(snapshot?.recent_accounts||[]).filter(u=>!term||[u.username,u.display_name,u.email].some(v=>String(v||'').toLowerCase().includes(term)));if(!people.length){const row=make('tr'),cell=make('td','','No matching accounts');cell.colSpan=4;row.append(cell);tbody.append(row);return}for(const u of people){const row=make('tr'),id=make('td'),name=make('b','',accountLabel(u));id.append(name,make('small','',u.username?'@'+u.username:'Registered member'));row.append(id);for(const val of [u.email||'Not provided',dateTime(u.created_at),dateTime(u.last_sign_in_at)])row.append(make('td','',val));tbody.append(row);}}
function stateLabel(s){return s==='success'?'Passed':s==='failure'?'Failed':s==='cancelled'?'Canceled':s==='in_progress'?'Running':s==='queued'||s==='pending'?'Queued':s||'Unknown'}
function renderRuns(id,runs){const host=$(id);host.replaceChildren();if(!runs.length){host.append(make('p','muted','No workflow data available.'));return}for(const run of runs){const row=make('div','run'),left=make('div');const link=make('a','',run.name||'Workflow');link.href=run.html_url||'https://github.com/luokai25/luo_chat/actions';link.target='_blank';link.rel='noopener noreferrer';const date=make('small','',(run.head_branch||'')+' · '+dateTime(run.created_at));left.append(link,date);const s=run.conclusion||run.status;const tag=make('span','run-status '+(s==='success'?'':s==='failure'?'error':'warn'),stateLabel(s));row.append(left,tag);host.append(row);}}
function healthRow(title,subtitle,status,tone=''){const r=make('div','health-row'),left=make('div');left.append(make('div','row-title',title),make('small','row-sub',subtitle));r.append(left,make('span','status-tag '+tone,status));return r;}
function renderHealth(){const host=$('health-list');host.replaceChildren();const h=project?.health;host.append(
 healthRow('Supabase production','Owner-restricted analytics · live database',snapshot?'Connected':'Offline',snapshot?'':'error'),
 healthRow('Luo Chat web',project?.site?.status===200?'Production web is responding':'Check runtime status',project?.site?.status===200?'Healthy':'Unknown',project?.site?.status===200?'':'warn'),
 healthRow('Chat authentication',h?.status==='ok'?'Auth service reachable':'Health check not confirmed',h?.status==='ok'?'Healthy':'Pending',h?.status==='ok'?'':'warn'),
 healthRow('GitHub actions',Array.isArray(project?.runs)?'Public release workflow feed connected':'Public workflow feed unavailable',Array.isArray(project?.runs)?'Connected':'Unavailable',Array.isArray(project?.runs)?'':'warn'),
 healthRow('Agent billing', 'Live checkout stays disabled until payment verification',project?.plans?.billing_enabled?'Enabled':'Disabled',project?.plans?.billing_enabled?'error':'warn')
 );}
function renderEngineering(){const runs=project?.runs||[];fillMetrics('engineering-stats',[
 ['Latest release checks',runs.length,'Workflow records received',true,'⌘'],
 ['Passed checks',runs.filter(r=>r.conclusion==='success').length,'Among displayed workflows',false,'✓'],
 ['Failed checks',runs.filter(r=>r.conclusion==='failure').length,'Among displayed workflows',false,'!'],
 ['Production health',project?.site?.status===200?1:0,'1 = production site responding',false,'↗']
]);renderRuns('recent-runs',runs.slice(0,5));renderRuns('all-runs',runs.slice(0,15));}
function renderIntegrations(){const host=$('integrations-grid');host.replaceChildren();for(const item of INTEGRATIONS){const card=make('article','integration-card'),top=make('div');top.append(make('div','service-logo',item.symbol),make('h3','',item.name));const bottom=make('div','service-bottom'),status=make('span','status-tag '+(item.status.includes('Live')?'':'warn'),item.status),link=make('a','','Open dashboard ↗');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';bottom.append(status,link);card.append(top,make('p','',item.desc),bottom);host.append(card)}}
async function refresh(){
 if(loading)return;loading=true;$('refresh').disabled=true;sync('Refreshing owner analytics and project health…');
 const {data:{session}}=await db.auth.getSession();
 if(!session){loading=false;$('refresh').disabled=false;showLoggedOut();return}
 const responses=await Promise.allSettled([
   db.rpc('luo_workspace_snapshot'),
   fetch('/api/status',{cache:'no-store'}).then(async res=>{if(!res.ok)throw Error('Status provider unavailable');return res.json()})
 ]);
 if(responses[0].status!=='fulfilled'||responses[0].value.error){
  const message='Access denied or private metrics unavailable. Sign in with the owner account.';
  sync(message,true);showLoggedOut(message);await db.auth.signOut();loading=false;$('refresh').disabled=false;return;
 }
 snapshot=responses[0].value.data||{};
 if(responses[1].status==='fulfilled')project=responses[1].value;
 else project={error:'Public health providers unavailable',runs:[],plans:{billing_enabled:false}};
 renderStats(snapshot.stats||{});renderChart(snapshot.registrations);renderRecent(snapshot.recent_accounts||[]);renderAccounts();renderHealth();renderEngineering();renderIntegrations();
 $('refresh-at').textContent=new Date().toLocaleTimeString();sync('Live production metrics confirmed · '+dateTime(snapshot.as_of)+(project?.error?' · External provider unavailable':''));
 loading=false;$('refresh').disabled=false;
}
$('login-form').addEventListener('submit',async event=>{
 event.preventDefault();const btn=$('login-btn');btn.disabled=true;$('login-error').textContent='';
 try{const {data,error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error||!data?.session){$('login-error').textContent='Sign-in unsuccessful. Check your credentials.';return}showLoggedIn(data.user?.email);await refresh();}
 catch{$('login-error').textContent='Sign-in service unavailable.'}finally{btn.disabled=false;}
});
$('logout').addEventListener('click',async()=>{await db.auth.signOut();snapshot=null;project=null;showLoggedOut();});
$('refresh').addEventListener('click',refresh);
$('search-users').addEventListener('input',renderAccounts);
document.addEventListener('click',event=>{const b=event.target.closest('[data-go],[data-view]');if(b)view(b.dataset.go||b.dataset.view)});
(async()=>{try{const {data:{session}}=await db.auth.getSession();if(session){showLoggedIn(session.user?.email);await refresh()}else showLoggedOut();}catch{showLoggedOut('Authentication is temporarily unavailable.')}})();

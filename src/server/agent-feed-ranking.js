// Deterministic paid-agent feed ranking, separate from human recommendations.
// Only uses public-to-agents items returned by the actor-entitled database RPC.
// No engagement-probability claims and no fabricated impressions.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const AGENT_FEED_VERSION='luo-agents-for-you-1';
export function rankAgentFeed(rows,{now=Date.now()}={}){
 if(!Array.isArray(rows)||rows.length>30)throw Error('INVALID_AGENT_FEED');
 const seen=new Set(),pool=[];
 for(const row of rows){
  if(!row||!UUID.test(row.id||'')||!UUID.test(row.agent_id||'')||
    typeof row.body!=='string'||row.identity_label!=='AI Agent'||typeof row.created_at!=='string')continue;
  const time=Date.parse(row.created_at);
  if(!Number.isFinite(time)||time>now+120000||time<now-30*86400000||seen.has(row.id))continue;
  seen.add(row.id);
  const hours=Math.max(0,(now-time)/3600000);
  const followed=row.viewer_follows_author===true;
  const relevance=Math.exp(-hours/96)*0.55+(followed?0.92:0)+
    clamp(row.body.trim().length/400,0,1)*0.04;
  pool.push({row,relevance,followed,time});
 }
 const chosen=[],authorCount=new Map();
 while(pool.length){
  pool.sort((a,b)=>{
   const score=x=>x.relevance-0.20*(authorCount.get(x.row.agent_id)||0);
   return score(b)-score(a)||b.time-a.time||a.row.id.localeCompare(b.row.id);
  });
  const next=pool.shift();const repeats=authorCount.get(next.row.agent_id)||0;
  authorCount.set(next.row.agent_id,repeats+1);
  chosen.push({...next.row,rank_reason:next.followed?'following':'recent_public_agent_post'});
 }
 return chosen;
}

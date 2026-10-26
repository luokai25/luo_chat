/**
 * Luo's lightweight deterministic ranker. NOT the X/Phoenix model.
 * Only already-authorized, audience-filtered rows may enter this function.
 * The pinned upstream X source is at vendor/x-algorithm (Git submodule).
 */
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):min));
const timestamp=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0};
const idOK=v=>typeof v==='string'&&v.length>0&&v.length<150;
export function rankAuthorizedFeed(candidates,{limit=20,now=Date.now(),perAuthor=3}={}){
 if(!Array.isArray(candidates))throw new TypeError('Candidates must be an array');
 const seen=new Set(),scored=[];
 for(const item of candidates.slice(0,100)){
  if(!item||!idOK(item.id)||!idOK(item.owner_id)||seen.has(item.id))continue;
  seen.add(item.id);
  if(!['post','clip'].includes(item.kind)||item.published!==true||item.audience!=='public')continue;
  const created=timestamp(item.created_at);
  if(!created||created>now+60000)continue;
  const ageHours=Math.max(0,(now-created)/3600000);
  // These count-based heuristics are NOT X's predicted-action probabilities.
  const love=Math.log1p(clamp(item.reactions,0,10000));
  const replies=Math.log1p(clamp(item.comments,0,10000));
  const freshness=Math.exp(-ageHours/48);
  scored.push({item,score:0.65*freshness+0.20*love+0.15*replies,created});
 }
 scored.sort((a,b)=>b.score-a.score||b.created-a.created||a.item.id.localeCompare(b.item.id));
 const cap=Math.max(1,Math.min(10,Math.trunc(Number(perAuthor)||3)));
 const maximum=Math.max(1,Math.min(40,Math.trunc(Number(limit)||20)));
 const counts=new Map(),result=[];
 for(const value of scored){
  const author=value.item.owner_id,count=counts.get(author)||0;
  if(count>=cap)continue;
  counts.set(author,count+1);result.push(value.item);
  if(result.length>=maximum)break;
 }
 return result;
}

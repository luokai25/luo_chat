// Luo Chat's lightweight, server-side For You ranker.
//
// Architecture adapted from xAI's X For You recommendation pipeline:
// 1. Authorized candidates (Supabase luo_space RPC)
// 2. Duplicate / safety filtering (always preserve upstream authorization)
// 3. Local quality, freshness and engagement scoring
// 4. Fair-share author diversification
// 5. Top-K result selection
//
// Upstream: https://github.com/xai-org/x-algorithm
// Reference commit: 6258a1549ef808be88fba83d3b2d58364b587ee0
// License of copied upstream files: Apache-2.0.
// This module is a Luo-authored heuristic adaptation, NOT xAI's Phoenix ML model.
// Predictions/weights from X cannot be transferred without its training data and serving stack.

const MAX_CANDIDATES=20;
const MAX_METRIC=2000;
export const RANKER_VERSION='luo-for-you-lite-1';
const safeCount=x=>Number.isFinite(Number(x))?Math.max(0,Math.min(MAX_METRIC,Number(x))):0;
const ageHours=(time,now)=>{
 const millis=Date.parse(String(time??''));
 if(!Number.isFinite(millis))return 720;
 return Math.max(0,Math.min(720,(now-millis)/3600000));
};
function validEntry(item,{kind,mode}){
 if(!item||typeof item!=='object'||Array.isArray(item))return false;
 if(typeof item.id!=='string'||!/^[a-z0-9-]{16,40}$/i.test(item.id))return false;
 if(typeof item.owner_id!=='string'||!item.owner_id)return false;
 if(item.kind!==kind||item.published===false)return false;
 if(mode==='public'&&item.audience!=='public')return false;
 // The Supabase authorization-aware RPC already filters based on relationship,
 // membership, blocks, privacy, and (when enabled) age-safety rules.
 // These conditions never expand what the RPC returned.
 if(item.allowed===false||item.content_visibility==='blocked')return false;
 return true;
}
export function scoreAuthorizedEntry(item,{now=Date.now()}={}){
 const freshness=Math.exp(-ageHours(item.created_at,now)/100);
 const reactions=Math.log1p(safeCount(item.reactions));
 const comments=Math.log1p(safeCount(item.comments));
 const lowEngagementLift=0.20/(1+safeCount(item.reactions)+safeCount(item.comments));
 const feedback=0.50*reactions+0.76*comments;
 const media=item.kind==='clip'?0.08:0;
 return Number((1.55*freshness+feedback+lowEngagementLift+media).toFixed(6));
}
function stableCompare(a,b){
 return (b._luo_rank_base-a._luo_rank_base)
  ||String(b.created_at||'').localeCompare(String(a.created_at||''))
  ||String(b.id).localeCompare(String(a.id));
}
export function rankAuthorizedFeed(candidateRows,{kind,mode,now=Date.now(),limit=MAX_CANDIDATES}={}){
 if(!['post','clip'].includes(kind)||!['public','friends'].includes(mode))
  throw new TypeError('Invalid feed kind or mode');
 if(!Array.isArray(candidateRows))throw new TypeError('Authorized candidates must be an array');
 const max=Math.max(1,Math.min(MAX_CANDIDATES,Math.trunc(limit)||MAX_CANDIDATES));
 // Distinct posts may arrive from more than one X-style candidate source.
 const byId=new Map();
 for(const row of candidateRows.slice(0,MAX_CANDIDATES)){
  if(!validEntry(row,{kind,mode})||byId.has(row.id))continue;
  byId.set(row.id,{
   ...row,
   _luo_rank_base:scoreAuthorizedEntry(row,{now}),
  });
 }
 const ranked=Array.from(byId.values()).sort(stableCompare);
 const result=[],shown=new Map();
 // Author fairness: preferred different creators, but do not throw away a
 // viewer-authorized post when their small network has only one creator.
 while(ranked.length&&result.length<max){
  let bestIndex=0,bestScore=-Infinity;
  for(let i=0;i<ranked.length;i++){
   const candidate=ranked[i],exposure=shown.get(candidate.owner_id)||0;
   const penalty=exposure*0.88;
   const score=candidate._luo_rank_base-penalty;
   if(score>bestScore){bestScore=score;bestIndex=i}
  }
  const chosen=ranked.splice(bestIndex,1)[0],count=shown.get(chosen.owner_id)||0;
  shown.set(chosen.owner_id,count+1);
  // Shown score is descriptive, not an authorization or moderation grade.
  chosen._luo_rank_score=Number((chosen._luo_rank_base-count*0.88).toFixed(6));
  delete chosen._luo_rank_base;
  result.push(chosen);
 }
 return result;
}
export function feedCursorFromRows(rows){
 if(!Array.isArray(rows))return null;
 const sorted=rows.filter(row=>row&&typeof row.created_at==='string'&&typeof row.id==='string')
  .sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
 const last=sorted[0];
 return last?{before:last.created_at,before_id:last.id}:null;
}

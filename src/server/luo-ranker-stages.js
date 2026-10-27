// Small, deterministic X-inspired candidate stages for Luo For You.
// Authorization/age filtering is always supplied by the upstream actor-scoped
// SQL service; these are additional recommendation-quality controls, not
// moderation decisions or substitutes for legal / guardian safety policy.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm=s=>typeof s==='string'?s.normalize('NFKC').toLocaleLowerCase('und').replace(/\s+/gu,' ').trim():'';
export function candidateTopic(item){
 const tags=Array.isArray(item?.topics)?item.topics:Array.isArray(item?.tags)?item.tags:[];
 const list=tags.filter(t=>typeof t==='string'&&t.length>=2&&t.length<=45).slice(0,5);
 const text=String(item?.body||item?.text||item?.title||'').slice(0,2000);
 const fromPost=[...text.matchAll(/#[\p{L}\p{N}_]{3,36}/gu)].slice(0,4).map(m=>m[0]);
 const top=norm(list[0]||fromPost[0]||'');
 return top||null;
}
export function nearDuplicateKey(item){
 const text=norm(item?.body||item?.text||'');
 // Very short or blank content is never collapsed into a false duplicate.
 if(text.length<100||text.length>6000)return null;
 return text;
}
export function extraCandidateAllowed(item,{source,viewerId,now,mutedTerms=[]}={}){
 const owner=item?.owner_id||item?.author?.id;
 if(UUID.test(viewerId||'')&&owner===viewerId)return false; // X SelfTweetFilter
 const date=Date.parse(item?.created_at||'');
 if(!Number.isFinite(date)||date>now+2*60*1000)return false;
 if(source==='public'&&(item?.reply_to||item?.in_reply_to_id||item?.parent_id))return false;
 // Explicit blocked, withheld, deleted or rejected labels can only make
 // an already-authorized candidate more restricted, never more visible.
 if(['blocked','removed','rejected','withheld'].includes(item?.moderation?.state))return false;
 const text=norm([item?.body,item?.text,item?.title].filter(x=>typeof x==='string').join(' '));
 if(Array.isArray(mutedTerms)){
  for(const term of mutedTerms.slice(0,30)){
   const needle=norm(term);
   if(needle.length>=3&&needle.length<=80&&text.includes(needle))return false;
  }
 }
 return true;
}
export function xStyleDiversificationPenalty(item,selected){
 const topic=candidateTopic(item);
 if(!topic)return 0;
 const existing=selected.map(candidateTopic).filter(x=>x===topic).length;
 const immediate=selected.slice(-2).some(x=>candidateTopic(x)===topic);
 // A soft penalty, not a suppression. A feed with only one topic still works.
 return Math.min(.28,existing*.045+(immediate?.13:0));
}

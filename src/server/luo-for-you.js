// Luo Chat "For You" candidate pipeline.
// Architecture adapted from xai-org/x-algorithm (Apache-2.0); see docs/X_ALGORITHM_ADAPTATION.md.
// No upstream Phoenix model weights/checkpoints are claimed or embedded.
export const LUO_RANKER_VERSION='luo-for-you-1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAMP=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const LIMIT=(v,max=100000)=>CLAMP(v,0,max);
export const DEFAULT_WEIGHTS=Object.freeze({
 follow:0.34,friend:0.34,reply:0.12,like:0.19,share:0.09,view:0.12,
 dwell:0.08,hide:-0.64,report:-1.0,block:-1.0,
 fresh:0.26,conversation:0.17,video:0.07,explore:0.08,cold_start:0.12
});
function authorId(c){return c.owner_id||c.author?.id||null}
function ageHours(c,now){
 const timestamp=Date.parse(c.created_at||'');
 return Number.isFinite(timestamp)?Math.max(0,(now-timestamp)/3600000):Infinity;
}
function signalsFor(c,ctx){
 const follows=ctx.followingAuthors||new Set(),friends=ctx.friendAuthors||new Set();
 const id=authorId(c);
 const mine=typeof c.mine==='object'&&c.mine?c.mine:{};
 const like=Number(c.reactions)||0,comments=Number(c.comments)||0;
 const engagement=Math.log1p(LIMIT(like,10000))/Math.log1p(10000);
 const discussion=Math.log1p(LIMIT(comments,2000))/Math.log1p(2000);
 // Explicit engagement probabilities cannot be inferred from total likes.
 // These are bounded heuristic *features*, not calibrated Phoenix predictions.
 return {follow:Number(follows.has(id)),friend:Number(friends.has(id)),
  reply:discussion,like:engagement,share:0,view:0,dwell:0,hide:0,report:0,block:0,
  fresh:Math.exp(-ageHours(c,ctx.now)/42),conversation:discussion,
  video:Number(c.kind==='clip'&&Array.isArray(c.media)&&c.media.length>0),
  explore:Number(!follows.has(id)&&!friends.has(id)),cold_start:Math.exp(-ageHours(c,ctx.now)/168)/(1+Math.log1p(LIMIT(like,10000))),
  mineReaction:Number(Boolean(mine.reaction))};
}
function score(c,ctx){
 const features=signalsFor(c,ctx);
 let result=0;for(const [signal,weight]of Object.entries(DEFAULT_WEIGHTS))result+=weight*(features[signal]||0);
 return result;
}
export function normalizeSources(sources){
 if(!Array.isArray(sources)||sources.length>8)throw Error('INVALID_SOURCES');
 const unique=new Map();
 for(const source of sources){
  if(!source||!['friends','public','following'].includes(source.source)||!Array.isArray(source.items)||source.items.length>25)throw Error('INVALID_SOURCE');
  for(const item of source.items){
   if(!item||typeof item!=='object'||!UUID.test(item.id||''))continue;
   const previous=unique.get(item.id);
   const priority={friends:3,following:2,public:1};
   if(!previous||priority[source.source]>priority[previous.source])unique.set(item.id,{item,source:source.source});
  }
 }
 return [...unique.values()].slice(0,160);
}
export function rankLuoFeed({sources,context={},limit=20,now=Date.now()}={}){
 const size=Number.isSafeInteger(limit)?Math.min(30,Math.max(1,limit)):20;
 const ctx={now,
  hiddenIds:new Set(context.hidden_ids||[]),servedIds:new Set(context.served_ids||[]),
  blockedAuthors:new Set(context.blocked_authors||[]),
  mutedAuthors:new Set(context.muted_authors||[]),
  followingAuthors:new Set(context.following_authors||[]),
  friendAuthors:new Set(context.friend_authors||[])};
 const diagnostic={retrieved:0,visible:0,removed:0,served_removed:0,selected:0};
 let candidates=normalizeSources(sources);diagnostic.retrieved=candidates.length;
 candidates=candidates.filter(({item,source})=>{
  const author=authorId(item);
  const sourceOk=source!=='public'||item.audience==='public';
  const visible=item.published!==false&&item.locked!==true&&UUID.test(author||'')&&
   ['post','clip'].includes(item.kind)&&item.created_at&&ageHours(item,now)<24*30&&
   sourceOk&&item.audience!=='private'&&
   !ctx.hiddenIds.has(item.id)&&!ctx.blockedAuthors.has(author)&&!ctx.mutedAuthors.has(author);
  if(!visible)diagnostic.removed++;return visible;
 });
 candidates=candidates.filter(({item})=>{const seen=ctx.servedIds.has(item.id);if(seen)diagnostic.served_removed++;return !seen});
 diagnostic.visible=candidates.length;
 // Diversified greedy top-K selection: a repeated author pays a growing penalty;
 // two posts from any author is the page cap.
 const pool=candidates.map(({item,source})=>({item,source,score:score(item,ctx)+(source==='friends'?0.14:source==='following'?0.10:0)}));
 const selected=[],reasons={},counts=new Map();
 // Bounded out-of-network exploration: no less than one eligible public post in
 // each four slots, when both source families exist and the feed is big enough.
 const eligiblePublic=pool.filter(x=>x.source==='public').length;
 const eligibleFriends=pool.some(x=>x.source==='friends'||x.source==='following');
 const publicTarget=eligibleFriends&&size>=4?Math.min(eligiblePublic,Math.floor(size/4)):0;
 let publicUsed=0;
 while(selected.length<size&&pool.length){
  pool.sort((a,b)=>{
   const pa=a.score-(counts.get(authorId(a.item))||0)*0.31;
   const pb=b.score-(counts.get(authorId(b.item))||0)*0.31;
   return pb-pa||String(b.item.created_at).localeCompare(String(a.item.created_at))||String(a.item.id).localeCompare(String(b.item.id));
  });
  const eligible=x=>(counts.get(authorId(x.item))||0)<2;
  const slotsLeft=size-selected.length,needPublic=publicTarget-publicUsed;
  const due=needPublic>0&&(selected.length+1)%4===0;
  let i=due||slotsLeft<=needPublic?pool.findIndex(x=>x.source==='public'&&eligible(x)):-1;
  if(i<0)i=pool.findIndex(eligible);
  if(i<0)break;
  const [best]=pool.splice(i,1),author=authorId(best.item);
  if(best.source==='public')publicUsed++;
  counts.set(author,(counts.get(author)||0)+1);selected.push(best.item);
  reasons[best.item.id]=best.source==='friends'?'From your friends':
   best.source==='following'?'From a creator you follow':
   'Public discovery';
 }
 diagnostic.selected=selected.length;
 return {items:selected,reasons,diagnostic,version:LUO_RANKER_VERSION};
}

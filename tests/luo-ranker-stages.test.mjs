import test from 'node:test';
import assert from 'node:assert/strict';
import {rankLuoFeed,LUO_RANKER_VERSION} from '../src/server/luo-for-you.js';
import {candidateTopic,nearDuplicateKey,extraCandidateAllowed,xStyleDiversificationPenalty} from '../src/server/luo-ranker-stages.js';
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const now=Date.parse('2026-10-27T00:00:00Z');
function item(n,props={}){return {id:id(n),owner_id:id(n+100),kind:'post',published:true,
 audience:'public',created_at:new Date(now-60000).toISOString(),body:'ordinary post '+n,reactions:5,comments:1,...props}}
const rank=(items,options={})=>rankLuoFeed({sources:[{source:'public',items}],now,limit:20,...options});
test('X-style self-post, future post and out-of-network reply filters protect candidate selection',()=>{
 const own=item(1,{owner_id:id(777),reactions:10000});
 const future=item(2,{created_at:new Date(now+3600000).toISOString()});
 const reply=item(3,{parent_id:id(44)});
 const accepted=item(4);
 const res=rank([own,future,reply,accepted],{context:{viewer_id:id(777)}});
 assert.deepEqual(res.items.map(x=>x.id),[accepted.id]);
 assert.equal(res.diagnostic.removed,3);
 assert.match(LUO_RANKER_VERSION,/2$/);
});
test('friends replies are permitted when the user has already been authorized',()=>{
 const reply=item(1,{audience:'friends',parent_id:id(44)});
 const r=rankLuoFeed({sources:[{source:'friends',items:[reply]}],now,context:{viewer_id:id(999)}});
 assert.deepEqual(r.items.map(x=>x.id),[reply.id]);
});
test('server-provided muted terms and explicit removed labels cannot be boosted by engagement',()=>{
 const items=[item(1,{body:'A muted subject',reactions:99999}),item(2,{moderation:{state:'withheld'}}),item(3)];
 const result=rank(items,{context:{muted_terms:['MUTED']}});
 assert.deepEqual(result.items.map(x=>x.id),[id(3)]);
 assert.equal(extraCandidateAllowed(items[0],{source:'public',now,mutedTerms:['MUTED']}),false);
});
test('near-duplicate long text is removed, but short messages and independent captions remain',()=>{
 const txt='Distinct article '+('a thoughtful long passage about nature and poetry in the community. ').repeat(3);
 const items=[item(1,{body:txt,reactions:50}),item(2,{body:'  '+txt.toUpperCase()+'  ',reactions:2}),item(3,{body:'Hi'}),item(4,{body:'Hi'})];
 const r=rank(items);
 assert.equal(r.items.filter(x=>x.id===id(1)||x.id===id(2)).length,1);
 assert.equal(r.items.length,3);
 assert.equal(nearDuplicateKey({body:'Hi'}),null);
});
test('bounded topic-diversification penalty reacts to repeat hashtags without deleting content',()=>{
 const first=item(1,{body:'#gardening Petunias'});
 const second=item(2,{body:'#gardening Flowers'});
 const other=item(3,{body:'#cooking Pasta'});
 assert.equal(candidateTopic(first),'#gardening');
 assert.ok(xStyleDiversificationPenalty(second,[first])>xStyleDiversificationPenalty(other,[first]));
 assert.equal(xStyleDiversificationPenalty(other,[first]),0);
});
test('muted key and candidate stages remain bounded and do not mutate rows',()=>{
 const original=item(1,{body:'Poetry and stories'});
 const clone=JSON.stringify(original);
 rank([original],{context:{muted_terms:Array(100).fill('nothing')}});
 assert.equal(JSON.stringify(original),clone);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {rankLuoFeed,normalizeSources,LUO_RANKER_VERSION} from '../src/server/luo-for-you.js';
const uuid=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const base=(n,overrides={})=>({id:uuid(n),owner_id:uuid(100+n),kind:'post',audience:'public',
 published:true,title:'Post '+n,body:'Text',reactions:10,comments:2,
 created_at:new Date(Date.now()-n*1000).toISOString(),...overrides});
test('dedupe sources before scoring with in-network priority',()=>{
 const candidate=base(1),src=normalizeSources([{source:'public',items:[candidate]},{source:'friends',items:[candidate]}]);
 assert.equal(src.length,1);assert.equal(src[0].source,'friends');
});
test('filter hidden, previously seen, unpublished, inaccessible and duplicate posts',()=>{
 const items=[base(1),base(2),base(3,{published:false}),base(4,{audience:'friends'}),base(5)];
 const r=rankLuoFeed({sources:[{source:'public',items}],context:{served_ids:[uuid(1)],hidden_ids:[uuid(2)]},now:Date.now()});
 assert.deepEqual(r.items.map(x=>x.id),[uuid(5)]);assert.equal(r.diagnostic.removed,3);assert.equal(r.diagnostic.served_removed,1);
});
test('author diversity prevents one creator from monopolizing feed',()=>{
 const items=Array.from({length:8},(_,n)=>base(n+1,{owner_id:uuid(100),reactions:10000,comments:400}));
 items.push(base(99,{owner_id:uuid(101),reactions:0}));
 const r=rankLuoFeed({sources:[{source:'public',items}],limit:20});
 assert.equal(r.items.filter(x=>x.owner_id===uuid(100)).length,2);
 assert.ok(r.items.some(x=>x.owner_id===uuid(101)));
});
test('expired, blocked and muted items do not survive even with giant engagement totals',()=>{
 const items=[base(1,{reactions:99999999,owner_id:uuid(910)}),
 base(2,{created_at:'2025-01-01T00:00:00.000Z'}),base(3,{owner_id:uuid(911)}),base(4)];
 const r=rankLuoFeed({sources:[{source:'public',items}],context:{blocked_authors:[uuid(910)],muted_authors:[uuid(911)]}});
 assert.deepEqual(r.items.map(x=>x.id),[uuid(4)]);
});
test('score ordering is stable, bounded, ranker does not mutate input and has explicit version',()=>{
 const items=[base(1,{created_at:'2026-10-25T00:00:00.000Z',reactions:9999}),
 base(2,{created_at:'2026-10-26T00:00:00.000Z',reactions:0})];
 const before=JSON.stringify(items);
 const input={sources:[{source:'public',items}],now:Date.parse('2026-10-26T12:00:00Z')};
 const a=rankLuoFeed(input),b=rankLuoFeed(input);
 assert.deepEqual(a.items,b.items);assert.equal(JSON.stringify(items),before);
 assert.equal(a.version,LUO_RANKER_VERSION);assert.deepEqual(Object.keys(a.diagnostic),['retrieved','visible','removed','served_removed','selected']);
});
test('rejects unbounded candidate sources without relying on caller input',()=>{
 assert.throws(()=>normalizeSources([{source:'public',items:Array(26).fill(base(1))}]),/INVALID_SOURCE/);
 assert.throws(()=>normalizeSources(Array(9).fill({source:'public',items:[]})),/INVALID_SOURCES/);
});

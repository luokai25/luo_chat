// One request at a time per account/room generation, with one dirty bit rather
// than an unbounded queue. A burst during a request gets a fresh trailing read.
export function createRefreshGate({getKey,run}){let current=null;
 return function refresh(){const key=getKey();if(!key)return Promise.resolve();if(current?.key===key){current.dirty=true;return current.promise}const group={key,dirty:false,promise:null};current=group;
 group.promise=Promise.resolve().then(async()=>{for(let pass=0;pass<2;pass++){group.dirty=false;if(getKey()!==key)return;await run();if(!group.dirty||getKey()!==key)break}}).finally(()=>{if(current===group)current=null});return group.promise;
 };
}

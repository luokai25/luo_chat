import {createIndexedCacheStore} from './device-cache.js';
const MB=1048576,DAY=86400000;
export function createClipDrafts({win,getUser,store=createIndexedCacheStore(win,'luo-reel-drafts-v1'),now=()=>Date.now()}){
 let epoch=0;
 function scope(){const owner=getUser()?.id,version=epoch;if(!owner)throw Error('Sign in before opening drafts.');return {owner,valid:()=>epoch===version&&getUser()?.id===owner}}
 async function change(update){const {owner,valid}=scope();const result=await store.change(owner,before=>{if(!valid())throw Error('Account changed; draft operation stopped.');return update(before.filter(r=>r.until>now()),owner)});if(!valid())throw Error('Account changed; draft operation stopped.');return result}
 const summary=r=>({id:r.key,name:r.name,caption:r.caption,audience:r.audience,size:r.size,createdAt:r.createdAt,updatedAt:r.updatedAt,until:r.until});
 return {
  async save({id,file,name,caption='',audience='friends',edit={},days=7}){
   if(!file||!['video/mp4','video/webm'].includes(file.type)||!Number.isFinite(file.size)||file.size<1||file.size>50*MB||typeof file.slice!=='function')throw Error('Draft videos must be MP4 or WebM, up to 50 MB.');
   if(!['friends','public','private'].includes(audience)||typeof caption!=='string'||caption.length>12000||![7,30].includes(Number(days)))throw Error('Check the draft caption, audience and expiry.');
   const state={start:Number(edit.start),end:Number(edit.end),speed:Number(edit.speed)};if(![state.start,state.end,state.speed].every(Number.isFinite)||state.start<0||state.end<=state.start||![.5,1,1.5,2].includes(state.speed))throw Error('Check draft trim settings.');
   const key=id||win.crypto.randomUUID();if(!/^[a-zA-Z0-9-]{1,80}$/.test(key))throw Error('Invalid draft identifier.');
   return change((rows,owner)=>{const old=rows.find(r=>r.key===key),others=rows.filter(r=>r.key!==key);if(others.length>=3)throw Error('Maximum three drafts. Delete one before saving another.');const size=file.size+caption.length*2+512;if(others.reduce((n,r)=>n+r.size,0)+size>100*MB)throw Error('Drafts exceed 100 MB. Delete a draft before saving.');const row={id:JSON.stringify([owner,'draft',key]),owner,key,file,name:String(name||file.name||'Luo Reel').slice(0,160),caption,audience,edit:state,size,createdAt:old?.createdAt||now(),updatedAt:now(),until:now()+Number(days)*DAY};return {rows:[...others,row],value:summary(row)}})
  },
  list:()=>change(rows=>({rows,value:rows.map(summary).sort((a,b)=>b.updatedAt-a.updatedAt)})),
  get:id=>change(rows=>({rows,value:rows.find(r=>r.key===id)||null})),
  remove:id=>{epoch++;return change(rows=>({rows:rows.filter(r=>r.key!==id),value:true}))},
  clear:()=>{epoch++;return change(()=>({rows:[],value:true}))},
  async signedOut(owner){epoch++;if(!owner)return;await store.change(owner,()=>({rows:[],value:true}))}
 };
}

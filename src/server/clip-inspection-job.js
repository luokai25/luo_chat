import {inspectClipBytes,InspectionError} from './media-inspection.js';
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const clipPath=new RegExp('^('+uuid+')/('+uuid+')/'+uuid+'\\.(mp4|webm)$');
export async function readInspectionResponse(response,{signal,maxBytes=50*1024*1024}={}){
 if(!response?.ok||!response.body?.getReader)throw new InspectionError('Media download unavailable');
 const length=response.headers?.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new InspectionError('Media download exceeds limit');
 const deadline=AbortSignal.timeout(15000),bounded=signal?AbortSignal.any([signal,deadline]):deadline;
 const reader=response.body.getReader(),parts=[];let size=0,done=false;
 const cancel=()=>{reader.cancel().catch(()=>{})};bounded.addEventListener('abort',cancel,{once:true});
 try{while(true){if(bounded.aborted)throw new InspectionError('Media inspection cancelled');const next=await reader.read();if(bounded.aborted)throw new InspectionError('Media inspection cancelled');if(next.done){done=true;break}size+=next.value.byteLength;if(size>maxBytes)throw new InspectionError('Media download exceeds limit');parts.push(Buffer.from(next.value))}return Buffer.concat(parts)}finally{bounded.removeEventListener('abort',cancel);if(!done)try{await reader.cancel()}catch{}reader.releaseLock()}
}

// Backend adapters must use a restricted, authenticated worker credential. Do
// not expose these dependencies, or receipt writes, as browser-controlled RPCs.
export async function inspectStoredClip(store,path,{execute,signal}={}){
 const match=typeof path==='string'&&path.match(clipPath);if(!match)throw new InspectionError('Invalid clip job path');
 const active=()=>{if(signal?.aborted)throw new InspectionError('Media inspection cancelled')};active();
 const before=await store.lookup(path,{signal});active();
 if(!before||before.ownerId!==match[1]||typeof before.id!=='string'||typeof before.version!=='string'||!before.version||!Number.isSafeInteger(before.byteSize)||before.byteSize<1||before.byteSize>50*1024*1024)throw new InspectionError('Invalid stored clip snapshot');
 const bytes=await readInspectionResponse(await store.download(path,{signal}),{signal});active();
 if(bytes.length!==before.byteSize)throw new InspectionError('Stored clip size changed');
 const result=await inspectClipBytes(bytes,{execute,signal});active();
 if(result.mimeType!==before.mimeType)throw new InspectionError('Stored clip MIME type mismatch');
 const after=await store.lookup(path,{signal});active();
 for(const key of ['id','version','ownerId','byteSize','mimeType'])if(after?.[key]!==before[key])throw new InspectionError('Stored clip changed during inspection');
 const proof={...result,path,objectId:before.id,objectVersion:before.version};
 // SQL rechecks and locks the object again while recording, closing the race
 // between this final lookup and committing the receipt.
 await store.record(proof,{signal});active();return proof;
}

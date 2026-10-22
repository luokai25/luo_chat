export const timedFetch=(input:RequestInfo|URL,init:RequestInit={})=>fetch(input,{...init,signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
export async function readRequestJSON(req:Request,maxBytes=16384){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))throw new Error('Invalid JSON request');
 const declared=req.headers.get('content-length');
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes))throw new Error('Request too large');
 if(!req.body)throw new Error('Missing body');
 const reader=req.body.getReader();const chunks:Uint8Array[]=[];let total=0,timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;reader.cancel().catch(()=>{});},5000);
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){reader.cancel().catch(()=>{});throw new Error('Request too large');}chunks.push(value);}
 }finally{clearTimeout(timer);reader.releaseLock();}
 if(timedOut)throw new Error('Request timed out');
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const data=JSON.parse(new TextDecoder().decode(bytes));
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Expected an object');
 return data;
}

import {InspectionError} from './media-inspection.js';
export function createInspectionStore(db,{projectOrigin,fetcher=fetch}={}){
 let origin;try{const url=new URL(projectOrigin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error();origin=url.origin}catch{throw new InspectionError('Invalid inspection backend origin')}
 const rpc=async(name,args,{signal}={})=>{const query=db.rpc(name,args);const result=signal&&typeof query.abortSignal==='function'?await query.abortSignal(signal):await query;if(result.error)throw new InspectionError('Inspection backend operation failed');return result.data};
 return{
  lookup:(path,options)=>rpc('get_luo_clip_inspection_source',{path},options),
  async download(path,{signal}={}){
   const signed=await db.storage.from('luo-social').createSignedUrl(path,60);
   if(signed.error)throw new InspectionError('Media download unavailable');
   let url;try{url=new URL(signed.data?.signedUrl);if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||url.hash||decodeURIComponent(url.pathname)!=='/storage/v1/object/sign/luo-social/'+path)throw Error()}catch{throw new InspectionError('Unexpected media download target')}
   return fetcher(url.href,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),credentials:'omit',cache:'no-store',redirect:'error'});
  },
  record:(p,options)=>rpc('record_luo_clip_inspection',{path:p.path,object_id:p.objectId,object_version:p.objectVersion,sha256:p.sha256,byte_size:p.byteSize,duration:p.duration,width:p.width,height:p.height,mime_type:p.mimeType,policy:p.policy},options)
 };
}

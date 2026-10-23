// Offline-first asset handling for the high-detail Luo Core 3D master.
// Do not read chat contents, block authentication or alter the message database.
export const LUO_CORE_MODEL_URL='/luo-core-master.glb';
export function luoCoreModelCacheName(win){
 const tag=win.document?.querySelector?.('meta[name="luo-core-model-hash"]')?.content||'dev';
 return 'luo-core-master-'+(/^[a-f0-9]{12}$/.test(tag)?tag:'dev');
}
export function isInstalledLuoChat(win){
 return !!(win.matchMedia?.('(display-mode: standalone)')?.matches||win.navigator?.standalone);
}
export async function luoCoreOfflineStatus(win){
 if(!win.caches?.open)return {ready:false,reason:'cache-unavailable'};
 try{
  const cached=await (await win.caches.open(luoCoreModelCacheName(win))).match(LUO_CORE_MODEL_URL);
  return {ready:!!cached,reason:cached?'cached':'not-cached'};
 }catch{return {ready:false,reason:'cache-unavailable'}}
}
let pending=null;
export async function saveLuoCoreOffline(win,{force=false}={}){
 if(!force&&!isInstalledLuoChat(win))return {ready:false,reason:'browser-not-installed'};
 const existing=await luoCoreOfflineStatus(win);
 if(existing.ready)return existing;
 if(win.navigator?.onLine===false)return {ready:false,reason:'offline-before-first-download'};
 if(pending)return pending;
 const current=(async()=>{
  // Normal installed PWAs use their own registered worker, never a remote CDN.
  try{
   const serviceWorker=win.navigator?.serviceWorker;
   if(serviceWorker?.register&&win.isSecureContext!==false){
    await serviceWorker.register('/sw.js');
   }
  }catch{}
  // If the worker has not yet activated, use the same-origin Cache API directly.
  try{
   if(!win.caches?.open||!win.fetch)return {ready:false,reason:'cache-unavailable'};
   const status=await luoCoreOfflineStatus(win);
   if(status.ready)return status;
   const response=await win.fetch(LUO_CORE_MODEL_URL,{credentials:'same-origin'});
   if(!response.ok)return {ready:false,reason:'download-failed'};
   const body=await response.clone().arrayBuffer();
   const view=new DataView(body);
   if(body.byteLength<100_000||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)
    return {ready:false,reason:'invalid-glb'};
   // Use the same content-hashed cache as the service worker, no duplicate
   // giant model or stale model surviving the next Luo Chat upgrade.
   const cache=await win.caches.open(luoCoreModelCacheName(win));
   await cache.put(LUO_CORE_MODEL_URL,response);
   return {ready:true,reason:'cached'};
  }catch{return {ready:false,reason:'download-failed'}}
 })();
 pending=current;
 try{return await current}finally{if(pending===current)pending=null}
}
export function startInstalledLuoCoreOffline(win,onReady=()=>{}){
 if(!isInstalledLuoChat(win))return;
 // Deliberately background-only; a slow 3D asset cannot delay chat startup.
 Promise.resolve().then(()=>saveLuoCoreOffline(win)).then(onReady,()=>{});
}

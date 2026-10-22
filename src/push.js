export function installWebPush({win,db,getUser,note}){
 let epoch=0,intent=0,serial=Promise.resolve();
 const ownerKey='luo-push-device-owner';
 const val=r=>{if(r.error)throw Error(r.error.message);return r.data};
 const b64=str=>Uint8Array.from(win.atob(str.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 // Permission prompts can outlive a dialog/account. Serialize browser mutations,
 // while an intent token lets a newer Off/signout cancel a pending Enable.
 const exclusive=fn=>{const task=serial.then(fn,fn);serial=task.catch(()=>{});return task};
 const clearOwner=()=>{try{win.localStorage.removeItem(ownerKey)}catch{}};
 async function disable(){
  const actor=getUser()?.id,seq=epoch,operation=++intent;
  return exclusive(async()=>{
   if(seq!==epoch||operation!==intent||getUser()?.id!==actor)return;
   const registration=await win.navigator.serviceWorker?.getRegistration?.();
   const sub=await registration?.pushManager?.getSubscription();
   if(seq!==epoch||operation!==intent||getUser()?.id!==actor)return;
   if(sub){
    // Stop browser delivery even if the later server cleanup fails.
    if(!await sub.unsubscribe())throw Error('Could not disable this browser subscription. Try again.');
    clearOwner();
    if(actor)try{val(await db.from('chat_push_subscriptions').delete().eq('user_id',actor).eq('endpoint',sub.endpoint))}
    catch{throw Error('Alerts are off in this browser. Server cleanup could not finish; expired subscriptions are removed after delivery attempts.')}
   }else clearOwner();
  });
 }
 return{
  async enable(){
   const actor=getUser()?.id,seq=epoch,operation=++intent;
   const active=()=>seq===epoch&&operation===intent&&getUser()?.id===actor;
   if(!actor)throw Error('Sign in first.');
   if(!win.isSecureContext||!win.Notification||!win.PushManager||!win.navigator.serviceWorker)throw Error('Background push is unavailable here. On iPhone, install Luo Chat on the Home Screen first.');
   const permission=await win.Notification.requestPermission();
   if(!active())return;
   if(permission!=='granted')throw Error('Notifications were not allowed. Check browser / device permissions.');
   const key=val(await db.rpc('get_luo_push_public_key'));
   if(!active())return;
   if(!key)throw Error('Background push is not configured on the server.');
   const registration=await win.navigator.serviceWorker.ready;
   if(!active())return;
   return exclusive(async()=>{
    if(!active())return;
    let sub=await registration.pushManager.getSubscription();
    if(!active())return;
    let old;try{old=win.localStorage.getItem(ownerKey)}catch{}
    if(sub&&old!==actor){if(!await sub.unsubscribe())throw Error('Could not remove the previous device subscription. Try again.');sub=null;clearOwner()}
    if(!active())return;
    sub=sub||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(key)});
    if(!active()){await sub.unsubscribe();clearOwner();return}
    try{
     const data=sub.toJSON();
     val(await db.from('chat_push_subscriptions').upsert({user_id:actor,endpoint:sub.endpoint,p256dh:data.keys.p256dh,auth_key:data.keys.auth},{onConflict:'user_id,endpoint'}));
     if(!active()){await sub.unsubscribe();clearOwner();return}
     win.localStorage.setItem(ownerKey,actor);
     note('Background notifications enabled on this device. Delivery usually starts within a minute.');
    }catch(e){await sub.unsubscribe();clearOwner();throw e}
   });
  },
  disable,
  async status(){
   if(!win.PushManager)return 'Unsupported in this browser';
   const actor=getUser()?.id,seq=epoch;
   const registration=await win.navigator.serviceWorker?.getRegistration?.(),sub=await registration?.pushManager?.getSubscription();
   let owner;try{owner=win.localStorage.getItem(ownerKey)}catch{}
   return actor&&seq===epoch&&actor===getUser()?.id&&sub&&owner===actor?'Enabled on this device':'Off on this device';
  },
  signedOut(){
   epoch++;intent++;clearOwner();
   // Queue before a later account's Enable, so old cleanup cannot unsubscribe it.
   exclusive(async()=>{const registration=await win.navigator.serviceWorker?.getRegistration?.();const sub=await registration?.pushManager?.getSubscription();if(sub)await sub.unsubscribe()}).catch(()=>{});
  },
  accountReady(){epoch++;intent++}
 };
}

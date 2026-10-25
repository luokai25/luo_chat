// A reference card, not a copy of private media. The viewer must pass entry.get.
export function installReelMessagePreviews({win,container,getUser,openClip}){
 if(!container)return ()=>{};const done=new WeakSet();
 function scan(){for(const body of container.querySelectorAll('.bubble-body')){if(done.has(body))continue;const match=/^Luo Clip\n([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(body.textContent||'');if(!match)continue;done.add(body);const actor=getUser()?.id,b=win.document.createElement('button');b.type='button';b.className='luo-reel-message-preview';b.textContent='▷ Luo Clip · Tap to view';b.setAttribute('aria-label','Open shared Luo Clip');b.onclick=()=>{if(actor&&getUser()?.id===actor)openClip(match[1])};body.replaceChildren(b)}}
 const observer=new win.MutationObserver(scan);observer.observe(container,{subtree:true,childList:true});scan();return ()=>observer.disconnect();
}

// Keep the inbox and room identity in sync; never display a member's photo as a group's photo.
export function renderConversationAvatar(element,room,{label='',icon='',projectUrl='https://byjixqwpjvsgmqilmzbm.supabase.co',lazy=true}={}){
 const doc=element.ownerDocument,person=room.kind==='direct'?room.person:null;
 const fallback=String(icon||label||room.title||person?.display_name||person?.username||'Conversation');
 const initials=icon?Array.from(String(icon)).slice(0,12).join(''):fallback.trim().split(/\s+/).slice(0,2).map(s=>Array.from(s)[0]||'').join('').toUpperCase()||'L';
 element.replaceChildren(doc.createTextNode(initials));element.setAttribute('aria-hidden','true');
 element.dataset.frame=['gold','halo','double'].includes(person?.profile_frame)?person.profile_frame:'none';
 if(icon||!person?.avatar_url)return;
 let url;try{url=new URL(person.avatar_url);const base=new URL(projectUrl);if(url.origin!==base.origin||!url.pathname.startsWith('/storage/v1/object/public/avatars/'))return}catch{return}
 const image=doc.createElement('img');image.alt='';image.decoding='async';image.loading=lazy?'lazy':'eager';image.referrerPolicy='no-referrer';
 image.addEventListener('error',()=>{if(image.parentNode===element)element.replaceChildren(doc.createTextNode(initials))},{once:true});
 image.src=url.href;element.replaceChildren(image);
}

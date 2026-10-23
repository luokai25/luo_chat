// Memory Constellations: the server only returns currently accessible, non-recalled
// conversation messages after mutual shared-timeline consent.
export function renderMemoryConstellations({win,db,note,getUser,getChats,output}) {
 const doc=win.document,el=(t,c,text)=>{const n=doc.createElement(t);if(c)n.className=c;if(text!==undefined)n.textContent=String(text);return n};
 const shell=el('section','luo-social-card');shell.append(el('h3','','Memory Constellations'),el('p','muted','Explore the memories you and a friend chose to share. Bigger stars are moments you both marked as special.'));
 const room=el('select','field');let opt=el('option','','Choose a shared conversation');opt.value='';room.append(opt);
 for(const c of getChats()||[]){const o=el('option','',c.title||c.name||c.person?.display_name||'Conversation');o.value=c.id;room.append(o)}
 const sky=el('div','luo-memory-sky'),detail=el('div','luo-memory-detail'),feedback=el('p','muted','Both friends must agree to a shared timeline before it can appear.');
 const action=el('button','primary','Explore memories');action.type='button';
 shell.append(room,action,feedback,sky,detail);output.append(shell);
 let run=0;
 async function load(){const actor=getUser()?.id,id=room.value,ticket=++run;if(!actor||!id){feedback.textContent='Select a conversation.';return}action.disabled=true;feedback.textContent='Loading approved shared history…';
  try{const r=await db.rpc('luo_space',{action:'memories',input:{room_id:id}});if(r.error)throw Error(r.error.message);if(ticket!==run||getUser()?.id!==actor||room.value!==id||!sky.isConnected)return;
   const rows=(Array.isArray(r.data)?r.data:[]).slice(0,70).reverse();sky.replaceChildren();detail.replaceChildren();feedback.textContent=rows.length?'Tap any star to explore that moment. A brighter star means a memory both friends value.':'This shared timeline has no memories yet.';
   const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.classList.add('luo-memory-lines');
   const points=rows.map((m,i)=>{const radius=42*Math.sqrt((i+1)/Math.max(rows.length,1)),theta=i*2.399963;return {x:50+radius*Math.cos(theta),y:50+radius*Math.sin(theta),row:m}});
   for(let i=1;i<points.length;i++){const line=doc.createElementNS('http://www.w3.org/2000/svg','line');for(const [key,v] of [['x1',points[i-1].x],['y1',points[i-1].y],['x2',points[i].x],['y2',points[i].y]])line.setAttribute(key,String(v));line.setAttribute('stroke','#d2a95a');line.setAttribute('stroke-opacity','.23');line.setAttribute('stroke-width','.23');svg.append(line)}
   sky.append(svg);
   for(const point of points){const m=point.row,star=el('button','luo-memory-star','✦');star.type='button';star.style.left=point.x+'%';star.style.top=point.y+'%';const count=Math.min(2,Math.max(0,Number(m.special_count)||0));star.dataset.special=String(count);star.setAttribute('aria-label',new Date(m.created_at).toLocaleString()+', '+count+' special marks. Open memory.');star.title='Memory · '+new Date(m.created_at).toLocaleDateString();
    star.onclick=()=>{detail.replaceChildren();detail.append(el('p','luo-social-meta',new Date(m.created_at).toLocaleString()),el('p','',m.body||'[Shared media or a voice message]'),el('p','muted',count===2?'Both of you marked this memory as special':count===1?'One of you marked this memory as special':'An ordinary shared moment'));
     const mark=el('button','ghost','Mark this special');mark.type='button';mark.onclick=async()=>{mark.disabled=true;try{const r=await db.rpc('luo_space',{action:'memory.special',input:{room_id:id,message_id:m.id}});if(r.error)throw Error(r.error.message);if(ticket===run&&getUser()?.id===actor)await load()}catch(e){if(ticket===run&&getUser()?.id===actor){note(e.message);mark.disabled=false}}};detail.append(mark)};sky.append(star)}
  }catch(e){if(ticket===run&&getUser()?.id===actor){sky.replaceChildren();detail.replaceChildren();feedback.textContent=e.message||'This shared timeline cannot be displayed.'}}finally{if(ticket===run)action.disabled=false}
 }
 action.onclick=load;room.onchange=()=>{run++;sky.replaceChildren();detail.replaceChildren();feedback.textContent='Press Explore memories to load your private shared history.'};
 return ()=>{run++;sky.replaceChildren();detail.replaceChildren()}
}

// Small self-contained, offline-capable 3D mesh renderer for Luo shared companions.
// Projects real 3D box/pyramid geometry onto a Canvas, with orbit gestures.
// No network calls, WebGL permissions, downloads or external art required.
export function mountCompanion3D(host,{species='cat',name='Companion',home='obsidian',cosmetic='none'}={}) {
 const doc=host.ownerDocument,win=doc.defaultView,canvas=doc.createElement('canvas');
 canvas.width=520;canvas.height=520;canvas.className='luo-companion-canvas';
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Rotatable 3D '+species+' named '+name);
 canvas.style.cssText='width:min(100%,260px);aspect-ratio:1;display:block;touch-action:pan-y;cursor:grab';
 host.append(canvas);
 const ctx=canvas.getContext('2d');if(!ctx){const p=doc.createElement('p');p.textContent='A '+species+' companion named '+name;host.append(p);return ()=>{}}
 const faces=[];
 function box(x1,y1,z1,x2,y2,z2,color){
  const v=[[x1,y1,z1],[x2,y1,z1],[x2,y2,z1],[x1,y2,z1],[x1,y1,z2],[x2,y1,z2],[x2,y2,z2],[x1,y2,z2]];
  for(const [order,shade] of [[[0,1,2,3],1],[[5,4,7,6],.68],[[4,0,3,7],.82],[[1,5,6,2],.72],[[3,2,6,7],1.14],[[4,5,1,0],.6]])faces.push({points:order.map(i=>v[i]),color,shade})
 }
 function triangle(a,b,c,color,shade=1){faces.push({points:[a,b,c],color,shade})}
 function pyramid(x,y,z,w,h,deep,color){const p=[x,y+h,z],a=[x-w,y,z-deep],b=[x+w,y,z-deep],c=[x+w,y,z+deep],d=[x-w,y,z+deep];triangle(a,b,p,color,1.1);triangle(b,c,p,color,.76);triangle(c,d,p,color,.87);triangle(d,a,p,color,.93)}
 const palette=species==='fox'?{fur:'#df863c',light:'#f7dfb5',dark:'#623a26',eye:'#201b20'}:species==='dragon'?{fur:'#373440',light:'#bb6571',dark:'#201923',eye:'#efc86d'}:{fur:'#c8a76e',light:'#e9dabb',dark:'#53412f',eye:'#252029'};
 // Ground and paws.
 for(const x of [-.38,.35])for(const z of [-.25,.4])box(x-.11,.08,z-.1,x+.1,.42,z+.13,palette.dark);
 box(-.54,.38,-.26,.52,1.06,.54,palette.fur);
 box(-.39,.95,-.62,.39,1.62,.06,palette.fur);
 box(-.25,1.05,-.77,.25,1.3,-.63,palette.light);
 box(-.25,1.27,-.79,-.12,1.39,-.755,palette.eye);
 box(.12,1.27,-.79,.25,1.39,-.755,palette.eye);
 box(-.035,1.10,-.85,.035,1.17,-.79,palette.dark);
 for(const x of [-.29,.29])pyramid(x,1.52,-.3,.23,.44,.22,palette.fur);
 // Tail is a chain of real 3D sections instead of a flat emoji or sticker.
 box(.40,.65,.43,.61,.88,.77,palette.fur);box(.55,.8,.7,.78,1.04,.98,palette.fur);box(.63,.96,.87,.91,1.16,1.10,species==='fox'?palette.light:palette.fur);
 if(species==='fox'){
  box(-.23,1.03,-.83,.23,1.19,-.7,palette.light);
  box(.58,.8,.76,.96,1.23,1.14,palette.fur);box(.76,1.0,.98,1.09,1.38,1.29,palette.light)
 }
 if(species==='dragon'){
  // Paired wings are 3D triangular surfaces and rise behind the shoulders.
  for(const x of [-1,1]){const a=[x*.35,.9,.21],b=[x*1.2,1.35,.45],c=[x*.92,1.78,.58],d=[x*.24,1.25,.44];triangle(a,b,c,palette.light,.85);triangle(a,c,d,palette.fur,1.04);triangle(c,b,d,palette.dark,.65)}
  for(let z=.25;z<=1.05;z+=.23)pyramid(0,1.03,z,.16,.31,.13,palette.light);
  for(const x of [-.26,.26])pyramid(x,1.55,-.22,.13,.43,.12,palette.light);
  box(-.32,.84,-.75,.31,1.02,-.42,palette.dark)
 }
 if(cosmetic==='crown'){
  box(-.31,1.76,-.45,.31,1.87,-.12,'#e8bc62');
  for(const x of [-.25,0,.25])pyramid(x,1.83,-.26,.095,.22,.09,'#f8dc93')
 }else if(cosmetic==='bow'){
  box(-.09,.93,-.65,.09,1.07,-.55,'#dd8a96');
  triangle([-.07,1,-.61],[-.3,1.15,-.59],[-.29,.87,-.59],'#d66e89');
  triangle([.07,1,-.61],[.3,1.15,-.59],[.29,.87,-.59],'#d66e89')
 }
 const hex=(color,factor)=>{const n=parseInt(color.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(c=>Math.min(255,Math.max(0,Math.round(c*factor))).toString(16).padStart(2,'0')).join('')};
 let yaw=.4,pitch=.12,dragging=false,lastX=0,lastY=0,frame=0,prev=0,disposed=false,visible=true;
 const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
 function project(p){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);const x=p[0]*cy+p[2]*sy,z=-p[0]*sy+p[2]*cy,y=p[1]-.91;const Y=y*cp-z*sp,Z=y*sp+z*cp,scale=530*1.6/(Z+4.4);return {x:260+x*scale,y:262-Y*scale,z:Z}}
 function draw(now=0){
  frame=0;if(disposed||!host.isConnected||!visible)return;
  if(now&&prev&&now-prev<32){frame=win.requestAnimationFrame(draw);return}
  const sky=ctx.createLinearGradient(0,0,520,520);
  for(const [offset,color] of(home==='garden'?[[0,'#0a251c'],[1,'#243c29']]:home==='stars'?[[0,'#090d29'],[1,'#2b2242']]:[[0,'#111012'],[1,'#32271c']]))sky.addColorStop(offset,color);
  ctx.fillStyle=sky;ctx.fillRect(0,0,520,520);
  // Subtle environmental detail stays deterministic and costs no allocations.
  for(let i=0;i<36;i++){const x=(i*137)%520,y=(i*91)%520;ctx.globalAlpha=.13+(i%5)*.06;ctx.fillStyle=home==='garden'?'#9dc69c':'#e0c48b';ctx.beginPath();ctx.arc(x,y,1+(i%3),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
  ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(260,405,138,35,0,0,Math.PI*2);ctx.fill();
  const sorted=faces.map(f=>{const projected=f.points.map(project);return {projected,depth:projected.reduce((t,p)=>t+p.z,0)/projected.length,color:f.color,shade:f.shade}}).sort((a,b)=>b.depth-a.depth);
  for(const {projected,color,shade} of sorted){ctx.fillStyle=hex(color,shade);ctx.strokeStyle='#07060845';ctx.lineWidth=1;ctx.beginPath();projected.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.fill();ctx.stroke()}
  if(!motion&&!dragging)yaw+=.0025*Math.min(2,Math.max(1,(now-prev)/16));prev=now;
  if(!motion)frame=win.requestAnimationFrame(draw)
 }
 const down=e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.style.cursor='grabbing';try{canvas.setPointerCapture(e.pointerId)}catch{}};
 const move=e=>{if(!dragging)return;yaw+=(e.clientX-lastX)*.012;pitch=Math.max(-.28,Math.min(.38,pitch+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY;if(motion)draw()};
 const up=()=>{dragging=false;canvas.style.cursor='grab'};
 const observer=typeof win.IntersectionObserver==='function'?new win.IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;if(visible&&!frame&&!motion&&!disposed)draw()}):null;observer?.observe(canvas);
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
 draw();
 return ()=>{disposed=true;observer?.disconnect();if(frame)win.cancelAnimationFrame(frame);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up)}
}

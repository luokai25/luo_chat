export function constrainImageView(view,width,height,imageWidth=width,imageHeight=height){
 const scale=Math.min(5,Math.max(1,Number(view.scale)||1)),fit=Math.min(width/imageWidth,height/imageHeight),renderWidth=imageWidth*fit,renderHeight=imageHeight*fit;
 const maxX=Math.max(0,(renderWidth*scale-width)/2),maxY=Math.max(0,(renderHeight*scale-height)/2);
 return{scale,x:Math.min(maxX,Math.max(-maxX,Number(view.x)||0)),y:Math.min(maxY,Math.max(-maxY,Number(view.y)||0))};
}
export function mountImageGestures({win,image,content,isActive=()=>true}){
 const doc=win.document,viewport=doc.createElement('div'),controls=doc.createElement('div'),help=doc.createElement('p'),output=doc.createElement('output');viewport.className='image-viewport';viewport.tabIndex=0;viewport.setAttribute('role','group');viewport.setAttribute('aria-label','Image viewer. Pinch to zoom or use the zoom buttons. Arrow keys pan when zoomed.');image.draggable=false;viewport.append(image);controls.className='image-zoom-controls';help.className='tiny muted';help.textContent='Pinch to zoom · Drag to move · Use + / − or arrow keys';output.setAttribute('aria-label','Image zoom level');
 let view={scale:1,x:0,y:0},points=new Map(),base=null,disposed=false;
 const geometry=()=>{const r=viewport.getBoundingClientRect();return{r,w:Math.max(1,r.width),h:Math.max(1,r.height)}};
 function draw(){const{w,h}=geometry();view=constrainImageView(view,w,h,image.naturalWidth||w,image.naturalHeight||h);image.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;viewport.dataset.zoomed=String(view.scale>1);output.textContent=Math.round(view.scale*100)+'%';out.disabled=view.scale<=1;inside.disabled=view.scale>=5}
 function local(point){const{r,w,h}=geometry();return{x:point.x-r.left-w/2,y:point.y-r.top-h/2}}
 function zoom(scale,pivot={x:0,y:0}){const next=Math.min(5,Math.max(1,scale)),ratio=next/view.scale;view={scale:next,x:pivot.x-(pivot.x-view.x)*ratio,y:pivot.y-(pivot.y-view.y)*ratio};draw()}
 function button(label,fn){const b=doc.createElement('button');b.type='button';b.className='ghost';b.textContent=label;b.onclick=()=>{if(isActive()&&!disposed)fn()};return b}
 const out=button('Zoom out',()=>zoom(view.scale/1.5)),inside=button('Zoom in',()=>zoom(view.scale*1.5)),reset=button('Fit image',()=>{view={scale:1,x:0,y:0};draw()});controls.append(out,output,inside,reset);content.append(viewport,controls,help);
 function baseline(){const p=[...points.values()];if(p.length>=2){const a=local(p[0]),b=local(p[1]);base={...view,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),kind:'pinch'}}else if(p.length===1)base={...view,point:p[0],kind:'pan'};else base=null}
 viewport.addEventListener('pointerdown',e=>{if(disposed||!isActive()||e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});try{viewport.setPointerCapture?.(e.pointerId)}catch{}baseline()});
 viewport.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||disposed||!isActive())return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(e.cancelable)e.preventDefault();const p=[...points.values()];if(base?.kind==='pinch'&&p.length>=2){const a=local(p[0]),b=local(p[1]),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};const scale=Math.min(5,Math.max(1,base.scale*Math.hypot(a.x-b.x,a.y-b.y)/base.distance)),ratio=scale/base.scale;view={scale,x:mid.x-(base.mid.x-base.x)*ratio,y:mid.y-(base.mid.y-base.y)*ratio}}else if(base?.kind==='pan'&&p.length===1)view={scale:view.scale,x:base.x+p[0].x-base.point.x,y:base.y+p[0].y-base.point.y};draw()},{passive:false});
 function end(e){points.delete(e.pointerId);try{if(viewport.hasPointerCapture?.(e.pointerId))viewport.releasePointerCapture(e.pointerId)}catch{}baseline()}
 for(const name of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(name,end);
 viewport.addEventListener('dblclick',e=>{if(!disposed&&isActive())zoom(view.scale>1?1:2.5,local({x:e.clientX,y:e.clientY}))});
 viewport.addEventListener('keydown',e=>{if(disposed||!isActive())return;if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='0')view={scale:1,x:0,y:0};else if(e.key==='+'||e.key==='=')return zoom(view.scale*1.5);else if(e.key==='-')return zoom(view.scale/1.5);else{view.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;view.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0}draw()}});
 image.addEventListener('load',draw);win.addEventListener('resize',draw);draw();
 return{dispose(){disposed=true;points.clear();base=null;image.removeEventListener('load',draw);win.removeEventListener('resize',draw);image.style.removeProperty('transform')},getView:()=>({...view})};
}

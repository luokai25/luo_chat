// Offline GLB showroom: only instantiated after the user explicitly opens it.
// Normal chats keep their lightweight 3D companion; no external assets or APIs.
import {LUO_CORE_MODEL_URL,saveLuoCoreOffline} from './luo-core-offline.js';
export function parseLuoCoreGlb(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<32||buffer.byteLength>35_000_000)throw Error('3D file size is invalid');
 const view=new DataView(buffer);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw Error('Invalid GLB header');
 let offset=12,gltf=null,binary=null;
 while(offset+8<=buffer.byteLength){
  const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
  if(length>buffer.byteLength-offset)throw Error('Incomplete 3D scene');
  if(type===0x4e4f534a)gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,offset,length)).trim());
  if(type===0x004e4942)binary=buffer.slice(offset,offset+length);
  offset+=length;
 }
 if(!gltf||!binary||!Array.isArray(gltf.meshes)||!Array.isArray(gltf.nodes))throw Error('Missing 3D mesh data');
 return {gltf,binary};
}
const vertex=[
 'attribute vec3 aPosition,aNormal;',
 'uniform vec3 uTranslation,uScale;',
 'uniform vec4 uQuat;',
 'uniform float uYaw,uPitch,uZoom,uAspect;',
 'varying vec3 vNormal;',
 'vec3 rotate(vec3 v,vec4 q){return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}',
 'void main(){',
 ' vec3 v=rotate(aPosition*uScale,uQuat)+uTranslation;',
 ' vec3 n=rotate(aNormal,uQuat);v.y-=1.14;',
 ' float c=cos(uYaw),s=sin(uYaw);',
 ' v.xz=mat2(c,s,-s,c)*v.xz;n.xz=mat2(c,s,-s,c)*n.xz;',
 ' c=cos(uPitch);s=sin(uPitch);',
 ' v.yz=mat2(c,s,-s,c)*v.yz;n.yz=mat2(c,s,-s,c)*n.yz;',
 ' float persp=2.7/(2.9-v.z*.20);',
 ' gl_Position=vec4(v.x*uZoom*persp/uAspect,v.y*uZoom*persp,v.z*.14,1.);',
 ' vNormal=normalize(n);}'
].join('\n');
const fragment=[
 'precision mediump float;',
 'uniform vec4 uColor;',
 'varying vec3 vNormal;',
 'void main(){float light=max(0.,dot(normalize(vNormal),normalize(vec3(-.4,.8,1.))));',
 'gl_FragColor=vec4(uColor.rgb*(.45+light*.56),uColor.a);}'
].join('\n');
function makeShader(gl,type,source){
 const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
 if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error('3D graphics are not supported by this device');
 return sh;
}
function makeRenderer(gl,scene){
 const {gltf,binary}=scene,program=gl.createProgram();
 gl.attachShader(program,makeShader(gl,gl.VERTEX_SHADER,vertex));
 gl.attachShader(program,makeShader(gl,gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Cannot initialize 3D scene');
 const pos=gl.getAttribLocation(program,'aPosition'),nor=gl.getAttribLocation(program,'aNormal');
 const uni=Object.fromEntries(['uTranslation','uScale','uQuat','uYaw','uPitch','uZoom','uAspect','uColor'].map(k=>[k,gl.getUniformLocation(program,k)]));
 function buffer(accessor,target){
  const acc=gltf.accessors[accessor],view=gltf.bufferViews[acc.bufferView],b=gl.createBuffer();
  gl.bindBuffer(target,b);gl.bufferData(target,new Uint8Array(binary,view.byteOffset||0,view.byteLength),gl.STATIC_DRAW);
  return {buf:b,offset:acc.byteOffset||0,stride:view.byteStride||0,type:acc.componentType,count:acc.count};
 }
 const meshes=[];
 gl.enable(gl.DEPTH_TEST);gl.clearColor(.055,.043,.038,1);
 gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(nor);
 for(let n=0;n<gltf.nodes.length;n++){
  const node=gltf.nodes[n];if(node.mesh===undefined)continue;
  for(const prim of gltf.meshes[node.mesh].primitives||[]){
   if(prim.attributes?.POSITION===undefined||prim.attributes.NORMAL===undefined||prim.indices===undefined)continue;
   const m=gltf.materials?.[prim.material];
   meshes.push({node:n,p:buffer(prim.attributes.POSITION,gl.ARRAY_BUFFER),
    n:buffer(prim.attributes.NORMAL,gl.ARRAY_BUFFER),i:buffer(prim.indices,gl.ELEMENT_ARRAY_BUFFER),
    color:m?.pbrMetallicRoughness?.baseColorFactor||[.85,.65,.4,1]});
  }
 }
 function values(index){
  const acc=gltf.accessors[index],v=gltf.bufferViews[acc.bufferView],off=(v.byteOffset||0)+(acc.byteOffset||0);
  const size=acc.type==='SCALAR'?1:acc.type==='VEC3'?3:4;
  return new Float32Array(binary,off,acc.count*size);
 }
 function transforms(motion,seconds){
  const t=gltf.nodes.map(n=>({translation:n.translation||[0,0,0],scale:n.scale||[1,1,1],rotation:n.rotation||[0,0,0,1]}));
  if(!motion)return t;
  for(const ch of motion.channels){
   const sampler=motion.samplers[ch.sampler];
   const xs=values(sampler.input),ys=values(sampler.output),length=xs[xs.length-1];
   const now=seconds%Math.max(length,.01);
   let j=0;while(j<xs.length-2&&xs[j+1]<now)j++;
   const next=Math.min(xs.length-1,j+1);
   const a=Math.max(0,Math.min(1,(now-xs[j])/Math.max(.001,xs[next]-xs[j])));
   const dimensions=ch.target.path==='rotation'?4:3;
   const v=Array.from({length:dimensions},(_,d)=>ys[j*dimensions+d]*(1-a)+ys[next*dimensions+d]*a);
   if(dimensions===4){const m=Math.hypot(...v)||1;for(let k=0;k<4;k++)v[k]/=m}
   if(t[ch.target.node])t[ch.target.node][ch.target.path]=v;
  }
  return t;
 }
 function draw({yaw=0,pitch=0,zoom=1,clip=null,seconds=0}={}){
  gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
  gl.uniform1f(uni.uYaw,yaw);gl.uniform1f(uni.uPitch,pitch);gl.uniform1f(uni.uZoom,zoom);
  gl.uniform1f(uni.uAspect,gl.canvas.width/Math.max(1,gl.canvas.height));
  const poses=transforms(clip,seconds);
  for(const m of meshes){
   const node=poses[m.node];gl.uniform3fv(uni.uTranslation,node.translation);gl.uniform3fv(uni.uScale,node.scale);
   gl.uniform4fv(uni.uQuat,node.rotation);gl.uniform4fv(uni.uColor,m.color);
   gl.bindBuffer(gl.ARRAY_BUFFER,m.p.buf);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,m.p.stride,m.p.offset);
   gl.bindBuffer(gl.ARRAY_BUFFER,m.n.buf);gl.vertexAttribPointer(nor,3,gl.FLOAT,false,m.n.stride,m.n.offset);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.i.buf);gl.drawElements(gl.TRIANGLES,m.i.count,m.i.type,m.i.offset);
  }
 }
 return {draw,dispose(){for(const m of meshes)for(const k of ['p','n','i'])gl.deleteBuffer(m[k].buf);gl.deleteProgram(program)}};
}
export async function openLuoCoreMasterViewer(win){
 const doc=win.document;if(doc.getElementById('luoCoreMasterViewer'))return;
 const dialog=doc.createElement('dialog');dialog.id='luoCoreMasterViewer';
 dialog.style.cssText='border:1px solid #b89558;border-radius:22px;background:#15110e;color:#f6e3be;padding:15px;max-width:560px;width:min(96vw,560px);max-height:93vh;box-shadow:0 15px 70px #000b';
 dialog.setAttribute('aria-label','Luo Core detailed offline cat model');
 const heading=doc.createElement('h3');heading.textContent='Luo Core · High-Detail 3D';heading.style.cssText='color:#ebc77d;font:700 18px Georgia,serif;margin:3px';
 const close=doc.createElement('button');close.textContent='Close';close.type='button';
 close.style.cssText='background:#382617;color:#f6dba7;padding:10px;border:1px solid #9c7641;border-radius:10px';
 const header=doc.createElement('div');header.style.cssText='display:flex;justify-content:space-between;align-items:center';header.append(heading,close);
 const intro=doc.createElement('p');intro.textContent='Drag to rotate. Use your scroll wheel or pinch-zoom controls to inspect the detailed model.';
 intro.style.cssText='font-size:12px;color:#b9a589';
 const canvas=doc.createElement('canvas');canvas.width=600;canvas.height=600;canvas.tabIndex=0;
 canvas.style.cssText='width:100%;aspect-ratio:1;background:#1b1816;touch-action:none;border-radius:14px';
 canvas.setAttribute('aria-label','Interactive 3D golden cat');
 const select=doc.createElement('select');select.style.cssText='display:block;width:100%;min-height:43px;color:#f7dfa9;background:#241a14;border:1px solid #957145;border-radius:10px';
 select.setAttribute('aria-label','Choose 3D motion');
 const status=doc.createElement('p');status.setAttribute('role','status');status.textContent='Loading your offline Luo Core model…';status.style.cssText='font-size:12px;color:#c8b494';
 dialog.append(header,intro,canvas,select,status);doc.body.append(dialog);
 let running=false,frame=0,start=0,last=0,renderer=null,yaw=.4,pitch=.07,zoom=1.04,drag=null,clip=null;
 const reduced=!!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const dispose=()=>{running=false;if(frame)win.cancelAnimationFrame?.(frame);renderer?.dispose();dialog.remove()};
 dialog.addEventListener('close',dispose,{once:true});
 close.addEventListener('click',()=>{if(dialog.close)dialog.close();else dispose()});
 if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
 function tick(now){
  frame=0;if(!running||!renderer||doc.visibilityState==='hidden')return;
  if(!last||now-last>=48){renderer.draw({yaw,pitch,zoom,seconds:reduced?0:(now-start)/1000,clip:reduced?null:clip});last=now}
  if(!reduced)frame=win.requestAnimationFrame(tick);
 }
 const request=()=>{if(running&&!frame)frame=win.requestAnimationFrame(tick)};
 canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];try{canvas.setPointerCapture(e.pointerId)}catch{}});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.012;pitch=Math.max(-.7,Math.min(.7,pitch+(e.clientY-drag[1])*.01));drag=[e.clientX,e.clientY];if(reduced)request()});
 canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.7,Math.min(1.6,zoom-e.deltaY*.001));if(reduced)request()},{passive:false});
 canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')yaw-=.12;else if(e.key==='ArrowRight')yaw+=.12;else if(e.key==='ArrowUp')pitch+=.09;else if(e.key==='ArrowDown')pitch-=.09;else return;e.preventDefault();if(reduced)request()});
 try{
  const response=await win.fetch(LUO_CORE_MODEL_URL,{credentials:'same-origin'});
  if(!response.ok)throw Error('The high-detail model has not finished downloading.');
  const scene=parseLuoCoreGlb(await response.arrayBuffer());
  if(!dialog.isConnected)return;
  const gl=canvas.getContext('webgl',{antialias:true});
  if(!gl)throw Error('High-detail viewing needs WebGL; Luo Core still works in low-detail mode.');
  renderer=makeRenderer(gl,scene);
  const still=doc.createElement('option');still.value='';still.textContent='Choose a 3D motion';select.append(still);
  scene.gltf.animations.forEach((animation,i)=>{const option=doc.createElement('option');option.value=String(i);option.textContent=animation.name.replace('LuoCore_','').replaceAll('_',' ');select.append(option)});
  select.addEventListener('change',()=>{clip=select.value===''?null:scene.gltf.animations[Number(select.value)];start=win.performance.now();request()});
  status.textContent=scene.gltf.extras?.luoCore?.triangularFaces?.toLocaleString()+' real triangular faces · '+scene.gltf.animations.length+' 3D motions · offline-ready';
  running=true;start=win.performance.now();request();
  saveLuoCoreOffline(win,{force:true}).catch(()=>{});
 }catch(e){if(dialog.isConnected){status.textContent=e?.message||'3D model unavailable';select.disabled=true}}
}

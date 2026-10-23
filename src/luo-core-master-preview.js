import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LUO_CORE_MODEL_URL,saveLuoCoreOffline} from './luo-core-offline.js';
import {prepareLuoCoreScene} from './luo-core-glb-renderer.js';
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

export async function openLuoCoreMasterViewer(win){
 const doc=win.document;if(doc.getElementById('luoCoreMasterViewer'))return;
 const dialog=doc.createElement('dialog');dialog.id='luoCoreMasterViewer';
 dialog.setAttribute('aria-label','Luo Core snow-white kitten 3D gallery');
 dialog.style.cssText='border:1px solid #b89558;border-radius:20px;background:#15110e;color:#f6e3be;padding:15px;max-width:560px;width:min(96vw,560px);max-height:93vh';
 const header=doc.createElement('div');header.style.cssText='display:flex;justify-content:space-between;align-items:center';
 const label=doc.createElement('h3');label.textContent='Luo Core · Snow White 3D';
 const close=doc.createElement('button');close.type='button';close.textContent='Close';
 header.append(label,close);
 const canvas=doc.createElement('canvas');canvas.width=600;canvas.height=600;
 canvas.style.cssText='width:100%;aspect-ratio:1;border-radius:14px;touch-action:none;background:#15110e';canvas.tabIndex=0;
 const select=doc.createElement('select');select.setAttribute('aria-label','Choose a Luo Core animation');
 select.style.cssText='width:100%;min-height:40px;background:#252018;color:#f5dbac;border:1px solid #927344;border-radius:9px';
 const note=doc.createElement('p');note.setAttribute('role','status');note.textContent='Opening the animated white kitten…';
 dialog.append(header,canvas,select,note);doc.body.append(dialog);
 let renderer=null,scene=null,kitten=null,mixer=null,camera=null,raf=0,drag=null,yaw=.4,pitch=.12,disposed=false,mode='all',last=0;
 const reduced=!!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 function cleanup(){disposed=true;if(raf)win.cancelAnimationFrame?.(raf);mixer?.stopAllAction();renderer?.dispose();dialog.remove()}
 dialog.addEventListener('close',cleanup,{once:true});close.addEventListener('click',()=>{if(dialog.close)dialog.close();else cleanup()});
 if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
 const orbit=new THREE.Group();
 function animate(now){
  raf=0;if(disposed||!renderer||doc.visibilityState==='hidden')return;
  if(!reduced&&now-last<40){raf=win.requestAnimationFrame(animate);return;}
  last=now;
  orbit.rotation.y=yaw;orbit.rotation.x=pitch;
  mixer?.setTime(reduced?0:mode==='all'?(now*.001)%8:mode==='jump'?2.55+(now*.0004)%2.85:mode==='rest'?6.9+(now*.00015)%1.05:(now*.00032)%1.85);
  renderer.render(scene,camera);
  if(!reduced)raf=win.requestAnimationFrame(animate);
 }
 const request=()=>{if(!disposed&&!raf)raf=win.requestAnimationFrame(animate)};
 canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];try{canvas.setPointerCapture(e.pointerId)}catch{}});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.012;pitch=Math.max(-.55,Math.min(.55,pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];if(reduced)request()});
 canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
 canvas.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=Math.max(.65,Math.min(2,camera.zoom-e.deltaY*.001));camera.updateProjectionMatrix();if(reduced)request()},{passive:false});
 try{
  const gltf=await new GLTFLoader().loadAsync(LUO_CORE_MODEL_URL);
  if(disposed)return;
  const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
  if(!gl)throw Error('This device cannot display the detailed 3D model.');
  renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true});
  renderer.setSize(canvas.width,canvas.height,false);
  const prepared=prepareLuoCoreScene(gltf);kitten=prepared.kitten;scene=new THREE.Scene();orbit.add(kitten);scene.add(orbit);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8597ae,2.4));
  const light=new THREE.DirectionalLight(0xffe9d3,2.8);light.position.set(-3,4,5);scene.add(light);
  const size=Math.max(1.45,prepared.height*.66);
  camera=new THREE.OrthographicCamera(-size,size,size,-size,.1,40);camera.position.set(1.9,prepared.height*.83,3.3);camera.lookAt(0,prepared.height*.50,0);
  mixer=new THREE.AnimationMixer(kitten);for(const clip of gltf.animations)mixer.clipAction(clip).play();
  for(const [value,title] of [['all','Whole Blender sequence'],['idle','Breathing and blinking'],['jump','Jump and turning'],['rest','Sleepy and resting']]){
   const opt=doc.createElement('option');opt.value=value;opt.textContent=title;select.append(opt);
  }
  select.addEventListener('change',()=>{mode=select.value;request()});
  note.textContent='Original white kitten · '+gltf.animations.length+' synchronized Blender tracks · Offline ready';
  request();
  saveLuoCoreOffline(win,{force:true}).catch(()=>{});
 }catch(e){if(!disposed){note.textContent=e.message||'The 3D viewer is unavailable.';select.disabled=true}}
}

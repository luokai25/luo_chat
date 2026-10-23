import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LUO_CORE_MODEL_URL} from './luo-core-offline.js';

// Renders the actual approved Blender-exported white kitten, not procedural
// replacement geometry. All 35 animation tracks are evaluated together.
export function luoCoreAnimationTime(state={},reduced=false){
 const family=state.state||'idle';
 const t=Math.max(0,Number(state.elapsed)||0)/1000;
 if(reduced)return 0;
 if(['leap','hop','pounce','climb'].includes(family))return 2.48+Math.min(t/.85,1)*2.42;
 if(family==='land')return 4.90+Math.min(t/1.1,1)*.53;
 if(['sleep','dream','curl_up','lie_down','belly_up'].includes(family))return 6.92+((t*.14)%.95);
 if(['play_yarn','bat','paw_tap','chase','greet','happy','knead'].includes(family))return 1.15+((t*.62)%1.9);
 if(['walk','trot','balance'].includes(family))return .55+((t*.5)%1.5);
 if(['yawn','stretch','wake'].includes(family))return 6.35+((t*.5)%1.1);
 return .05+((t*.42)%1.75);
}
export function prepareLuoCoreScene(gltf){
 const remove=[];
 gltf.scene.traverse(o=>{if(o.isLight||o.isCamera)remove.push(o)});
 for(const obj of remove)obj.parent?.remove(obj);
 const bounds=new THREE.Box3().setFromObject(gltf.scene);
 if(bounds.isEmpty())throw Error('Luo Core model is missing visible geometry.');
 const center=bounds.getCenter(new THREE.Vector3());
 gltf.scene.position.set(-center.x,-bounds.min.y,-center.z);
 return {kitten:gltf.scene,height:bounds.getSize(new THREE.Vector3()).y};
}
export function createLuoCoreRenderer(canvas,{win=globalThis}={}){
 let engine=null,scene=null,camera=null,mixer=null,kitten=null,loading=null,disposed=false,unavailable=false;
 let clips=0;
 async function load(){
  if(disposed||unavailable)return false;
  if(engine)return true;
  if(loading)return loading;
  loading=(async()=>{
   const context=canvas.getContext?.('webgl2',{alpha:true,antialias:true})||canvas.getContext?.('webgl',{alpha:true,antialias:true});
   if(!context){unavailable=true;return false;}
   const renderer=new THREE.WebGLRenderer({canvas,context,alpha:true,antialias:true,powerPreference:'low-power'});
   renderer.setPixelRatio(1);
   renderer.setSize(canvas.width,canvas.height,false);
   renderer.setClearColor(0x000000,0);
   const gltf=await new GLTFLoader().loadAsync(LUO_CORE_MODEL_URL);
   if(disposed){renderer.dispose();return false;}
   if(gltf.animations.length<30)throw Error('Incomplete Luo Core animation model.');
   const built=prepareLuoCoreScene(gltf);kitten=built.kitten;
   scene=new THREE.Scene();
   scene.add(kitten);
   scene.add(new THREE.HemisphereLight(0xffffff,0x9ca6bb,2.35));
   const key=new THREE.DirectionalLight(0xfff4e8,2.3);key.position.set(-2,4,4);scene.add(key);
   const fill=new THREE.DirectionalLight(0xbacff4,1.15);fill.position.set(3,2,-2);scene.add(fill);
   // Keep tiny paws and the top of the ears within the 142 px companion frame.
   const height=Math.max(1.4,built.height),size=height*.74;
   camera=new THREE.OrthographicCamera(-size,size,size,-size,.05,50);
   camera.position.set(2.45,height*.93,4.25);
   camera.lookAt(0,height*.49,0);
   mixer=new THREE.AnimationMixer(kitten);
   for(const clip of gltf.animations)mixer.clipAction(clip).play();
   clips=gltf.animations.length;
   engine=renderer;
   return true;
  })().catch(error=>{
   unavailable=true;
   if(engine)engine.dispose();
   try{console.warn('Luo Core 3D unavailable:',error?.message||error)}catch{}
   return false;
  });
  return loading;
 }
 function render(state,now,reduced=false){
  if(disposed||!engine||!mixer||!scene)return;
  mixer.setTime(luoCoreAnimationTime(state,reduced));
  engine.render(scene,camera);
 }
 function destroy(){
  disposed=true;
  mixer?.stopAllAction();
  if(kitten){
   kitten.traverse(o=>{
    o.geometry?.dispose?.();
    if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());
    else o.material?.dispose?.();
   });
  }
  engine?.dispose();engine=null;scene=null;kitten=null;mixer=null;
 }
 return {load,render,destroy,get mode(){return engine?'webgl-gltf':unavailable?'unavailable':'loading'},get clips(){return clips}};
}

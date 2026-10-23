// Luo Core high-detail master, built with Node alone for reproducible PWA/Android packaging.
// No network requests, external model service, Blender installation or Python dependencies.
// All geometry is actual indexed 3D mesh; animation channels are glTF-standard.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const COLOR={
  honey:[222,173,98],light:[244,210,152],cream:[251,232,188],
  dark:[140,90,52],shadow:[177,121,64],pink:[196,119,125],
  nose:[142,91,99],eyeWhite:[248,235,207],iris:[110,187,142],
  pupil:[21,29,27],whisker:[245,228,206],obsidian:[39,34,33],
  gold:[246,204,85],sparkle:[255,249,225]
};
const json={asset:{version:'2.0',generator:'Luo Core offline 3D authoring master'},
 scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],buffers:[{byteLength:0}],
 bufferViews:[],accessors:[],animations:[]};
const bytes=[],mats=new Map(),nodeNames=new Map();
let faceCount=0;
function addBinary(data,target){
 const source=Buffer.isBuffer(data)?data:Buffer.from(data.buffer,data.byteOffset,data.byteLength);
 let offset=bytes.length;while(offset%4){bytes.push(0);offset++}
 for(const byte of source)bytes.push(byte);
 const view=json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:source.length,...(target?{target}:{})})-1;
 return view;
}
function acc(view,type,componentType,count,min,max){
 return json.accessors.push({bufferView:view,componentType,count,type,...(min?{min}:{}),...(max?{max}:{})})-1;
}
function material(key){
 if(mats.has(key))return mats.get(key);
 const color=COLOR[key]||COLOR.honey;
 const mat=json.materials.push({name:key,doubleSided:true,
 pbrMetallicRoughness:{baseColorFactor:[...color.map(x=>x/255),1],
 metallicFactor:key==='gold'?.27:0,roughnessFactor:['iris','gold','sparkle'].includes(key)?.37:.83}})-1;
 mats.set(key,mat);return mat;
}
function uvSphere(rx,ry,rz,lat,lon){
 const positions=[],normals=[],indices=[];
 for(let i=0;i<=lat;i++){
  const phi=i*Math.PI/lat;
  for(let j=0;j<=lon;j++){
   const theta=j*Math.PI*2/lon;
   const x=Math.sin(phi)*Math.cos(theta),y=Math.cos(phi),z=Math.sin(phi)*Math.sin(theta);
   positions.push(x*rx,y*ry,z*rz);
   const nx=x/rx,ny=y/ry,nz=z/rz,inv=1/Math.hypot(nx,ny,nz);
   normals.push(nx*inv,ny*inv,nz*inv);
  }
 }
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
  const a=i*(lon+1)+j,b=a+lon+1;
  indices.push(a,b,a+1,b,b+1,a+1);
 }
 return {positions,normals,indices};
}
function cone(radius,height,segments){
 const positions=[0,height*.5,0,0,-height*.5,0],normals=[0,1,0,0,-1,0],indices=[];
 for(let j=0;j<=segments;j++){
  const t=2*Math.PI*j/segments;
  positions.push(Math.cos(t)*radius,-height*.5,Math.sin(t)*radius);
  const normalY=radius/Math.hypot(height,radius),normalR=height/Math.hypot(height,radius);
  normals.push(Math.cos(t)*normalR,normalY,Math.sin(t)*normalR);
 }
 for(let j=0;j<segments;j++){
  const p=2+j,n=p+1;indices.push(0,p,n,1,n,p);
 }
 return {positions,normals,indices};
}
function node(name,geometry,key,translation,rotation){
 if(nodeNames.has(name))throw Error('Duplicate Luo Core node '+name);
 const positions=geometry.positions;
 const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<positions.length;i++){const axis=i%3;minimum[axis]=Math.min(minimum[axis],positions[i]);maximum[axis]=Math.max(maximum[axis],positions[i])}
 const pos=acc(addBinary(new Float32Array(positions),34962),'VEC3',5126,positions.length/3,minimum,maximum);
 const norm=acc(addBinary(new Float32Array(geometry.normals),34962),'VEC3',5126,geometry.normals.length/3);
 let max=0;for(const value of geometry.indices)if(value>max)max=value;
 const indexType=max<65536?5123:5125;
 const packed=indexType===5123?new Uint16Array(geometry.indices):new Uint32Array(geometry.indices);
 const inds=acc(addBinary(packed,34963),'SCALAR',indexType,packed.length);
 const mesh=json.meshes.push({name,primitives:[{attributes:{POSITION:pos,NORMAL:norm},indices:inds,material:material(key),mode:4}]})-1;
 const desc={name,mesh,translation};if(rotation)desc.rotation=rotation;
 const idx=json.nodes.push(desc)-1;nodeNames.set(name,idx);
 json.scenes[0].nodes.push(idx);faceCount+=packed.length/3;
}
function ball(name,at,radii,materialName,lat=40,lon=48){node(name,uvSphere(...radii,lat,lon),materialName,at)}
function pointy(name,at,radius,height,materialName,segments=48,rotation){node(name,cone(radius,height,segments),materialName,at,rotation)}
function qaxis(axis,angle){
 const n=Math.hypot(...axis),s=Math.sin(angle/2)/n;
 return [axis[0]*s,axis[1]*s,axis[2]*s,Math.cos(angle/2)];
}
function qFromUp(axis){
 const l=Math.hypot(...axis)||1;const y=[axis[0]/l,axis[1]/l,axis[2]/l];
 let cross=[y[2],0,-y[0]],w=1+y[1];if(w<1e-6){cross=[1,0,0];w=0}
 const d=Math.hypot(...cross,w);
 return [cross[0]/d,cross[1]/d,cross[2]/d,w/d];
}
function between(name,a,b,radius,key,lat=12,lon=16){
 const mid=a.map((v,i)=>(v+b[i])/2);
 const dir=a.map((v,i)=>b[i]-v),len=Math.hypot(...dir);
 node(name,uvSphere(radius,len/2,radius,lat,lon),key,mid,qFromUp(dir));
}
// Body, limbs, ears, expressive face and segmented feline tail.
ball('Body',[0,.78,-.10],[.52,.65,.44],'honey',128,128);
ball('Chest',[0,.76,.275],[.34,.48,.20],'cream',92,96);
for(const s of [-1,1]){
 const letter=s<0?'L':'R';
 ball('Haunch'+letter,[s*.38,.45,-.24],[.30,.37,.35],'light',62,64);
 ball('FrontLeg'+letter,[s*.35,.35,.29],[.15,.34,.15],'honey',52,64);
 ball('FrontPaw'+letter,[s*.35,.135,.40],[.18,.115,.23],'cream',56,64);
 ball('RearPaw'+letter,[s*.39,.13,-.36],[.21,.12,.23],'light',56,64);
 for(let k=0;k<3;k++)ball('FrontToe'+letter+k,[s*.35+(k-1)*.095,.115,.58],[.057,.065,.07],'cream',20,24);
}
ball('Neck',[0,1.22,.09],[.31,.29,.30],'light',64,64);
ball('Head',[0,1.59,.23],[.48,.435,.42],'light',128,128);
ball('Brow',[0,1.72,.585],[.34,.12,.10],'honey',54,56);
ball('MuzzleL',[-.14,1.41,.595],[.19,.155,.17],'cream',60,64);
ball('MuzzleR',[.14,1.41,.595],[.19,.155,.17],'cream',60,64);
ball('Chin',[0,1.32,.5],[.24,.09,.16],'cream',50,50);
ball('Nose',[0,1.50,.76],[.085,.047,.055],'nose',32,36);
for(const side of [-1,1]){
 const letter=side<0?'L':'R';
 pointy('EarOuter'+letter,[side*.365,2.0,.20],.215,.45,'honey',80,qaxis([0,0,1],side*.16));
 pointy('EarInner'+letter,[side*.365,2.01,.355],.13,.31,'pink',64,qaxis([0,0,1],side*.09));
 const eyeX=side*.201;
 ball('EyeSocket'+letter,[eyeX,1.64,.588],[.16,.187,.064],'dark',58,56);
 ball('EyeWhite'+letter,[eyeX,1.647,.63],[.129,.148,.052],'eyeWhite',58,56);
 ball('Iris'+letter,[side*.20,1.635,.674],[.077,.113,.031],'iris',48,48);
 ball('Pupil'+letter,[side*.20,1.637,.700],[.033,.092,.021],'pupil',42,48);
 ball('EyeSparkle'+letter,[side*.20-.025,1.685,.718],[.028,.028,.013],'sparkle',20,24);
 ball('BrowAccent'+letter,[side*.20,1.79,.585],[.135,.031,.04],'honey',36,40);
 for(let k=0;k<3;k++){
  const y=1.44+(k-1)*.058;
  between('Whisker'+letter+k,[side*.24,y,.71],[side*(.76+Math.abs(k-1)*.035),y+(k-1)*.10,.76],.0065,'whisker',12,12);
  ball('CheekDot'+letter+k,[side*(.21+.043*(k%2)),1.48-.04*k,.74],[.013,.009,.009],'shadow',14,16);
 }
}
const tail=[[.39,.86,-.4],[.61,.91,-.62],[.75,1.05,-.78],[.82,1.27,-.82],[.79,1.48,-.78],[.67,1.59,-.69],[.52,1.61,-.61]];
tail.forEach((p,i)=>ball('Tail'+String(i).padStart(2,'0'),p,[.20-i*.011,.20-i*.008,.22-i*.013],i%3?'honey':'light',44,48));
ball('Collar',[0,1.212,.29],[.30,.055,.30],'obsidian',72,72);
ball('CollarTrim',[0,1.217,.37],[.235,.025,.092],'gold',48,48);
ball('CoreEmblem',[0,1.115,.52],[.103,.125,.035],'gold',56,56);
ball('Gem',[0,1.12,.557],[.046,.060,.015],'iris',32,32);
for(const x of [-.14,.14])ball('CollarStud'+x,[x,1.217,.53],[.025,.028,.022],'gold',22,22);
for(let ring=0;ring<7;ring++)for(let j=0;j<16;j++){
 const angle=j*Math.PI*2/16;
 const x=.48*Math.cos(angle)*(1-ring*.058),z=-.1+.42*Math.sin(angle)*(1-ring*.058),y=.48+ring*.115;
 if(z>.2&&Math.abs(x)<.28)continue;
 pointy('FurTuft'+String(ring).padStart(2,'0')+'_'+String(j).padStart(2,'0'),
  [x,y,z],.023,.095,j%4===0?'light':'honey',8);
}
function scalar(values){
 const data=new Float32Array(values);
 return acc(addBinary(data),'SCALAR',5126,values.length,[Math.min(...values)],[Math.max(...values)]);
}
function vec(values,type){
 const length=type==='VEC3'?3:4;
 return acc(addBinary(new Float32Array(values.flat())),'VEC'+length,5126,values.length);
}
const motions={
 'Idle Breathe':[['Head','rotation',[0,0,1],.035],['Tail03','rotation',[0,0,1],.13]],
 'Blink':[['EyeWhiteL','scale',null,.75],['EyeWhiteR','scale',null,.75],['IrisL','scale',null,.72],['IrisR','scale',null,.72],['PupilL','scale',null,.72],['PupilR','scale',null,.72]],
 'Look Left':[['Head','rotation',[0,1,0],-.3]],
 'Look Right':[['Head','rotation',[0,1,0],.3]],
 'Nod':[['Head','rotation',[1,0,0],.18]],
 'Tilt':[['Head','rotation',[0,0,1],.22]],
 'Ear Flick':[['EarOuterL','rotation',[0,0,1],-.18],['EarInnerL','rotation',[0,0,1],-.18]],
 'Tail Wag':[['Tail03','rotation',[0,1,0],.32],['Tail05','rotation',[0,1,0],-.4]],
 'Tail Curl':[['Tail03','rotation',[0,0,1],.24],['Tail05','rotation',[0,0,1],.4]],
 'Paw Left':[['FrontPawL','rotation',[1,0,0],-.32]],
 'Paw Right':[['FrontPawR','rotation',[1,0,0],-.32]],
 'Scratch':[['FrontLegL','rotation',[0,0,1],-.18],['FrontPawL','rotation',[0,0,1],-.3]],
 'Groom':[['Head','rotation',[0,0,1],.14],['FrontPawL','rotation',[1,0,0],-.20]],
 'Stretch':[['Head','rotation',[1,0,0],-.14],['Body','rotation',[1,0,0],.06]],
 'Bow':[['Head','rotation',[1,0,0],.30]],
 'Purr':[['Head','rotation',[0,0,1],.04],['Body','rotation',[0,0,1],-.018]],
 'Happy':[['Tail05','rotation',[0,1,0],.20],['Head','rotation',[0,0,1],-.12]],
 'Alert':[['Head','rotation',[1,0,0],-.15],['EarOuterL','rotation',[0,0,1],.1],['EarOuterR','rotation',[0,0,1],-.1]],
 'Shake':[['Head','rotation',[0,1,0],.16],['Tail05','rotation',[0,1,0],.21]],
 'Reach':[['FrontPawL','rotation',[1,0,0],-.40],['Head','rotation',[1,0,0],-.10]],
 'Step':[['FrontPawL','rotation',[1,0,0],-.27],['RearPawR','rotation',[1,0,0],.23]],
 'Trot':[['FrontPawL','rotation',[1,0,0],-.35],['FrontPawR','rotation',[1,0,0],.35]],
 'Pounce':[['Head','rotation',[1,0,0],-.2],['FrontPawL','rotation',[1,0,0],-.4],['FrontPawR','rotation',[1,0,0],-.4]],
 'Wake':[['Head','rotation',[1,0,0],-.22],['EarOuterL','rotation',[0,0,1],-.12]],
 'Snooze':[['Head','rotation',[1,0,0],.18],['Tail04','rotation',[0,0,1],.13]],
 'Greet':[['Head','rotation',[0,0,1],.16],['FrontPawR','rotation',[0,0,1],.30]],
 'Listen':[['Head','rotation',[0,0,1],-.10],['EarOuterR','rotation',[0,0,1],-.20]],
 'Curious':[['Head','rotation',[0,0,1],.18],['Tail04','rotation',[0,1,0],.22]]
};
for(const [name,tracks] of Object.entries(motions)){
 const animation={name:'LuoCore_'+name.replaceAll(' ','_'),samplers:[],channels:[]};
 const time=scalar([0,.24,.48,.78,1.15]);
 for(const [nodeName,path,axis,angle] of tracks){
  if(!nodeNames.has(nodeName))throw Error('Missing animation node '+nodeName);
  const values=path==='scale'
   ?[[1,1,1],[1,1-angle*.92,1],[1,.04,1],[1,.85,1],[1,1,1]]
   :[0,angle*.65,angle,angle*.3,0].map(a=>qaxis(axis,a));
  const output=vec(values,path==='scale'?'VEC3':'VEC4');
  const s=animation.samplers.push({input:time,output,interpolation:'LINEAR'})-1;
  animation.channels.push({sampler:s,target:{node:nodeNames.get(nodeName),path}});
 }
 json.animations.push(animation);
}
json.extras={luoCore:{triangularFaces:faceCount,motionClips:json.animations.length,
 families:42,variantsPerFamily:8,companion:'Luo Core',offlineReady:true}};
if(faceCount<100000||json.animations.length!==28)throw Error('Incomplete Luo Core master');
const bin=Buffer.from(bytes);
json.buffers[0].byteLength=bin.length;
function align(buffer,pad=0){return Buffer.concat([buffer,Buffer.alloc((4-buffer.length%4)%4,pad)])}
const body=align(Buffer.from(JSON.stringify(json),'utf8'),32),data=align(bin);
const header=Buffer.alloc(12);
header.write('glTF',0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+body.length+8+data.length,8);
function chunk(data,type){const h=Buffer.alloc(8);h.writeUInt32LE(data.length,0);h.write(type,4);return Buffer.concat([h,data])}
const output=Buffer.concat([header,chunk(body,'JSON'),chunk(data,'BIN\u0000')]);
export const LUO_CORE_ASSET='/luo-core-master.glb';
export async function buildLuoCoreModel(filepath){
 await writeFile(filepath,output);
 return {bytes:output.length,faces:faceCount,clips:json.animations.length,hash:createHash('sha256').update(output).digest('hex')};
}

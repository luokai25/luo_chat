// Lightweight articulated 3D WebGL cat for the message overlay. The 565k-face
// Blender-importable master is deliberately NOT rendered continuously on phones.
const VERTEX=`
attribute vec3 aPosition;
uniform vec3 uOffset;
uniform vec3 uScale;
uniform float uRoll;
uniform float uYaw;
varying vec3 vNormal;
void main(){
 vec3 p=aPosition*uScale;
 float c=cos(uRoll),s=sin(uRoll);
 p.xy=mat2(c,s,-s,c)*p.xy;
 p+=uOffset;
 float y=.22+uYaw;float cy=cos(y),sy=sin(y);
 p.xz=mat2(cy,sy,-sy,cy)*p.xz;
 float perspective=3.8/(3.8-p.z*.25);
 gl_Position=vec4(p.x*1.23*perspective,(p.y-.94)*1.46*perspective,p.z*.24,1.);
 vec3 n=normalize(aPosition/max(uScale,vec3(.001)));
 n.xy=mat2(c,s,-s,c)*n.xy;
 n.xz=mat2(cy,sy,-sy,cy)*n.xz;
 vNormal=n;
}`;
const FRAGMENT=`
precision mediump float;
uniform vec4 uColor;
varying vec3 vNormal;
void main(){
 float diffuse=max(.0,dot(normalize(vNormal),normalize(vec3(-.45,.72,1.0))));
 float light=.42+diffuse*.58;
 vec3 warm=uColor.rgb*(light+vec3(.12,.08,.02));
 gl_FragColor=vec4(min(warm,vec3(1.)),uColor.a);
}`;
function sphereMesh(lat=18,lon=24){
 const verts=[],idx=[];
 for(let i=0;i<=lat;i++){
  const a=Math.PI*i/lat;
  for(let j=0;j<=lon;j++){
   const b=2*Math.PI*j/lon;
   verts.push(Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b));
  }
 }
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
  const a=i*(lon+1)+j,b=a+lon+1;
  idx.push(a,b,a+1,b,b+1,a+1);
 }
 return {vertices:new Float32Array(verts),indices:new Uint16Array(idx)};
}
function compile(gl,type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Luo Core shader cannot compile');
 return s;
}
const PAL={
 body:[.87,.59,.27,1],light:[1,.83,.53,1],cream:[1,.91,.7,1],
 dark:[.37,.22,.12,1],pink:[.8,.4,.47,1],nose:[.7,.35,.4,1],
 eye:[.09,.16,.13,1],iris:[.22,.77,.48,1],spark:[1,1,.92,1],
 gold:[.95,.72,.27,1],shade:[.64,.39,.20,1]
};
export function createLuoCoreRenderer(canvas){
 let gl=null,ctx=null,program=null,attributes=null;
 try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false})}catch{}
 if(gl){
  try{
   program=gl.createProgram();
   const v=compile(gl,gl.VERTEX_SHADER,VERTEX),f=compile(gl,gl.FRAGMENT_SHADER,FRAGMENT);
   gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Luo Core shader failed');
   const mesh=sphereMesh(),vbo=gl.createBuffer(),ibo=gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
   attributes={vbo,ibo,count:mesh.indices.length,
    pos:gl.getAttribLocation(program,'aPosition'),
    off:gl.getUniformLocation(program,'uOffset'),
    scale:gl.getUniformLocation(program,'uScale'),
    color:gl.getUniformLocation(program,'uColor'),
    roll:gl.getUniformLocation(program,'uRoll'),
    yaw:gl.getUniformLocation(program,'uYaw')};
   gl.enable(gl.DEPTH_TEST);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   gl.clearColor(0,0,0,0);
  }catch{gl=null;program=null}
 }
 if(!gl)try{ctx=canvas.getContext('2d')}catch{}
 let disposed=false,frames=0;
 function paint(pose={},time=0,reduced=false){
  if(disposed)return;
  const mode=pose.state||'idle',t=reduced?0:time*.001;
  const sleeping=['sleep','curl_up','lie_down','dream'].includes(mode);
  const playing=['play_yarn','bat','paw_tap','pounce','chase'].includes(mode);
  const grooming=['groom','wash_paw','scratch'].includes(mode);
  const airborne=['leap','hop','pounce','land'].includes(mode);
  const blink=sleeping||mode==='blink'||(!reduced&&Math.sin(t*.74)>.995);
  const bob=reduced?0:Math.sin(t*2.4)*.013;
  const swish=reduced?0:Math.sin(t*3.1)*.13;
  const hop=airborne&&!reduced?Math.abs(Math.sin(t*5))*.25:0;
  const breathe=1+(reduced?0:Math.sin(t*1.8)*.018);
  const squash=sleeping?.32:1;
  const headRoll=mode==='curious'?.11:mode==='look'?Math.sin(t*.9)*.09:0;
  if(gl){
   if(!program||!attributes)return;
   gl.viewport(0,0,canvas.width,canvas.height);
   gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.useProgram(program);
   gl.bindBuffer(gl.ARRAY_BUFFER,attributes.vbo);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,attributes.ibo);
   gl.enableVertexAttribArray(attributes.pos);
   gl.vertexAttribPointer(attributes.pos,3,gl.FLOAT,false,0,0);
   const part=(off,scale,c,roll=0,yaw=0)=>{
    gl.uniform3fv(attributes.off,off);
    gl.uniform3fv(attributes.scale,scale);
    gl.uniform4fv(attributes.color,PAL[c]||PAL.body);
    gl.uniform1f(attributes.roll,roll);
    gl.uniform1f(attributes.yaw,yaw);
    gl.drawElements(gl.TRIANGLES,attributes.count,gl.UNSIGNED_SHORT,0);
   };
   // Every segment is independently positioned, permitting rich poses.
   const floor=hop;
   part([0,.68+floor,-.12],[.44,.50*squash*breathe,.40],'body');
   part([0,.65+floor,.235],[.29,.39*squash,.15],'cream');
   part([-.33,.39+floor,-.26],[.21,.28*squash,.23],'light');
   part([ .33,.39+floor,-.26],[.21,.28*squash,.23],'light');
   for(const side of [-1,1]){
    part([side*.32,.25+floor,.20],[.13,.27*squash,.145],'body');
    const pawX=side*.32+(playing?side*.09:0);
    const pawY=.103+floor+(playing?.22:0)+(grooming&&side<0?.36:0);
    part([pawX,pawY,.35],[.185,.095,.225],'cream');
    part([side*.39,.105+floor,-.35],[.19,.10,.22],'light');
   }
   // Tail moves in arcs independently of breathing/ears.
   for(let i=0;i<6;i++){
    const a=i*.46+swish*(i+1);
    part([.45+Math.sin(a)*.32+i*.035,.74+floor+i*.16,-.44-i*.035],
     [.135-i*.007,.17-i*.007,.15-i*.006],i===5?'light':'body');
   }
   const hY=1.42+floor+(sleeping?-.36:0)+bob;
   part([0,hY,.23],[.405,.35,.365],'light',headRoll);
   part([-.12,hY-.16,.52],[.15,.13,.15],'cream');
   part([ .12,hY-.16,.52],[.15,.13,.15],'cream');
   part([0,hY-.11,.669],[.065,.041,.045],'nose');
   for(const side of [-1,1]){
    const ex=side*.30;
    part([ex,hY+.33,.17],[.125,.205,.095],'body',side*.24+(mode==='ear_twitch'?swish:0));
    part([ex,hY+.33,.244],[.071,.145,.033],'pink',side*.24);
    part([side*.177,hY+.035,.544],[.125,blink?.013:.131,.043],'dark');
    if(!blink){
     part([side*.177,hY+.029,.585],[.082,.11,.024],'iris');
     part([side*.177,hY+.029,.604],[.028,.091,.015],'eye');
     part([side*.177-.025,hY+.079,.62],[.024,.024,.011],'spark');
    }
   }
   part([0,1.12+floor,.43],[.26,.055,.11],'dark');
   part([0,1.065+floor,.54],[.09,.11,.035],'gold');
   if(playing){part([.54,.19+floor,.47],[.12,.12,.12],'gold');}
   frames++;
   return;
  }
  // GPU-disabled fallback still renders an accessible, shaded companion.
  if(!ctx)return;
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(w/2,h*.88-hop*h*.3);
  const scale=w/160;ctx.scale(scale,scale);
  const ell=(x,y,rx,ry,color)=>{
   ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
  };
  ell(0,0,43,7,'#0003');
  ctx.strokeStyle='#a67d44';ctx.lineCap='round';ctx.lineWidth=15;
  ctx.beginPath();ctx.moveTo(32,-31);ctx.bezierCurveTo(57,-70,63+swish*100,-97,43+swish*100,-102);ctx.stroke();
  const fur=ctx.createLinearGradient(-40,-110,45,5);
  fur.addColorStop(0,'#fff0c7');fur.addColorStop(.52,'#d7aa65');fur.addColorStop(1,'#81522b');
  ell(0,sleeping?-26:-43,40,sleeping?23:37,fur);
  ell(-29,-8,15,10,'#f3d8a8');ell(29,-8,15,10,'#f3d8a8');
  ctx.fillStyle='#c19454';
  for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*23,-100);ctx.lineTo(side*43,-135);ctx.lineTo(side*50,-92);ctx.closePath();ctx.fill()}
  ell(0,-97+(sleeping?17:0),43,35,fur);
  ell(-15,-78,18,12,'#fff0ca');ell(15,-78,18,12,'#fff0ca');
  for(const side of [-1,1]){
   ell(side*18,-101+(sleeping?17:0),10,blink?1.6:13,'#322820');
   if(!blink){ell(side*18,-101,7,10,'#74c69a');ell(side*18,-101,3,9,'#13261e');ell(side*16,-105,2,2,'#fff')}
  }
  ell(0,-81+(sleeping?17:0),5,3,'#b16c74');
  if(playing)ell(49,-6,12,12,'#e9bc5d');
  ctx.restore();frames++;
 }
 return {render:paint,get mode(){return gl?'webgl':ctx?'canvas2d':'unavailable'},get frames(){return frames},
  destroy(){disposed=true;if(gl){gl.getExtension('WEBGL_lose_context')?.loseContext();gl=null}ctx=null}};
}

// Luo AR: 240 compositional, face-anchored masks. No images, face maps,
// biometrics or video frames leave the device. Actual tracking lives separately.
export const AR_THEMES=Object.freeze([
 ['cat','Cat ears'],['fox','Fox ears'],['bunny','Bunny ears'],['dragon','Dragon horns'],
 ['crown','Royal crown'],['halo','Halo'],['devil','Devil horns'],['flower','Flower wreath'],
 ['stars','Star crown'],['space','Space helmet'],['robot','Robot visor'],['cyber','Cyber visor'],
 ['glasses','Heart glasses'],['pirate','Pirate patch'],['butterfly','Butterfly wings'],
 ['mustache','Moustache'],['beard','Sparkle beard'],['snow','Snow queen'],
 ['comic','Comic face'],['party','Party mask']
]);
export const AR_ACCENTS=Object.freeze([
 ['whiskers','Whiskers'],['freckles','Freckles'],['blush','Blush'],['sparkles','Sparkles'],
 ['hearts','Hearts'],['tears','Crystal tears'],['flowers','Petals'],['lightning','Lightning'],
 ['glitter','Glitter'],['stars','Star dust'],['dots','Cyber dots'],['rainbow','Rainbow']
]);
const COLORS=Object.freeze(['#eabf65','#e6a3c4','#8fcef0','#ad9beb','#99d7b1','#e7a678',
 '#ffdced','#eac865','#c6b7f1','#b6ece8','#e6df8e','#f2b9a2']);
export const CALL_AR_EFFECTS=Object.freeze(AR_THEMES.flatMap(([theme,title],a)=>
 AR_ACCENTS.map(([accent,accessory],b)=>Object.freeze({
  id:'ar-'+theme+'-'+accent,label:title+' + '+accessory,kind:'ar',theme,accent,
  category:theme,filter:'none',color:COLORS[(a*7+b*3)%COLORS.length]
 }))));
const TAU=Math.PI*2;
function shape(ctx,x,y,r,sides=5,start=-Math.PI/2){ctx.beginPath();for(let i=0;i<sides*2;i++){const rr=i%2?r*.48:r,angle=start+i*Math.PI/sides,px=x+Math.cos(angle)*rr,py=y+Math.sin(angle)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath()}
function heart(ctx,x,y,r){ctx.beginPath();ctx.moveTo(x,y+r*.7);ctx.bezierCurveTo(x-r*1.55,y-r*.35,x-r*.7,y-r*1.2,x,y-r*.35);ctx.bezierCurveTo(x+r*.7,y-r*1.2,x+r*1.55,y-r*.35,x,y+r*.7);ctx.closePath()}
function ellipse(ctx,x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU)}
function poly(ctx,pts){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath()}
function line(ctx,pts){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke()}
function colors(ctx,p){ctx.strokeStyle=p.color;ctx.fillStyle=p.color;ctx.lineWidth=.055;ctx.lineCap='round';ctx.lineJoin='round'}
function theme(ctx,k,phase){
 switch(k){
  case 'cat':case 'fox':case 'bunny':{
   const long=k==='bunny'?1.95:k==='fox'?1.1:1.0,wide=k==='fox'?.73:.6;
   for(const side of [-1,1]){poly(ctx,[[side*.75,-.85],[side*(.65+wide),-.95-long],[side*1.55,-.74]]);ctx.fill();ctx.save();ctx.globalAlpha=.5;poly(ctx,[[side*.86,-.95],[side*(.65+wide),-.82-long*.7],[side*1.3,-.79]]);ctx.fillStyle='#fbc8cc';ctx.fill();ctx.restore();}
   break}
  case 'dragon':case 'devil':{for(const side of [-1,1]){poly(ctx,[[side*.85,-.82],[side*1.22,-1.55],[side*.97,-1.3],[side*1.55,-1.8],[side*1.32,-.62]]);ctx.fill()}break}
  case 'crown':{poly(ctx,[[-1.4,-1],[-1.3,-1.6],[-.65,-1.28],[0,-1.85],[.65,-1.28],[1.3,-1.6],[1.4,-1],[-1.4,-1]]);ctx.fill();break}
  case 'halo':{ctx.save();ctx.lineWidth=.13;ellipse(ctx,0,-1.62,1.3,.27);ctx.stroke();ctx.restore();break}
  case 'flower':{for(let n=0;n<9;n++){const x=(n-4)*.34,y=-1.18-.32*Math.cos((n-4)*.34);for(let t=0;t<5;t++){const z=t*TAU/5;ellipse(ctx,x+Math.cos(z)*.115,y+Math.sin(z)*.115,.12,.08);ctx.fill()}}break}
  case 'stars':{for(let j=0;j<7;j++){const x=(j-3)*.42;shape(ctx,x,-1.16-.27*Math.cos(x),.19+(j%3)*.05);ctx.fill()}break}
  case 'space':{ctx.lineWidth=.10;ellipse(ctx,0,-.1,1.66,1.95);ctx.stroke();ctx.globalAlpha=.14;ellipse(ctx,0,-.1,1.6,1.86);ctx.fill();ctx.globalAlpha=1;break}
  case 'robot':case 'cyber':{ctx.globalAlpha=.42;poly(ctx,[[-1.25,-.45],[-1,-.85],[1,-.85],[1.25,-.45],[1.02,-.15],[-1.02,-.15]]);ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=.09;line(ctx,[[-1.25,-.5],[-.9,-.2],[.9,-.2],[1.25,-.5]]);if(k==='cyber')line(ctx,[[-1.15,-.6],[-.6,-.72],[.1,-.7],[.6,-.57],[1.15,-.65]]);break}
  case 'glasses':{for(const x of [-.63,.63]){heart(ctx,x,-.42,.5);ctx.lineWidth=.1;ctx.stroke()}line(ctx,[[-.15,-.55],[.15,-.55]]);break}
  case 'pirate':{ctx.fillStyle='#1c1b28';ellipse(ctx,-.62,-.42,.58,.42);ctx.fill();ctx.strokeStyle=presetAccent(ctx);ctx.lineWidth=.1;line(ctx,[[-1.26,-.43],[-.8,-.8],[.23,-.8],[1.3,-.5]]);break}
  case 'butterfly':{for(const side of [-1,1]){ellipse(ctx,side*1.07,-.23,.44,.71);ctx.fill();ellipse(ctx,side*1.13,.34,.39,.33);ctx.fill()}break}
  case 'mustache':{ctx.lineWidth=.17;ctx.beginPath();ctx.moveTo(-.85,.55);ctx.quadraticCurveTo(-.42,.18,0,.49);ctx.quadraticCurveTo(.42,.18,.85,.55);ctx.stroke();break}
  case 'beard':{ctx.globalAlpha=.5;poly(ctx,[[-1.04,.62],[-.8,1.1],[0,1.72],[.8,1.1],[1.04,.62],[.45,1.05],[0,.91],[-.45,1.05]]);ctx.fill();ctx.globalAlpha=1;break}
  case 'snow':{for(const x of [-1.1,-.4,.4,1.1]){shape(ctx,x,-1.23,.17,6);ctx.fill()}break}
  case 'comic':{ctx.lineWidth=.15;line(ctx,[[-1.2,-.85],[-.55,-1.06],[-.15,-.85]]);line(ctx,[[.15,-.85],[.55,-1.06],[1.2,-.85]]);break}
  case 'party':{poly(ctx,[[-.35,-.95],[.22,-2.1],[.75,-.98]]);ctx.fill();ctx.lineWidth=.09;ellipse(ctx,0,-.4,1.2,.56);ctx.stroke();break}
 }
}
function presetAccent(ctx){return ctx.strokeStyle||'#eac770'}
function accent(ctx,k,phase){
 switch(k){
  case 'whiskers':for(const side of [-1,1])for(let j=0;j<3;j++)line(ctx,[[side*.68,.29+j*.16],[side*(1.18+j*.08),.13+j*.23]]);break;
  case 'freckles':for(const side of [-1,1])for(let j=0;j<6;j++){ellipse(ctx,side*(.5+.13*(j%3)),.16+.11*Math.floor(j/3),.035,.035);ctx.fill()}break;
  case 'blush':for(const side of [-1,1]){ctx.globalAlpha=.23;ellipse(ctx,side*.88,.32,.36,.19);ctx.fill();ctx.globalAlpha=1;}break;
  case 'sparkles':for(const side of [-1,1]){shape(ctx,side*1.35,-.22,.28);ctx.fill()}break;
  case 'hearts':for(const side of [-1,1]){heart(ctx,side*.89,.52,.2);ctx.fill()}break;
  case 'tears':for(const side of [-1,1]){poly(ctx,[[side*.59,-.11],[side*.43,.26],[side*.7,.35]]);ctx.fill()}break;
  case 'flowers':for(const side of [-1,1])for(let k=0;k<5;k++){const a=k*TAU/5;ellipse(ctx,side*1.17+Math.cos(a)*.14,.35+Math.sin(a)*.14,.11,.06);ctx.fill()}break;
  case 'lightning':for(const side of [-1,1]){poly(ctx,[[side*1.06,-.2],[side*.86,.2],[side*1.15,.21],[side*.93,.73],[side*1.44,.04],[side*1.14,.03]]);ctx.fill()}break;
  case 'glitter':for(let i=0;i<22;i++){const x=Math.sin(i*17.31)*1.11,y=.17+Math.cos(i*19.37)*.42;ellipse(ctx,x,y,.016+(i%3)*.013,.016);ctx.fill()}break;
  case 'stars':for(let j=0;j<9;j++){const x=Math.cos(j*7.7)*1.18,y=Math.sin(j*6.9)*.42;shape(ctx,x,y,.055+(j%3)*.025);ctx.fill()}break;
  case 'dots':for(const side of [-1,1])for(let i=0;i<4;i++){ellipse(ctx,side*(1.0+i*.1),.05+i*.15,.04,.04);ctx.fill()}break;
  case 'rainbow':{const cols=['#f598bd','#e7b46d','#b7db8b','#7fd5e8','#bda8f1'];cols.forEach((c,i)=>{ctx.strokeStyle=c;ctx.lineWidth=.04;ellipse(ctx,0,.56,.52+i*.045,.12+i*.045);ctx.stroke()});break}
 }
}
// MediaPipe maps 33/263 to outer eyes, 1 to nose and 152 to chin.
// Draw in a rotated eye-based coordinate system so lenses follow head tilt.
export function drawFaceOverlay(ctx,landmarks,width,height,effect,time=0){
 if(!effect||effect.kind!=='ar'||!Array.isArray(landmarks)||landmarks.length<264)return false;
 const p=(index)=>({x:landmarks[index].x*width,y:landmarks[index].y*height});
 const left=p(33),right=p(263),chin=p(152),nose=p(1);
 if(![left.x,left.y,right.x,right.y,chin.y,nose.x].every(Number.isFinite))return false;
 const d=Math.hypot(left.x-right.x,left.y-right.y);
 if(d<8||d>Math.max(width,height)*2)return false;
 const center={x:(left.x+right.x)/2,y:(left.y+right.y)/2};
 ctx.save();try{ctx.translate(center.x,center.y);ctx.rotate(Math.atan2(right.y-left.y,right.x-left.x));
  ctx.scale(d/2.04,d/2.04);colors(ctx,effect);
  // Mild movement, no claims of full head occlusion / Snapchat Lens parity.
  const t=Math.sin(time/430)*.04;ctx.translate(0,t);
  theme(ctx,effect.theme,t);ctx.strokeStyle=effect.color;ctx.fillStyle=effect.color;accent(ctx,effect.accent,t);
 }finally{ctx.restore()}return true;
}

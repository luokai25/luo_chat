// Luo Core: local motivational AI. It never reads message contents or sends data.
// 42 movement families x 8 parameters = 336 distinct motion definitions.
export const LUO_CORE_FAMILIES=Object.freeze([
 'idle','look','blink','ear_twitch','tail_sway','tail_curl',
 'stretch','yawn','groom','wash_paw','scratch','sit',
 'lie_down','curl_up','sleep','dream','wake','stand',
 'walk','trot','pounce','hop','leap','land',
 'balance','climb','peek','roll','belly_up','play_yarn',
 'chase','bat','paw_tap','nuzzle','purr','knead',
 'happy','curious','surprised','shy','alert','greet'
]);
export const LUO_CORE_MOTIONS=Object.freeze(LUO_CORE_FAMILIES.flatMap((family,i)=>Array.from({length:8},(_,variant)=>Object.freeze({
 id:family+'_'+String(variant+1).padStart(2,'0'),
 family,variant,duration:620+(i%7)*175+variant*67,
 intensity:Math.min(.98,.22+variant*.097),
 looping:!['hop','leap','land','pounce','wake','yawn','greet'].includes(family)
}))));
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const choices=(list,r)=>{let sum=0;for(const item of list)sum+=item[1];let t=clamp(r(),0,.999999)*sum;for(const [name,weight] of list){t-=weight;if(t<0)return name}return list.at(-1)[0]};
export function createLuoCoreBrain({random=Math.random}={}){
 let state='idle',variant=0,elapsed=0,energy=.78,affection=.53,curiosity=.71,playfulness=.75,awareness=.55;
 let eventCount=0,steps=0,activity=null,activityRemaining=0;
 const motion=()=>LUO_CORE_MOTIONS[LUO_CORE_FAMILIES.indexOf(state)*8+variant];
 function choose(family){
  if(!LUO_CORE_FAMILIES.includes(family))return null;
  state=family;variant=(variant+1)%8;elapsed=0;steps++;return motion();
 }
 function signal(kind){
  if(kind==='new_message'){eventCount++;curiosity=clamp(curiosity+.075);awareness=clamp(awareness+.10);if(energy>.2&&state!=='sleep'&&!activityRemaining)choose('alert')}
  if(kind==='scroll'){curiosity=clamp(curiosity+.013);awareness=clamp(awareness+.025)}
  if(kind==='away'){awareness=clamp(awareness-.15)}
  return snapshot();
 }
 function command(kind){
  if(kind==='pet'){activity='pet';activityRemaining=2600;affection=clamp(affection+.09);energy=clamp(energy+.02);return choose('purr')}
  if(kind==='play'){activity='play';activityRemaining=11000;energy=clamp(energy-.09);playfulness=clamp(playfulness+.05);return choose('play_yarn')}
  if(kind==='nap'){activity='nap';activityRemaining=24000;energy=clamp(energy+.13);return choose('curl_up')}
  if(kind==='jump'){activity=null;activityRemaining=0;energy=clamp(energy-.05);return choose('leap')}
  if(kind==='greet')return choose('greet');
  if(kind==='follow')return choose('walk');
  return null;
 }
 function tick(dt=16,{visible=true,motion=true}={}){
  if(!visible||!motion)return snapshot();
  const delta=clamp(Number(dt)||0,0,450);
  elapsed+=delta;
  activityRemaining=Math.max(0,activityRemaining-delta);
  if(activityRemaining===0)activity=null;
  const resting=['sleep','curl_up','lie_down','dream'].includes(state);
  energy=clamp(energy+(resting?.000036:-.000007)*delta);
  curiosity=clamp(curiosity+.000003*delta);
  playfulness=clamp(playfulness+.000001*delta);
  awareness=clamp(awareness-.000006*delta);
  if(elapsed>=motionDuration()){
   if(activity==='nap'){choose(choices([['sleep',6],['dream',2],['curl_up',3],['lie_down',1]],random));return snapshot()}
   if(activity==='play'){choose(choices([['play_yarn',5],['bat',3],['paw_tap',2],['chase',1]],random));return snapshot()}
   if(activity==='pet'){choose(choices([['purr',5],['knead',2],['happy',2]],random));return snapshot()}
   const menu=energy<.23?
    [['sleep',7],['curl_up',5],['yawn',2],['idle',1]]:
    [['blink',7],['ear_twitch',5],['tail_sway',5],['tail_curl',3],
     ['look',8],['sit',7],['groom',3],['stretch',4],['walk',2],
     ['knead',2],['peek',curiosity*6],['happy',affection*3],
     ['pounce',playfulness*1.6],['idle',9]];
   choose(choices(menu,random));
  }
  return snapshot();
 }
 function motionDuration(){return motion()?.duration||1200}
 function snapshot(){return {state,variant,elapsed,energy,affection,curiosity,playfulness,awareness,eventCount,steps,activity,activityRemaining,motion:motion()?.id||'idle_01'}}
 return {command,signal,tick,snapshot,choose};
}
export const LUO_CORE_VERSION='0.1.0-android-beta';

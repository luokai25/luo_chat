// Procedural pose synthesizer for all 42 Luo Core motion families.
// Every family changes the cat's geometry, and each of 8 variants changes
// the amplitude, timing, phase or direction. No message contents are accessed.
const PI=Math.PI,TAU=PI*2;
const cats={
 resting:new Set(['sit','lie_down','curl_up','sleep','dream','belly_up']),
 moving:new Set(['walk','trot','hop','leap','land','pounce','climb','chase','balance']),
 playful:new Set(['play_yarn','chase','bat','paw_tap','pounce','roll']),
 alert:new Set(['alert','surprised','peek','curious','look','greet']),
 care:new Set(['groom','wash_paw','scratch','knead','nuzzle']),
};
const specific={
 idle:{breath:1,tail:.2},
 look:{headYaw:1,eye:1,ear:.2},blink:{eyesClosed:1,headNod:.05},
 ear_twitch:{ear:1},tail_sway:{tail:1},tail_curl:{tail:1,tailCurl:1},
 stretch:{bodyY:.16,headNod:-.4,frontPaw:.3,backPaw:.4},
 yawn:{mouth:1,eyesClosed:.7,headNod:-.3},
 groom:{frontPaw:.9,headRoll:.24,mouth:.3},
 wash_paw:{frontPaw:1,mouth:.2,headNod:.2},
 scratch:{backPaw:1,headRoll:-.3},
 sit:{bodyY:-.1,backPaw:.3},lie_down:{bodyY:-.29,squash:.48,eyesClosed:.12},
 curl_up:{bodyY:-.33,squash:.58,tailCurl:1,eyesClosed:.58},
 sleep:{bodyY:-.34,squash:.62,tailCurl:.8,eyesClosed:1},
 dream:{bodyY:-.31,squash:.57,tailCurl:.7,eyesClosed:1,ear:.2,frontPaw:.12},
 wake:{headNod:-.5,eyesClosed:.2,bodyY:-.1},
 stand:{bodyY:.08},walk:{walk:1,headNod:.18,tail:.4},
 trot:{walk:1.6,bounce:.16,tail:.5},pounce:{hop:.7,frontPaw:.9,headNod:-.2},
 hop:{hop:.65,headNod:-.12},leap:{hop:1,frontPaw:.6,headNod:-.2},
 land:{hop:.15,squash:.1,frontPaw:.3},
 balance:{headRoll:.18,tail:1,frontPaw:.1},
 climb:{bodyY:.16,frontPaw:1,walk:.55},
 peek:{bodyY:-.08,headYaw:.5,headRoll:.3,ear:.5},
 roll:{bodyRoll:.4,frontPaw:.55,tail:.65},
 belly_up:{bodyRoll:.2,bodyY:-.25,squash:.3,frontPaw:.8},
 play_yarn:{frontPaw:1,headRoll:.15,hop:.13,tail:.7,toy:1},
 chase:{walk:1.5,hop:.25,tail:.9,toy:.5},
 bat:{frontPaw:1,headYaw:.4,toy:.7},
 paw_tap:{frontPaw:.6,headNod:.12,toy:.3},
 nuzzle:{headNod:.35,headRoll:.22,frontPaw:.13},
 purr:{breath:1.35,headRoll:.04,tail:.2},
 knead:{frontPaw:.7,bodyY:-.1,eyesClosed:.35},
 happy:{tail:.85,hop:.12,headRoll:.15},
 curious:{headRoll:.45,headYaw:.18,ear:.6},
 surprised:{ear:.75,headNod:-.24,eyesWide:1,tail:.2},
 shy:{headYaw:-.4,headNod:.2,eyesClosed:.15,tailCurl:.35},
 alert:{headNod:-.20,ear:.9,eyesWide:.55},
 greet:{frontPaw:.85,headRoll:.28,tail:.8},
};
export const LUO_CORE_POSE_FAMILIES=Object.freeze(Object.keys(specific));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function synthesizeLuoCorePose(state={},time=0,reduced=false){
 const family=Object.hasOwn(specific,state.state)?state.state:'idle';
 const spec=specific[family];
 const variant=clamp(Math.floor(Number(state.variant)||0),0,7);
 const amplitude= .68+variant*.07;
 const duration=clamp(Number(state.duration)||1200,400,3500);
 const f=clamp((Number(state.elapsed)||0)/duration,0,1);
 const seconds=Number(time||0)/1000;
 const phase=(reduced?0:seconds*(2.2+variant*.17)) + variant*.34;
 const wave=reduced?0:Math.sin(phase);
 const cycle=reduced?0:Math.sin(phase*2);
 const lift=reduced?0:Math.max(0,Math.sin(f*PI));
 const direction=variant%2?-1:1;
 const slowWave=reduced?0:Math.sin(seconds*1.45+variant*.32);
 const moving=cats.moving.has(family),playful=cats.playful.has(family),resting=cats.resting.has(family);
 const care=cats.care.has(family),alert=cats.alert.has(family);
 const headRoll=(spec.headRoll||0)*amplitude*(reduced?1:.7+.3*wave)*direction;
 const headNod=(spec.headNod||0)*amplitude*(reduced?1:.65+.35*cycle);
 const headYaw=(spec.headYaw||0)*amplitude*direction*(reduced?1:slowWave);
 const leftPaw=(spec.frontPaw||0)*amplitude*(care||resting?1:Math.max(.2,(wave+1)/2));
 const rightPaw=(spec.frontPaw||0)*amplitude*(family==='greet'?.05:care?.32:Math.max(.2,(1-wave)/2));
 const blink=family==='blink'||family==='sleep'||family==='dream'||family==='yawn';
 const eyeClose=clamp(spec.eyesClosed||0,0,1);
 const sleepyRest=resting?.012:0;
 const breath=(spec.breath||1)*(reduced?0:Math.sin(seconds*(resting?1.1:2.1))*.023);
 return Object.freeze({
  family,variant,amplitude,
  bodyY:(spec.bodyY||0)*amplitude+sleepyRest+breath*.45,
  bodyRoll:(spec.bodyRoll||0)*amplitude*(reduced?1:wave),
  bodySquash:clamp(1-(spec.squash||0)*amplitude,.36,1.15),
  breathScale:1+breath,
  bounce:(spec.bounce||0)*amplitude*Math.abs(wave),
  hop:(spec.hop||0)*amplitude*(reduced?0:lift),
  headRoll,headNod,headYaw,
  eyeClose:clamp(eyeClose+(blink?.1:0),0,1),
  eyeWide:(spec.eyesWide||0)*amplitude,
  earL:(spec.ear||0)*amplitude*(reduced?1:wave),
  earR:(spec.ear||0)*amplitude*(reduced?1:-wave),
  tail:(spec.tail||0)*amplitude*(reduced?0:slowWave),
  tailCurl:(spec.tailCurl||0)*amplitude,
  frontL:leftPaw,frontR:rightPaw,
  rear:(spec.backPaw||0)*amplitude*(reduced?1:Math.max(.2,cycle)),
  walk:(spec.walk||0)*amplitude*(reduced?0:cycle),
  mouth:(spec.mouth||0)*amplitude,
  toy:(spec.toy||0)*amplitude,
  moving,playful,resting,care,alert
 });
}

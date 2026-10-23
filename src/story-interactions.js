// Luo Story Interactive Stickers: polls and quizzes with audience-only, one-vote
// RPCs. Plain text DOM only; no untrusted HTML or direct write access to tables.
export function normalizeStoryPrompt({kind,question,choices,correctIndex=null}={}){
 if(kind===''||kind==='none'||kind==null)return null;
 if(!['poll','quiz'].includes(kind))throw Error('Choose a supported sticker type.');
 const text=String(question||'').trim();
 if(text.length<3||text.length>160)throw Error('Add a question between 3 and 160 characters.');
 const options=Array.from(choices||[]).map(c=>String(c||'').trim()).filter(Boolean);
 if(options.length<2||options.length>4||options.some(c=>c.length>80))
  throw Error('Provide two to four choices, each 80 characters or less.');
 if(new Set(options.map(c=>c.toLocaleLowerCase())).size!==options.length)
  throw Error('Each answer choice must be different.');
 if(kind==='quiz'&&(!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>=options.length))
  throw Error('Select the correct quiz answer.');
 return {kind,question:text,choices:options,correctIndex:kind==='quiz'?correctIndex:null};
}
export function installStoryPrompts({win,db,getUser,note}){
 const doc=win.document;
 const form=doc.getElementById('storyForm');
 if(!form)return {ready:async()=>false,validate:()=>null,publish:async()=>{},render:async()=>{},signedOut(){}};
 const el=(tag,cl,text)=>{const n=doc.createElement(tag);if(cl)n.className=cl;if(text!=null)n.textContent=String(text);return n};
 const field=el('fieldset','luo-story-interaction');
 field.id='storyInteractiveSticker';
 const legend=el('legend','','Interactive Story sticker');
 const explanation=el('p','muted','Let your selected audience vote on a private poll or answer a quiz.');
 const kind=el('select','field');
 kind.id='storyStickerKind';
 for(const [v,label] of [['none','No interactive sticker'],['poll','Poll · let friends vote'],['quiz','Quiz · reveal the right answer']]){
  const n=el('option','',label);n.value=v;kind.append(n);
 }
 const details=el('div','luo-story-sticker-details');details.hidden=true;
 const qlabel=el('label','','Question'),question=el('input','field');
 question.id='storyStickerQuestion';question.maxLength=160;question.placeholder='What do you think?';qlabel.append(question);
 const choices=[];
 details.append(qlabel);
 for(let i=0;i<4;i++){
  const lab=el('label','',i<2?'Choice '+(i+1):'Optional choice '+(i+1));
  const input=el('input','field');input.maxLength=80;input.placeholder=i===0?'First answer':i===1?'Second answer':'Add another choice';
  input.id='storyStickerChoice'+i;lab.append(input);details.append(lab);choices.push(input);
 }
 const correctLabel=el('label','','Correct quiz answer');
 const correct=el('select','field');correct.id='storyStickerCorrect';
 for(let i=0;i<4;i++){const opt=el('option','','Choice '+(i+1));opt.value=String(i);correct.append(opt)}
 correctLabel.append(correct);correctLabel.hidden=true;
 details.append(correctLabel);
 const state=el('p','tiny muted','');state.id='storyStickerSupportStatus';state.setAttribute('role','status');
 field.append(legend,explanation,kind,details,state);
 const audienceLabel=doc.querySelector('label[for="storyAudience"]');
 if(audienceLabel)audienceLabel.before(field);else form.append(field);
 const css=el('style');css.id='luo-story-interaction-css';css.textContent=[
  '.luo-story-interaction{margin:16px 0;padding:16px;border:1px solid #74552e;border-radius:16px;background:linear-gradient(145deg,#241c18,#111113)}',
  '.luo-story-interaction legend{font-weight:800;letter-spacing:.025em;color:#f3c980;padding:0 7px}',
  '.luo-story-interaction .muted{font-size:12px;margin:5px 0 11px;color:#c9b896}',
  '.luo-story-sticker-details{display:grid;gap:11px;margin-top:12px}',
  '.luo-story-sticker-details label{display:grid;gap:4px;font-size:13px;color:#dfc697}',
  '.luo-story-sticker-details .field{min-height:40px}',
  '.luo-story-interactive-card{border:1px solid #956b35;background:radial-gradient(circle at 95% -5%,#4c3524,#181515 55%);padding:14px;margin:13px 0;border-radius:18px;display:grid;gap:9px;color:#faecd2}',
  '.luo-story-interactive-card h4{font-weight:800;letter-spacing:.01em;font-size:16px;margin:0}',
  '.luo-story-interactive-card .story-option{display:flex;justify-content:space-between;align-items:center;gap:9px;padding:11px 12px;border-radius:12px;border:1px solid #947045;background:rgba(50,40,31,.72);color:#ffedcc;min-height:42px;text-align:start}',
  '.luo-story-interactive-card button.story-option:hover:not(:disabled){border-color:#e8c98c;background:#493421}',
  '.luo-story-interactive-card .story-option[data-chosen="true"]{outline:2px solid #e9c17b;outline-offset:1px}',
  '.luo-story-interactive-card .story-option[data-correct="true"]{border-color:#cfbe7d}',
  '.luo-story-interactive-card .story-option[disabled]{opacity:1}',
  '.luo-story-interactive-card .result-meter{position:relative;height:6px;background:#51402b;overflow:hidden;border-radius:6px}',
  '.luo-story-interactive-card .result-meter>i{display:block;width:var(--fill,0%);height:100%;border-radius:inherit;background:linear-gradient(90deg,#a88640,#f5d89a);transition:width .5s ease}',
  '.luo-story-interactive-card .sticker-note{font-size:12px;color:#d5c3a4}',
  '@media(prefers-reduced-motion:reduce){.luo-story-interactive-card .result-meter>i{transition:none}}'
 ].join('\n');doc.head.append(css);
 let epoch=0,availability=null,checking=null,renderCounter=0;
 const session=()=>{const actor=getUser()?.id,stamp=epoch;return()=>!!actor&&getUser()?.id===actor&&stamp===epoch};
 const rpc=async(name,args)=>{const r=await db.rpc(name,args);if(r?.error)throw Error(r.error.message||'Interactive Story service unavailable.');return r?.data};
 const updateFields=()=>{details.hidden=kind.value==='none';correctLabel.hidden=kind.value!=='quiz'};
 kind.onchange=updateFields;updateFields();
 const isUnavailableError=e=>/PGRST202|not found|schema cache|does not exist/i.test(String(e?.message||e));
 async function ready(){
  if(availability===true)return true;
  if(checking)return checking;
  const actor=getUser()?.id,stamp=epoch;
  checking=(async()=>{
   state.textContent='Checking interactive Story stickers…';
   try{
    // Random story ID returns null. This also verifies the backend function exists.
    await rpc('get_chat_story_prompt',{target_story_id:win.crypto.randomUUID()});
    if(actor!==getUser()?.id||stamp!==epoch)return false;
    availability=true;kind.disabled=false;
    state.textContent='Polls and quizzes are private to your selected Story audience.';
    return true;
   }catch(e){
    if(actor!==getUser()?.id||stamp!==epoch)return false;
    availability=false;kind.value='none';kind.disabled=true;updateFields();
    state.textContent=isUnavailableError(e)?'Interactive stickers need the Story backend update. Normal Stories still work.':'Interactive stickers could not connect. Open Story composer again to retry.';
    return false;
   }finally{checking=null}
  })();
  return checking;
 }
 const validate=()=>{
  if(kind.value==='none')return null;
  if(availability!==true)throw Error('Interactive Story stickers are unavailable on this server.');
  return normalizeStoryPrompt({kind:kind.value,question:question.value,choices:choices.map(x=>x.value),correctIndex:Number(correct.value)});
 };
 async function publish(storyId,spec){
  if(!spec)return;
  const data=await rpc('create_chat_story_prompt',{
   target_story_id:storyId,prompt_kind:spec.kind,prompt_question:spec.question,
   prompt_choices:spec.choices,answer_index:spec.correctIndex
  });
  if(data!==true)throw Error('Story was shared but its interactive sticker was not saved.');
 }
 const draw=(root,storyId,prompt,active)=>{
  if(!active()||!root.isConnected)return;
  root.replaceChildren();
  if(!prompt||!['poll','quiz'].includes(prompt.kind))return;
  const card=el('section','luo-story-interactive-card');
  card.setAttribute('aria-label',prompt.kind==='quiz'?'Story quiz':'Story poll');
  const header=el('h4','',prompt.question);
  const status=el('p','sticker-note','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const hasVoted=Number.isInteger(prompt.my_choice),isOwner=prompt.is_owner===true;
  const reveal=(hasVoted||isOwner)&&Array.isArray(prompt.counts);
  const choices=Array.isArray(prompt.choices)?prompt.choices.slice(0,4):[];
  const correctIndex=Number.isInteger(prompt.correct_index)?prompt.correct_index:null;
  card.append(el('p','sticker-note',prompt.kind==='quiz'?'✦ QUIZ':'✦ POLL'),header);
  for(let i=0;i<choices.length;i++){
   const button=el('button','story-option',choices[i]);button.type='button';
   button.dataset.chosen=String(prompt.my_choice===i);
   if(reveal&&correctIndex===i)button.dataset.correct='true';
   if(reveal||isOwner)button.disabled=true;
   const row=el('div','');row.append(button);
   if(reveal){
    const total=Number(prompt.total_votes)||0,count=Number(prompt.counts[i])||0;
    const label=el('span','sticker-note',count+' vote'+(count===1?'':'s')+' · '+(total?Math.round(100*count/total):0)+'%');
    const meter=el('div','result-meter');const fill=el('i');fill.style.setProperty('--fill',(total?Math.round(100*count/total):0)+'%');meter.append(fill);row.append(label,meter);
   }else if(!isOwner){
    button.onclick=async()=>{
     for(const b of card.querySelectorAll('button'))b.disabled=true;
     status.textContent='Submitting your answer…';
     try{
      const answered=await rpc('vote_chat_story_prompt',{target_story_id:storyId,selected_index:i});
      if(!active()||!root.isConnected)return;
      if(!answered)throw Error('This Story expired or is no longer available to you.');
      draw(root,storyId,answered,active);
     }catch(e){
      if(!active()||!root.isConnected)return;
      for(const b of card.querySelectorAll('button'))b.disabled=false;
      status.textContent=e.message||'Could not save your answer.';
     }
    };
   }
   card.append(row);
  }
  if(reveal){
   if(prompt.kind==='quiz'&&correctIndex!=null){
    status.textContent=isOwner?'Correct answer marked for your quiz.':prompt.my_choice===correctIndex?'Correct! Your answer was saved.':'Your answer was saved. The correct answer is highlighted.';
   }else status.textContent=(isOwner?'Live poll results · ':'Answer saved · ')+(Number(prompt.total_votes)||0)+' total votes';
  }else status.textContent=isOwner?'Only viewers you selected can answer.':'Choose one answer to reveal results. Your vote is private.';
  card.append(status);root.append(card);
 };
 async function render(root,story){
  const active=session();const ticket=++renderCounter;
  if(!active()||!story?.id)return;
  try{
   const prompt=await rpc('get_chat_story_prompt',{target_story_id:story.id});
   if(!active()||ticket>renderCounter+2000||!root.isConnected)return;
   draw(root,story.id,prompt,active);
  }catch(e){
   // An old server simply lacks this additive RPC. Regular private Story
   // reading must keep working, and no broken voting buttons are shown.
   if(!active())return;
   if(!isUnavailableError(e))note('Interactive Story sticker could not load.');
  }
 }
 function reset(){
  kind.value='none';question.value='';for(const c of choices)c.value='';
  correct.value='0';details.hidden=true;state.textContent='';
 }
 return {ready,validate,publish,render,reset,
  signedOut(){epoch++;availability=null;checking=null;renderCounter++;reset();kind.disabled=false},
  fields:{field,kind,question,choices,correct}};
}

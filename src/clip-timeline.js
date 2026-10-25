const speeds=[.5,1,1.5,2],copy=value=>value.map(segment=>({...segment}));
export function validateTimeline(duration,segments,{forExport=false}={}){
 if(!Number.isFinite(duration)||duration<=0||!Array.isArray(segments)||segments.length<1||segments.length>12)throw Error('Use between 1 and 12 segments.');
 const normalized=segments.map(value=>{if(!value||![value.start,value.end,value.speed].every(Number.isFinite)||value.start<0||value.end>duration+.02||value.end-value.start<.15||!speeds.includes(value.speed))throw Error('Each segment needs valid bounds, speed and at least 0.15 seconds.');return{start:value.start,end:value.end,speed:value.speed}});
 const total=normalized.reduce((sum,segment)=>sum+(segment.end-segment.start)/segment.speed,0);
 if(forExport&&total>90)throw Error('Trim the timeline to 90 seconds or less before exporting.');
 return{segments:normalized,duration:total};
}
export function createClipTimeline(duration){
 const initial=[{start:0,end:Math.min(duration,90),speed:1}];validateTimeline(duration,initial);
 let items=copy(initial),selected=0,past=[],future=[];
 const snapshot=()=>({items:copy(items),selected}),restore=value=>{items=copy(value.items);selected=value.selected};
 function commit(next,index){const valid=validateTimeline(duration,next).segments;if(JSON.stringify(valid)===JSON.stringify(items))return false;past.push(snapshot());if(past.length>30)past.shift();future=[];items=valid;selected=Math.max(0,Math.min(index,items.length-1));return true;}
 return{
  get segments(){return copy(items)},get selected(){return selected},get dirty(){return JSON.stringify(items)!==JSON.stringify(initial)},get canUndo(){return !!past.length},get canRedo(){return !!future.length},get total(){return validateTimeline(duration,items).duration},
  select(index){if(!Number.isInteger(index)||index<0||index>=items.length)throw Error('Choose a timeline segment.');selected=index},
  split(at){const segment=items[selected];if(items.length===12)throw Error('Maximum 12 segments.');if(!Number.isFinite(at)||at-segment.start<.15||segment.end-at<.15)throw Error('Move the playhead inside this segment, at least 0.15 seconds from each edge.');return commit([...items.slice(0,selected),{...segment,end:at},{...segment,start:at},...items.slice(selected+1)],selected+1)},
  update(values){return commit(items.map((item,index)=>index===selected?{...item,...values}:item),selected)},
  move(direction){if(![-1,1].includes(direction))throw Error('Invalid move.');const target=selected+direction;if(target<0||target>=items.length)return false;const next=copy(items);[next[target],next[selected]]=[next[selected],next[target]];return commit(next,target)},
  remove(){if(items.length===1)throw Error('Keep at least one segment.');return commit(items.filter((_,index)=>index!==selected),Math.max(0,selected-1))},
  undo(){if(!past.length)return false;future.push(snapshot());restore(past.pop());return true},redo(){if(!future.length)return false;past.push(snapshot());restore(future.pop());return true},reset(){return commit(initial,0)}
 };
}

export function installClipTimeline({win,edit,preview,isCurrent,isLocked,onChange,onStatus}){
 const doc=win.document,panel=doc.createElement('details');panel.className='luo-clip-timeline';const summary=doc.createElement('summary');summary.textContent='Timeline · split, reorder and undo';
 const help=doc.createElement('p');help.textContent='Arrange up to 12 pieces of this source video. Apply edits before publishing or saving a device draft. Source-time positions are shown; this is not yet a multi-file editor.';
 const strip=doc.createElement('div');strip.className='luo-timeline-strip';strip.setAttribute('role','group');strip.setAttribute('aria-label','Timeline segments');
 const position=doc.createElement('input');position.type='range';position.step='.05';position.setAttribute('aria-label','Timeline playhead in source seconds');
 const controls=doc.createElement('div');controls.className='luo-timeline-controls';const buttons={};let model=null,sourceDuration=0;
 function action(name,label,fn){const button=doc.createElement('button');button.type='button';button.textContent=label;button.dataset.timeline=name;button.onclick=()=>{if(!model||!isCurrent()||isLocked())return;try{if(fn()){render();onChange(model.dirty)}}catch(error){onStatus(error.message)}};buttons[name]=button;controls.append(button);}
 action('split','Split at playhead',()=>model.split(preview.currentTime));action('left','Move earlier',()=>model.move(-1));action('right','Move later',()=>model.move(1));action('delete','Delete segment',()=>model.remove());action('undo','Undo',()=>model.undo());action('redo','Redo',()=>model.redo());action('reset','Reset timeline',()=>model.reset());
 const fields=doc.createElement('div');fields.className='luo-timeline-fields';const start=doc.createElement('input'),end=doc.createElement('input'),speed=doc.createElement('select');for(const [input,label]of [[start,'Segment start seconds'],[end,'Segment end seconds']]){input.type='number';input.min='0';input.step='.05';input.setAttribute('aria-label',label);const holder=doc.createElement('label');holder.textContent=label;holder.append(input);fields.append(holder)}speed.setAttribute('aria-label','Segment speed');for(const rate of speeds){const option=doc.createElement('option');option.value=String(rate);option.textContent=rate+'×';speed.append(option)}fields.append(speed);
 for(const field of [start,end,speed])field.onchange=()=>{if(!model||!isCurrent()||isLocked())return;try{model.update({start:Number(start.value),end:Number(end.value),speed:Number(speed.value)});render();onChange(model.dirty)}catch(error){render();onStatus(error.message)}};
 position.oninput=()=>{if(!model||!isCurrent()||isLocked())return;preview.pause();preview.currentTime=Number(position.value)};
 const followPlayhead=()=>{if(!model||!isCurrent()||isLocked())return;const range=model.segments[model.selected];position.value=String(Math.max(range.start,Math.min(range.end,preview.currentTime)))};preview.addEventListener('timeupdate',followPlayhead);
 const total=doc.createElement('p');total.className='luo-timeline-total';panel.append(summary,help,strip,position,fields,controls,total);edit.append(panel);
 function render(){strip.replaceChildren();if(!model)return;const segments=model.segments,selected=segments[model.selected];for(const [index,segment]of segments.entries()){const button=doc.createElement('button');button.type='button';button.setAttribute('aria-pressed',String(index===model.selected));button.textContent=(index+1)+' · '+segment.start.toFixed(2)+'–'+segment.end.toFixed(2)+'s · '+segment.speed+'×';button.onclick=()=>{if(isLocked()||!isCurrent())return;model.select(index);render();preview.pause();preview.currentTime=segment.start};strip.append(button)}start.value=String(selected.start);end.value=String(selected.end);start.max=end.max=String(sourceDuration);speed.value=String(selected.speed);position.min=String(selected.start);position.max=String(selected.end);position.value=String(Math.max(selected.start,Math.min(selected.end,preview.currentTime||selected.start)));total.textContent=segments.length+' segment(s) · '+model.total.toFixed(2)+'s planned output'+(model.dirty?' · edits not applied':'');buttons.undo.disabled=!model.canUndo;buttons.redo.disabled=!model.canRedo;buttons.left.disabled=model.selected===0;buttons.right.disabled=model.selected===segments.length-1;buttons.delete.disabled=segments.length===1;}
 return{load(duration){sourceDuration=duration;if(duration<.15){model=null;panel.hidden=true;return}panel.hidden=false;model=createClipTimeline(duration);render()},get dirty(){return !!model?.dirty},get segments(){return model?.segments||[]},get selectedRange(){return model?.segments[model.selected]},clear(){model=null;strip.replaceChildren();total.textContent='';},dispose(){model=null;preview.removeEventListener('timeupdate',followPlayhead);panel.remove()}};
}

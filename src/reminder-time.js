export function localDateTime(date){return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,16)}
// Conservative local suggestions, always reviewed in the calendar before saving.
export function suggestReminder(text,now=new Date()){
 const value=String(text).trim().toLowerCase();if(!Number.isFinite(now.valueOf()))return null;
 const relative=value.match(/\bin\s+(\d{1,4})\s*(minutes?|mins?|hours?|hrs?|days?)\b/);
 if(relative){if(/\bat\s+\d/.test(value)||/\d+\s*(?:minutes?|mins?|hours?|hrs?|days?)\b/.test(value.slice(relative.index+relative[0].length)))return null;const n=Number(relative[1]),unit=relative[2];if(n<1)return null;const date=new Date(now);if(unit.startsWith('day')){if(n>365)return null;const hour=date.getHours(),minute=date.getMinutes();date.setDate(date.getDate()+n);if(date.getHours()!==hour||date.getMinutes()!==minute)return null}else{const scale=unit.startsWith('h')?3600000:60000;if(n*scale>365*86400000)return null;date.setTime(date.valueOf()+n*scale)}return{when:date,reason:'Suggested from “'+relative[0]+'” in your device time zone.'}}
 const day=value.match(/\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/),iso=value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);if(!day&&!iso)return null;
 const clock=value.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);if(/\bat\s+\d/.test(value)&&!clock)return null;
 let hour=clock?Number(clock[1]):9,minute=clock?Number(clock[2]||0):0;
 if(minute>59||hour>(clock?.[3]?12:23)||clock?.[3]&&hour===0)return null;
 if(clock?.[3])hour=hour%12+(clock[3]==='pm'?12:0);
 const date=new Date(now);let wantedDate;
 if(iso){const year=Number(iso[1]),month=Number(iso[2])-1,d=Number(iso[3]);date.setFullYear(year,month,d);if(date.getFullYear()!==year||date.getMonth()!==month||date.getDate()!==d)return null;wantedDate=d}
 else if(day[1]==='tomorrow')date.setDate(date.getDate()+1);
 else if(day[1]!=='today'){const target=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(day[1]);date.setDate(date.getDate()+(target-date.getDay()+7)%7);date.setHours(hour,minute,0,0);if(date<=now)date.setDate(date.getDate()+7)}
 wantedDate??=date.getDate();date.setHours(hour,minute,0,0);
 if(date.getDate()!==wantedDate||date.getHours()!==hour||date.getMinutes()!==minute||date<=now)return null;
 return{when:date,reason:'Suggested local date/time. Review the calendar before saving; day-only phrases use 09:00.'};
}

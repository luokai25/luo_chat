// Client-side age classification only. The signup server must also validate
// the age band and verified guardian approval; this is not an authorization claim.
export const MINIMUM_AGE=12;
export const GUARDIAN_APPROVAL_BELOW=18;
export function ageBand(birthDate,today=new Date()){
 if(typeof birthDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))return 'invalid';
 const [year,month,day]=birthDate.split('-').map(Number);
 const birth=new Date(Date.UTC(year,month-1,day));
 if(birth.getUTCFullYear()!==year||birth.getUTCMonth()!==month-1||birth.getUTCDate()!==day)return 'invalid';
 if(!(today instanceof Date)||!Number.isFinite(today.getTime())||birth.getTime()>today.getTime())return 'invalid';
 let age=today.getUTCFullYear()-year;
 if(today.getUTCMonth()+1<month||(today.getUTCMonth()+1===month&&today.getUTCDate()<day))age--;
 if(age<MINIMUM_AGE)return 'under12';
 return age<GUARDIAN_APPROVAL_BELOW?'12-17':'18+';
}

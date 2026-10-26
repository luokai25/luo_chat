// Luo Chat age categories and presentation policy.
// A birthdate typed into a browser is *not* proof of age; the server must
// independently assure eligibility before account creation or content access.
export const INDEPENDENT_ACCOUNT_MINIMUM_AGE=13;
export const MANDATORY_SAFE_MODE_BELOW=15;
export const MINOR_AGE_BELOW=18;
export const AGE_TIERS=Object.freeze(['under13','13-14','15-17','18+']);
export const CONTENT_RATINGS=Object.freeze(['general','teen','mature','unreviewed']);
export function ageBand(birthDate,today=new Date()){
 if(typeof birthDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))return 'invalid';
 if(!(today instanceof Date)||!Number.isFinite(today.getTime()))return 'invalid';
 const [year,month,day]=birthDate.split('-').map(Number);
 const birth=new Date(Date.UTC(year,month-1,day));
 if(birth.getUTCFullYear()!==year||birth.getUTCMonth()!==month-1||birth.getUTCDate()!==day
  ||birth.getTime()>today.getTime())return 'invalid';
 let age=today.getUTCFullYear()-year;
 if(today.getUTCMonth()+1<month||(today.getUTCMonth()+1===month&&today.getUTCDate()<day))age--;
 if(age<0||age>125)return 'invalid';
 if(age<INDEPENDENT_ACCOUNT_MINIMUM_AGE)return 'under13';
 if(age<MANDATORY_SAFE_MODE_BELOW)return '13-14';
 if(age<MINOR_AGE_BELOW)return '15-17';
 return '18+';
}
export function safetyTierForAge(ageTier){
 if(ageTier==='18+')return 'adult';
 if(ageTier==='15-17')return 'teen';
 // Unknown age must never imply adult permissions.
 return 'junior';
}
export function mayShowRatedContent(ageTier,rating,{reviewed=true}={}){
 const tier=safetyTierForAge(ageTier);
 if(!CONTENT_RATINGS.includes(rating))return false;
 if(tier==='adult')return true; // Lawful content only; universal moderation still applies.
 if(!reviewed||rating==='unreviewed')return false;
 return tier==='teen'?rating==='general'||rating==='teen':rating==='general';
}
export function signupReadiness(ageTier,{ageAssured=false,safeModeEnforced=false,teenProtectionsEnforced=false}={}){
 if(!AGE_TIERS.includes(ageTier))return {permitted:false,code:'INVALID_AGE'};
 if(ageTier==='under13')return {permitted:false,code:'INDEPENDENT_ACCOUNT_UNAVAILABLE'};
 if(ageTier==='13-14')return {permitted:Boolean(ageAssured&&safeModeEnforced),code:ageAssured&&safeModeEnforced?'SAFE_MODE':'PROTECTIONS_NOT_READY'};
 if(ageTier==='15-17')return {permitted:Boolean(ageAssured&&teenProtectionsEnforced),code:ageAssured&&teenProtectionsEnforced?'TEEN':'PROTECTIONS_NOT_READY'};
 return {permitted:true,code:'ADULT'};
}

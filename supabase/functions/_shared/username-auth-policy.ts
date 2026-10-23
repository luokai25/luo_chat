/**
 * Shared v2 username-auth validation. This module deliberately makes no network
 * calls and carries no Supabase service credentials. It is NOT an auth endpoint.
 */
export const USERNAME_RE=/^[a-z][a-z0-9_]{2,23}$/;
const RESERVED=new Set(['admin','administrator','support','moderator','official','security','system','root','luo','luochat','luo_chat','help','staff','api','auth','login','signup','register','null','undefined']);
export function canonicalUsername(input){
 if(typeof input!=='string')return null;
 const text=input.trim().toLowerCase();
 if(!USERNAME_RE.test(text)||RESERVED.has(text)||text.startsWith('luo_'))return null;
 return text;
}
export function validatePassword(password,username){
 if(typeof password!=='string')return {ok:false,reason:'Use a password of at least 12 characters.'};
 if(password.length<12||password.length>128||password.length!==[...password].length)return {ok:false,reason:'Use a password of 12–128 characters.'};
 if(/[\u0000-\u001f\u007f]/.test(password))return {ok:false,reason:'Remove control characters from your password.'};
 if(username&&password.toLowerCase().includes(username))return {ok:false,reason:'Do not include your username in your password.'};
 return {ok:true};
}
// Internal Supabase emails are identifiers, NOT addresses to be used for mail.
// Generated after authentication, and never derived from a public username.
// Do not expose this identifier to the browser or API responses.
export function internalEmailForId(id){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||''))throw Error('Invalid account identifier');
 return 'luo-'+id.replaceAll('-','').toLowerCase()+'@accounts.invalid';
}
export function validateRecoveryCodeInput(code){
 return typeof code==='string'&&/^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){4}$/.test(code.toUpperCase());
}
// Recovery codes are generated using CSPRNG on the server; only keyed digests are stored.
export function newRecoveryCodes(cryptoImpl=crypto,count=10){
 if(!Number.isSafeInteger(count)||count<1||count>20)throw Error('Invalid recovery-code count');
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 const result=[];
 for(let i=0;i<count;i++){
  // Rejection sampling prevents modulo bias.
  let raw='';
  while(raw.length<20){const block=new Uint8Array(32);cryptoImpl.getRandomValues(block);for(const byte of block){if(byte>=224)continue;raw+=alphabet[byte%alphabet.length];if(raw.length===20)break}}
  result.push(raw.match(/.{4}/g).join('-'));
 }
 return result;
}
export async function digestRecoveryCode({code,userId,secret,cryptoImpl=crypto}){
 if(!validateRecoveryCodeInput(code))throw Error('Invalid recovery-code format');
 if(typeof secret!=='string'||secret.length<32)throw Error('Server recovery secret missing');
 if(!/^[0-9a-f-]{36}$/i.test(userId||''))throw Error('Invalid user identifier');
 const key=await cryptoImpl.subtle.importKey('raw',new TextEncoder().encode(secret),'HMAC',false,['sign']);
 const signature=await cryptoImpl.subtle.sign('HMAC',key,new TextEncoder().encode('luo-recovery-v1:'+userId+':'+code.toUpperCase()));
 return Array.from(new Uint8Array(signature)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function safeAuthFailure(){
 // The same response for unknown usernames, wrong passwords, and locked users.
 return {ok:false,error:'Invalid username or password.'};
}
export function decideSignupRisk({ipHour=0,ipDay=0,deviceDay=0,usernameHour=0,challengeVerified=false}={}){
 if([ipHour,ipDay,deviceDay,usernameHour].some(x=>!Number.isSafeInteger(x)||x<0))return 'deny';
 if(usernameHour>=5)return 'deny';
 // Device IDs are untrusted: this dimension can only trigger a challenge.
 // Same for IPs shared by households or mobile carrier NAT.
 if(ipHour>=100||ipDay>=300)return 'temporarily-deny';
 if(!challengeVerified)return 'challenge';
 if(ipHour>=12||ipDay>=40||deviceDay>=3)return 'review';
 return 'allow';
}

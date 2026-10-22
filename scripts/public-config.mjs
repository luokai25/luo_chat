// Validate public build inputs before the bundler can write them into browser assets.
// This classifies key types; Supabase still validates key authenticity at runtime.
export function validatePublicConfig({url,key,csp}){
 let parsed;
 try{parsed=new URL(url)}catch{throw Error('LUO_SUPABASE_URL must be an HTTPS origin.')}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||!['','/'].includes(parsed.pathname))throw Error('LUO_SUPABASE_URL must be an HTTPS origin without credentials, paths or query parameters.');
 let publicKey=typeof key==='string'&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
 if(!publicKey&&typeof key==='string'){
  const parts=key.split('.');
  if(parts.length===3)try{publicKey=JSON.parse(Buffer.from(parts[1],'base64url')).role==='anon'}catch{}
 }
 if(!publicKey)throw Error('Browser builds require a Supabase publishable key or legacy anon key. Secret, service-role and user-session keys are forbidden.');
 if(typeof csp!=='string')throw Error('A global Content-Security-Policy is required in vercel.json.');
 const directives=new Map();
 for(const part of csp.split(';')){const [name,...values]=part.trim().split(/\s+/);if(name){if(directives.has(name))throw Error('Duplicate Content-Security-Policy directives are not supported.');directives.set(name,values)}}
 const origin=parsed.origin,socket=origin.replace(/^https:/,'wss:');
 for(const [name,required] of [['connect-src',[origin,socket]],['img-src',[origin]],['media-src',[origin]],['frame-src',[origin]]]){
  if(!required.every(value=>directives.get(name)?.includes(value)))throw Error('Supabase URL and vercel.json security-policy origins do not match. Update both before building.');
 }
 return {origin};
}

import {createHmac,randomBytes} from 'node:crypto';
import {isIP} from 'node:net';

export const TURN_CREDENTIAL_TTL_SECONDS=3600;

export function validTurnURL(value){
 if(typeof value!=='string'||value.length>320)return false;
 const match=value.match(/^(turns?):(\[[0-9a-fA-F:.]+\]|[a-zA-Z0-9.-]+)(?::([0-9]{1,5}))?(?:\?transport=(udp|tcp))?$/);
 if(!match)return false;
 const host=match[2];
 if(host.startsWith('[')){if(isIP(host.slice(1,-1))!==6)return false;}
 else if(!isIP(host)&&!(host.length<=253&&host.split('.').every(label=>/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))))return false;
 if(match[3]&&(Number(match[3])<1||Number(match[3])>65535))return false;
 return true;
}

export function readTurnConfiguration(env){
 const names=['LUO_TURN_URL','LUO_TURN_SHARED_SECRET','LUO_TURN_USER','LUO_TURN_PASSWORD'];
 if(!names.some(name=>env[name]!==undefined&&env[name]!==''))return null;
 // Never fall back to distributing a reusable static password. Explicitly
 // reject mixed old/new configuration so a migration cannot look successful.
 if(env.LUO_TURN_USER||env.LUO_TURN_PASSWORD||!validTurnURL(env.LUO_TURN_URL)||typeof env.LUO_TURN_SHARED_SECRET!=='string'||!/^[A-Za-z0-9+/=_-]{32,512}$/.test(env.LUO_TURN_SHARED_SECRET))throw Error('Relay configuration invalid');
 return{urls:env.LUO_TURN_URL,secret:env.LUO_TURN_SHARED_SECRET};
}

export function issueTurnCredentials(config,{now=Date.now,random=()=>randomBytes(12).toString('hex')}={}){
 const time=now();
 if(!Number.isSafeInteger(time)||time<0)throw Error('Relay clock invalid');
 const expiresAt=Math.floor(time/1000)+TURN_CREDENTIAL_TTL_SECONDS;
 const tag=random();if(typeof tag!=='string'||!/^[a-f0-9]{24}$/.test(tag))throw Error('Relay nonce invalid');
 const username=expiresAt+':'+tag;
 // coturn TURN REST authentication uses HMAC-SHA1 (protocol requirement),
 // not a plain hash or the server's shared secret as the client password.
 const credential=createHmac('sha1',config.secret).update(username).digest('base64');
 return{server:{urls:config.urls,username,credential},expiresAt};
}

import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Immutable authored Blender asset; retrieved during build and served by Luo Chat
// itself afterwards. No third-party model request runs in visitors' browsers.
export const LUO_CORE_ASSET='/luo-core-snow-v2.glb';
export const LUO_CORE_SOURCE='https://d2ol7oe51mr4n9.cloudfront.net/user_39MJeWilQ3obeYoJPRipqwMMpnk/0a44ab32-cd74-4c2b-adbc-cdc3a3058639.glb';
export const LUO_CORE_SHA256='07a81de7df41ba33b25d8428600fc843f74b6ecf203a5ab706750f145917f542';
export async function buildLuoCoreModel(path,fetcher=fetch){
 const response=await fetcher(LUO_CORE_SOURCE,{signal:AbortSignal.timeout(65000)});
 if(!response.ok)throw Error('Luo Core authored GLB download failed with HTTP '+response.status);
 const data=Buffer.from(await response.arrayBuffer());
 const hash=createHash('sha256').update(data).digest('hex');
 if(hash!==LUO_CORE_SHA256)throw Error('Luo Core authored model checksum mismatch');
 if(data.length!==5451280||data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length)
  throw Error('Luo Core GLB is truncated or invalid');
 const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString('utf8'));
 if(json.animations?.length!==35||json.meshes?.length!==56||json.nodes?.length!==80)
  throw Error('Luo Core Blender scene or animation tracks are incomplete');
 await writeFile(path,data);
 return {hash,bytes:data.length,faces:json.meshes.length,clips:json.animations.length};
}

import {readdir,readFile,writeFile} from 'node:fs/promises';
import {inflateSync,deflateSync} from 'node:zlib';
function crc32(bytes){let crc=0xffffffff;for(const value of bytes){crc^=value;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return(crc^0xffffffff)>>>0}
export function compressPNG(input){
 if(input.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return input;
 const chunks=[];let at=8;const data=[];
 while(at<input.length){const size=input.readUInt32BE(at);if(size>input.length-at-12)throw Error('Invalid PNG chunk');const chunk=input.subarray(at,at+size+12),type=chunk.subarray(4,8).toString();chunks.push({type,chunk});if(type==='IDAT')data.push(chunk.subarray(8,-4));at+=size+12;}
 if(!data.length)return input;
 const original=Buffer.concat(data),packed=deflateSync(inflateSync(original),{level:9});
 if(packed.length>=original.length)return input;
 const chunk=Buffer.alloc(packed.length+12);chunk.writeUInt32BE(packed.length);chunk.write('IDAT',4);packed.copy(chunk,8);chunk.writeUInt32BE(crc32(chunk.subarray(4,-4)),chunk.length-4);
 let inserted=false;const result=[input.subarray(0,8)];for(const part of chunks){if(part.type==='IDAT'){if(!inserted){result.push(chunk);inserted=true}}else result.push(part.chunk)}
 const output=Buffer.concat(result);return output.length<input.length?output:input;
}
export async function optimizePNGs(dir){let before=0,after=0,count=0;for(const file of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+file.name;if(file.isDirectory()){const child=await optimizePNGs(path);before+=child.before;after+=child.after;count+=child.count}else if(file.name.endsWith('.png')){const input=await readFile(path),output=compressPNG(input);before+=input.length;after+=output.length;count++;if(output!==input)await writeFile(path,output)}}return{before,after,count}}

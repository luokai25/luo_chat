import {mkdtemp,cp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),fresh=await mkdtemp(join(tmpdir(),'luo-clean-build-'));
const npm=process.platform==='win32'?'npm.cmd':'npm';
async function hashes(folder){const result={};async function visit(path){for(const item of await readdir(path,{withFileTypes:true})){const p=join(path,item.name);if(item.isDirectory())await visit(p);else if(item.isFile())result[relative(folder,p)]=createHash('sha256').update(await readFile(p)).digest('hex')}}await visit(folder);return result}
const run=(args,cwd)=>{const result=spawnSync(npm,args,{cwd,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('Clean build command failed: npm '+args.join(' '))};
try{
 // Copy only reviewed build inputs. Never copy local credentials, modules or generated output.
 for(const path of ['package.json','package-lock.json','build.mjs','vercel.json','src','public','scripts','tests','api','integrations','supabase/functions'])await cp(join(root,path),join(fresh,path),{recursive:true});
 run(['run','release:check'],root);
 const expected=await hashes(join(root,'dist'));
 run(['ci','--ignore-scripts','--no-audit','--no-fund'],fresh);
 run(['run','release:check'],fresh);
 const actual=await hashes(join(fresh,'dist'));
 const paths=[...new Set([...Object.keys(expected),...Object.keys(actual)])].sort();
 if(paths.some(path=>expected[path]!==actual[path]))throw Error('Clean build output differs from the working build.');
 console.log('PASS: '+paths.length+' production files match byte-for-byte after a clean lockfile install. This does not verify a fresh database restore.');
}finally{await rm(fresh,{recursive:true,force:true})}

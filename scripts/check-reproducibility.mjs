import {mkdtemp,cp,readFile,readdir,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),snapshot=await mkdtemp(join(tmpdir(),'luo-build-inputs-')),fresh=await mkdtemp(join(tmpdir(),'luo-clean-build-a-')),second=await mkdtemp(join(tmpdir(),'luo-clean-build-b-'));
const npm=process.platform==='win32'?'npm.cmd':'npm';
async function hashes(folder){const result={};async function visit(path){for(const item of await readdir(path,{withFileTypes:true})){const p=join(path,item.name);if(item.isDirectory())await visit(p);else if(item.isFile())result[relative(folder,p)]=createHash('sha256').update(await readFile(p)).digest('hex')}}await visit(folder);return result}
const run=(args,cwd)=>{const result=spawnSync(npm,args,{cwd,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('Clean build command failed: npm '+args.join(' '))};
try{
 // Freeze one allowlisted snapshot before making two independent install/build workspaces.
 // Never copy credentials, modules or generated output, or separately reread moving inputs.
 const inputs=['package.json','package-lock.json','build.mjs','vercel.json','src','public','scripts','tests','api','integrations','supabase/functions','supabase/proposals','supabase/migrations'];
 for(const path of inputs)await cp(join(root,path),join(snapshot,path),{recursive:true});
 for(const folder of [fresh,second])for(const path of inputs)await cp(join(snapshot,path),join(folder,path),{recursive:true});
 run(['ci','--ignore-scripts','--no-audit','--no-fund'],fresh);
 run(['run','release:check'],fresh);
 const expected=await hashes(join(fresh,'dist'));
 run(['ci','--ignore-scripts','--no-audit','--no-fund'],second);
 run(['run','release:check'],second);
 const actual=await hashes(join(second,'dist'));
 const paths=[...new Set([...Object.keys(expected),...Object.keys(actual)])].sort();
 const mismatches=paths.filter(path=>expected[path]!==actual[path]);
 if(mismatches.length){
  const diagnostics=join(root,'test-results','reproducibility');await mkdir(diagnostics,{recursive:true});
  await writeFile(join(diagnostics,'mismatches.json'),JSON.stringify(mismatches.map(path=>({path,first:expected[path]||null,second:actual[path]||null})),null,2));
  for(const path of ['index.html','sw.js'])if(mismatches.includes(path)){await cp(join(fresh,'dist',path),join(diagnostics,'first-'+path));await cp(join(second,'dist',path),join(diagnostics,'second-'+path));}
  throw Error('Clean builds differ: '+mismatches.join(', ')+'. Static diagnostic files retained under test-results/reproducibility.');
 }
 console.log('PASS: '+paths.length+' production files match byte-for-byte across two isolated clean lockfile installs. This does not verify a fresh database restore.');
}finally{await rm(fresh,{recursive:true,force:true});await rm(second,{recursive:true,force:true});await rm(snapshot,{recursive:true,force:true})}

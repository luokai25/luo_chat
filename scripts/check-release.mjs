import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
if(pkg.version!==lock.version||pkg.version!==lock.packages?.['']?.version)throw Error('Package and lockfile versions disagree.');
if(Number(process.versions.node.split('.')[0])!==24)throw Error('Use Node 24 for the supported release build.');
const npm=process.platform==='win32'?'npm.cmd':'npm';
for(const command of ['test','build']){
 const result=spawnSync(npm,['run',command],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
console.log('PASS: release checks completed. Database restore, hosted auth and device gates are tracked separately.');

import {spawnSync} from 'node:child_process';
// Only report object IDs and paths, never matching credential values. This is
// heuristic scanning of locally reachable history, not provider revocation.
const git=(args,input)=>{const r=spawnSync('git',args,{input,maxBuffer:128*1024*1024});if(r.status!==0)throw Error('Git history unavailable');return r.stdout};
const lines=git(['rev-list','--objects','--all']).toString().trim().split('\n');
const entries=lines.map(line=>{const [id,...rest]=line.split(' ');return{id,path:rest.join(' ')}}).filter(e=>e.path&&!/\.(?:png|jpe?g|gif|webp|zip|woff2?|mp4|webm|pdf)$/i.test(e.path));
const types=git(['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],entries.map(e=>e.id).join('\n')+'\n').toString().trim().split('\n');
const blobs=entries.filter((e,i)=>{const [,type,size]=types[i].split(' ');return type==='blob'&&Number(size)<=4*1024*1024});
const payload=git(['cat-file','--batch'],blobs.map(e=>e.id).join('\n')+'\n');let at=0;const findings=[];
for(const entry of blobs){const end=payload.indexOf(10,at),head=payload.subarray(at,end).toString().split(' '),size=Number(head[2]);if(!Number.isFinite(size))throw Error('Invalid git object response');const body=payload.subarray(end+1,end+1+size).toString('utf8');at=end+size+2;
 const labels=[];
 if(/(?:^|\/)\.env(?:$|\.(?!example$|sample$)[^/]+$)/.test(entry.path))labels.push('environment file');
 const patterns=[['private key',new RegExp('-----BEGIN (?:RSA |EC |OPENSSH )?'+'PRIVATE KEY-----')],['GitHub token',/\bgh[pousr]_[A-Za-z0-9]{32,}\b/],['Supabase secret',/\bsb_secret_[A-Za-z0-9_-]{24,}\b/],['AWS access key',/\bAKIA[0-9A-Z]{16}\b/],['Stripe live secret',/\bsk_live_[A-Za-z0-9]{20,}\b/]];
 for(const [label,pattern] of patterns)if(pattern.test(body))labels.push(label);
 for(const match of body.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){try{if(JSON.parse(Buffer.from(match[1],'base64url')).role==='service_role')labels.push('privileged JWT')}catch{}}
 if(labels.length)findings.push({object:entry.id,path:entry.path,classes:[...new Set(labels)]});
}
console.log(JSON.stringify({scope:'locally reachable git history',blobsScanned:blobs.length,findings},null,2));if(findings.length)process.exitCode=1;

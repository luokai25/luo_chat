import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
export async function buildWorkspaceWorker(output){
 const base='workspace';let code=await readFile(base+'/cloudflare-worker-template.js','utf8');
 for(const [marker,file] of [['__HTML__','index.html'],['__CSS__','style.css'],['__APP__','app.js'],['__INSIGHTS__','insights.js']]){const body=await readFile(base+'/'+file,'utf8');code=code.replace("="+marker+";",()=>"="+JSON.stringify(body)+";");}
 const assets={};
 for(const file of ['revenue-live.js','product-intelligence.js','operations.js'])assets['/'+file]={body:await readFile(base+'/'+file,'utf8'),type:'application/javascript; charset=utf-8',public:false};
 const types={html:'text/html',css:'text/css',js:'application/javascript',xml:'application/xml',txt:'text/plain',json:'application/json'};
 for(const file of await readdir(base+'/launch')){
  const ext=file.split('.').pop();if(!types[ext])continue;
  const path=file==='home.html'?'/launch/':file==='agents.html'?'/launch/agents':file==='humans.html'?'/launch/humans':'/launch/'+file;
  assets[path]={body:await readFile(base+'/launch/'+file,'utf8'),type:types[ext]+'; charset=utf-8',public:true};
 }
 code=code.replace('__EXTRA_ASSETS__',()=>JSON.stringify(assets));
 if(output)await writeFile(output,code);return code;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const path=process.argv[2]||'/tmp/luo-workspace-worker.js';await buildWorkspaceWorker(path);console.log('Workspace worker built:',path);}

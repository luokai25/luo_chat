// Serve only the built public files. Supabase is intercepted by the browser
// fixture; these checks never authenticate to or mutate the hosted backend.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);return res.end();}
 if(file===root)file=path.join(root,'index.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);});
});
server.listen(0,'127.0.0.1',()=>{
 const origin='http://127.0.0.1:'+server.address().port;
 const child=spawn(process.execPath,[path.join(__dirname,'browser-navigation.cjs')],{stdio:'inherit',env:{...process.env,LUO_TEST_BASE_URL:origin,LUO_TEST_ENTRY_URL:origin}});
 child.on('error',()=>{process.exitCode=1;server.close();});
 child.on('exit',code=>{process.exitCode=code===0?0:1;server.close();});
});

import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MARKETING_ORIGIN} from './marketing-content.mjs';

// IndexNow is used by participating search engines, NOT Google.
// This submission intentionally runs only when requested after deployment.
export const INDEXNOW_KEY = '279d4d6fc52026d0aa00da586a05e13c';
const SITE_HOST=new URL(MARKETING_ORIGIN).hostname;
export function publishedUrls(sitemap){
 const urls=[...String(sitemap).matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/g)].map(m=>m[1]);
 return [...new Set(urls)].filter(u=>{
  try{const x=new URL(u);return x.protocol==='https:'&&x.hostname===SITE_HOST&&
   !/^\/api\//.test(x.pathname)&&!x.search&&!x.hash;}
  catch{return false}
 }).slice(0,1000);
}
export function indexNowPayload(urlList){
 if(!Array.isArray(urlList)||!urlList.length||urlList.length>1000)throw Error('Valid public URL list required');
 const safe=publishedUrls(urlList.map(x=>'<loc>'+x+'</loc>').join(''));
 if(safe.length!==urlList.length)throw Error('Only trusted public Luo Chat URLs may be submitted');
 return {host:SITE_HOST,key:INDEXNOW_KEY,keyLocation:MARKETING_ORIGIN+'/'+INDEXNOW_KEY+'.txt',urlList:safe};
}
export async function submitIndexNow({dryRun=false,sitemapPath=resolve('public/sitemap.xml'),fetchImpl=fetch}={}){
 const keyText=(await readFile(resolve('public/'+INDEXNOW_KEY+'.txt'),'utf8')).trim();
 if(keyText!==INDEXNOW_KEY)throw Error('Missing or mismatched hosted IndexNow verification file');
 const urls=publishedUrls(await readFile(sitemapPath,'utf8'));
 const payload=indexNowPayload(urls);
 if(dryRun)return {status:'dry-run',url_count:urls.length,urls};
 const response=await fetchImpl('https://api.indexnow.org/indexnow',{
  method:'POST',headers:{'content-type':'application/json; charset=utf-8'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
 });
 if(![200,202].includes(response.status))throw Error('IndexNow returned HTTP '+response.status);
 return {status:response.status===200?'accepted':'received-pending-key-validation',url_count:urls.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 submitIndexNow({dryRun:process.argv.includes('--dry-run')}).then(x=>{
  console.log(JSON.stringify(x,null,2));
 }).catch(e=>{console.error('IndexNow submission not confirmed: '+e.message);process.exitCode=1});
}

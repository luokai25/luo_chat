import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MARKETING_ORIGIN,MARKETING,MARKETING_LOCALES} from './marketing-content.mjs';
import {PRODUCT_GUIDES} from './marketing-product-guides.mjs';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PRODUCT_GUIDE_PATHS=Object.keys(PRODUCT_GUIDES).map(key=>'/en/'+key+'/');
const links=()=>PRODUCT_GUIDE_PATHS.map((path,i)=>'<a href="'+path+'">'+esc(Object.keys(PRODUCT_GUIDES)[i].replace(/^./,c=>c.toUpperCase()))+'</a>').join(' · ');
export function renderProductGuide(key){
 const d=PRODUCT_GUIDES[key];if(!d)throw Error('Unrecognized guide');
 const uri=MARKETING_ORIGIN+'/en/'+key+'/';
 const topics=d.topics.map(([title,copy])=>'<article class="card"><h3>'+esc(title)+'</h3><p>'+esc(copy)+'</p></article>').join('');
 const faq=d.faq.map(([q,a])=>'<article><h3>'+esc(q)+'</h3><p>'+esc(a)+'</p></article>').join('');
 const how=d.how.map(x=>'<li>'+esc(x)+'</li>').join('');
 const schema=JSON.stringify({'@context':'https://schema.org','@graph':[
  {'@type':'WebPage',url:uri,name:d.title,description:d.description,inLanguage:'en',isPartOf:{'@id':MARKETING_ORIGIN+'/#website'}},
  {'@type':'SoftwareApplication',name:'Luo Chat',applicationCategory:'CommunicationApplication',operatingSystem:'Web',url:MARKETING_ORIGIN+'/'}
 ]}).replace(/</g,'\\u003c');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="theme-color" content="#0a090c"><meta name="robots" content="index,follow,max-image-preview:large"><title>'+esc(d.title)+'</title>'+
  '<meta name="description" content="'+esc(d.description)+'"><link rel="canonical" href="'+uri+'"><link rel="alternate" hreflang="en" href="'+uri+'">'+
  '<meta property="og:type" content="website"><meta property="og:site_name" content="Luo Chat"><meta property="og:title" content="'+esc(d.title)+'">'+
  '<meta property="og:description" content="'+esc(d.description)+'"><meta property="og:url" content="'+uri+'">'+
  '<meta property="og:image" content="'+MARKETING_ORIGIN+'/icon-512.png"><meta property="og:image:width" content="512"><meta property="og:image:height" content="512">'+
  '<meta name="twitter:card" content="summary"><meta name="twitter:title" content="'+esc(d.title)+'">'+
  '<link rel="stylesheet" href="/luo-marketing.css"><script type="application/ld+json">'+schema+'</script></head><body>'+
  '<header><div class="wrap nav"><a class="logo" href="/en/">Luo Chat ✦</a><nav class="navlinks" aria-label="Explore Luo Chat">'+links()+
  '<a href="/en/agents/">AI agents</a><a href="/">Open app</a></nav></div></header>'+
  '<main class="wrap"><section class="hero"><p class="eyebrow">'+esc(d.eyebrow)+'</p><h1>'+esc(d.heading)+'</h1><p class="lead">'+esc(d.lead)+'</p>'+
  '<div class="actions"><a class="primary" href="/">Open Luo Chat</a><a href="/en/">Back to overview</a></div></section>'+
  '<section><h2>What this part of Luo Chat does</h2><div class="cards">'+topics+'</div></section>'+
  '<section><h2>How to get started</h2><ol class="prose how">'+how+'</ol></section>'+
  '<section><h2>Questions people ask</h2><div class="faq">'+faq+'</div></section>'+
  '<aside class="note">'+esc(d.foot)+'</aside><p class="prose">Interested in responsible AI integrations? <a href="/en/agents/">Read the current agent developer guide</a>. Automated paid membership is not yet activated.</p></main>'+
  '<footer class="wrap end"><div class="endlinks"><a href="/en/">Luo Chat overview</a>'+links()+'<a href="/privacy.html">Privacy policy</a><a href="/contact.html">Contact</a></div>'+
  '<p>© Luo Chat · Luo’s Creations</p></footer></body></html>';
}
export async function generateProductPages(root=resolve('public')){
 for(const key of Object.keys(PRODUCT_GUIDES)){
  const path=join(root,'en',key);await mkdir(path,{recursive:true});
  await writeFile(join(path,'index.html'),renderProductGuide(key));
 }
 const site=join(root,'sitemap.xml');
 const current=await readFile(site,'utf8');
 const clean=current.replace(/\s*<url><loc>https:\/\/luo-chat-luokai25\.vercel\.app\/en\/(?:chats|luonix|worlds)\/<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?<\/url>/g,'');
 const extra=PRODUCT_GUIDE_PATHS.map(path=>'  <url><loc>'+MARKETING_ORIGIN+path+'</loc><lastmod>2026-10-26</lastmod></url>').join('\n');
 if(!clean.includes('</urlset>'))throw Error('sitemap URL set missing');
 await writeFile(site,clean.replace('</urlset>',extra+'\n</urlset>'));
 const llmsFile=join(root,'llms.txt');
 const llms=(await readFile(llmsFile,'utf8')).replace(/\n## Product guides \(English\)[\s\S]*$/,'');
 await writeFile(llmsFile,llms.trimEnd()+'\n\n## Product guides (English)\n'+Object.keys(PRODUCT_GUIDES).map(key=>'- '+key+': '+MARKETING_ORIGIN+'/en/'+key+'/').join('\n')+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await generateProductPages();
 console.log('Generated Luo Chat deep feature guides: Chats, Luonix, Worlds');
}

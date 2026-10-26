import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MARKETING_ORIGIN,MARKETING_LOCALES,MARKETING} from './marketing-content.mjs';

// Static, crawlable multilingual pages with NO location-based redirects.
// English legal documents remain the authoritative linked reference.
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=(locale,type)=>'/'+locale+'/'+(type==='agents'?'agents/':'');
const hreflang=type=>MARKETING_LOCALES.map(l=>'<link rel="alternate" hreflang="'+l+'" href="'+MARKETING_ORIGIN+route(l,type)+'">').join('')+
 '<link rel="alternate" hreflang="x-default" href="'+MARKETING_ORIGIN+route('en',type)+'">';
const localeMap={en:'en_US',ar:'ar_EG',de:'de_DE',fr:'fr_FR',es:'es_ES'};
function schema(locale,type,t,canonical){
 return {'@context':'https://schema.org','@graph':[
  {'@type':'WebSite','@id':MARKETING_ORIGIN+'/#website','name':'Luo Chat','url':MARKETING_ORIGIN+'/'},
  {'@type':'WebPage','@id':canonical+'#webpage','url':canonical,'name':type==='agents'?t.agentTitle:t.heading,'description':type==='agents'?t.agentMeta:t.description,'inLanguage':locale,'isPartOf':{'@id':MARKETING_ORIGIN+'/#website'}},
  {'@type':'SoftwareApplication','name':'Luo Chat','applicationCategory':'CommunicationApplication','operatingSystem':'Web','url':MARKETING_ORIGIN+'/','description':t.description}
 ]};
}
export function renderMarketingPage(locale,type='home'){
 if(!MARKETING_LOCALES.includes(locale)||!['home','agents'].includes(type))throw Error('Invalid marketing locale/page');
 const t=MARKETING[locale],isAgents=type==='agents',canonical=MARKETING_ORIGIN+route(locale,type);
 const title=isAgents?t.agentTitle+' | Luo Chat':t.title,description=isAgents?t.agentMeta:t.description;
 const pageLinks=MARKETING_LOCALES.map(l=>'<a href="'+route(l,type)+'" lang="'+l+'" '+(l===locale?'aria-current="page"':'')+'>'+esc(MARKETING[l].language)+'</a>').join('');
 const links='<nav class="navlinks" aria-label="Main navigation"><a href="'+route(locale,'home')+'#features">'+esc(t.nav[0])+'</a><a href="'+route(locale,'agents')+'">'+esc(t.nav[1])+'</a><a href="/privacy" hreflang="en">'+esc(t.nav[2])+'</a><a href="/">'+esc(t.nav[3])+'</a></nav>';
 const header='<header><div class="wrap nav"><a class="logo" href="'+route(locale,'home')+'">Luo Chat ✦</a>'+links+'</div><div class="wrap"><nav class="lang" aria-label="Choose language">'+pageLinks+'</nav></div></header>';
 let body;
 if(!isAgents){
  const featureLinkLabel={en:'Read the detailed guide',ar:'اقرأ الدليل المفصل (بالإنجليزية)',de:'Ausführlicher Leitfaden (Englisch)',fr:'Guide détaillé (en anglais)',es:'Guía detallada (en inglés)'};
  const features=t.features.map(([name,copy],i)=>'<article class="card"><h3>'+esc(name)+'</h3><p>'+esc(copy)+'</p><p class="feature-detail"><a href="/en/'+['chats','luonix','worlds'][i]+'/" hreflang="en">'+esc(featureLinkLabel[locale])+'</a></p></article>').join('');
  const questions=t.faqs.map(([q,a])=>'<article><h3>'+esc(q)+'</h3><p>'+esc(a)+'</p></article>').join('');
  body='<section class="hero"><p class="eyebrow">'+esc(t.eyebrow)+'</p><h1>'+esc(t.heading)+'</h1><p class="lead">'+esc(t.lead)+'</p><div class="actions"><a class="primary" href="/">'+esc(t.actions[0])+'</a><a href="'+route(locale,'agents')+'">'+esc(t.actions[1])+'</a></div></section>'+
   '<section id="features"><h2>'+esc(t.featureHeading)+'</h2><div class="cards">'+features+'</div></section>'+
   '<section id="privacy"><h2>'+esc(t.privacyHeading)+'</h2><p class="prose">'+esc(t.privacy)+'</p></section>'+
   '<section id="agents"><h2>'+esc(t.agentsHeading)+'</h2><p class="prose">'+esc(t.agents)+'</p><a class="btn" href="'+route(locale,'agents')+'">'+esc(t.actions[1])+'</a></section>'+
   '<section id="questions"><h2>'+esc(t.faqHeading)+'</h2><div class="faq">'+questions+'</div></section>';
 } else {
  const features=t.agentSections.map(([name,copy])=>'<article class="card"><h3>'+esc(name)+'</h3><p>'+esc(copy)+'</p></article>').join('');
  const api=['/agents','/api/v1/platform','/api/v1/plans','/openapi.json','/llms.txt'].map(p=>'<li><a href="'+p+'"><code>'+esc(MARKETING_ORIGIN+p)+'</code></a></li>').join('');
  body='<section class="hero"><p class="eyebrow">LUO CHAT / AI AGENTS</p><h1>'+esc(t.agentTitle)+'</h1><p class="lead">'+esc(t.agentLead)+'</p><div class="note" role="status">'+esc(t.agentStatus)+'</div><div class="actions"><a class="primary" href="/agents">'+esc(t.actions[1])+' · English API</a><a href="'+route(locale,'home')+'">'+esc(t.actions[0])+'</a></div></section>'+
   '<section><h2>'+esc(t.featureHeading)+'</h2><div class="cards">'+features+'</div></section>'+
   '<section><h2>'+esc(t.technicalHeading)+'</h2><p class="prose">'+esc(t.agentHelp)+'</p><ul class="links">'+api+'</ul></section>';
 }
 const preferredLabels={en:'Add Luo Chat as a preferred source on Google',ar:'أضف Luo Chat إلى مصادرك المفضلة على Google',de:'Luo Chat als bevorzugte Quelle auf Google hinzufügen',fr:'Ajouter Luo Chat comme source préférée sur Google',es:'Añadir Luo Chat como fuente preferida en Google'};
 const preferredNote={en:'Google decides which sites are eligible. This is a selection link, not a Google certification.',ar:'تحدد Google المواقع المؤهلة. هذا رابط للاختيار وليس شهادة اعتماد من Google.',de:'Google entscheidet über die Verfügbarkeit. Dies ist ein Auswahl-Link, keine Google-Zertifizierung.',fr:'Google détermine l’éligibilité. Ceci est un lien de sélection, pas une certification Google.',es:'Google decide qué sitios cumplen los requisitos. Es un enlace de selección, no una certificación de Google.'};
 const sourceAction='<aside class="wrap luo-preferred-wrap" aria-label="Google Preferred Sources"><a class="luo-preferred-source-badge" href="https://www.google.com/preferences/source?q=luo-chat-luokai25.vercel.app" target="_blank" rel="noopener noreferrer nofollow" aria-label="'+esc(preferredLabels[locale])+'"><span aria-hidden="true">☆</span><span>'+esc(preferredLabels[locale])+'</span></a><small>'+esc(preferredNote[locale])+'</small></aside>';
 const json=JSON.stringify(schema(locale,type,t,canonical)).replace(/</g,'\\u003c');
 return '<!doctype html><html lang="'+locale+'"'+(locale==='ar'?' dir="rtl"':'')+'><head>'+
  '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0a090c">'+
  '<meta name="robots" content="index,follow,max-image-preview:large"><title>'+esc(title)+'</title>'+
  '<meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+canonical+'">'+hreflang(type)+
  '<meta property="og:type" content="website"><meta property="og:site_name" content="Luo Chat">'+
  '<meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'">'+
  '<meta property="og:url" content="'+canonical+'"><meta property="og:locale" content="'+localeMap[locale]+'">'+
  '<meta property="og:image" content="'+MARKETING_ORIGIN+'/icon-512.png"><meta property="og:image:width" content="512"><meta property="og:image:height" content="512">'+
  '<meta name="twitter:card" content="summary"><meta name="twitter:title" content="'+esc(title)+'">'+
  '<link rel="stylesheet" href="/luo-marketing.css"><script type="application/ld+json">'+json+'</script></head><body>'+
  header+sourceAction+'<main class="wrap">'+body+'<aside class="note">'+esc(t.note)+'</aside></main>'+
  '<footer class="wrap end"><div class="endlinks"><a href="/about">About Luo Chat</a><a href="/privacy.html">Privacy (English)</a><a href="/help">Help</a><a href="/agents">Technical API guide (English)</a></div><p>© Luo Chat · Luo’s Creations</p></footer></body></html>';
}
export function marketingSitemap(){
 const pages=['/','/about','/privacy','/contact','/help','/connection','/agents'];
 for(const locale of MARKETING_LOCALES)for(const type of ['home','agents'])pages.push(route(locale,type));
 function alternate(path){
  const match=/^\/(en|ar|de|fr|es)\/(agents\/)?$/.exec(path);
  if(!match)return '';
  const type=match[2]?'agents':'home';
  return MARKETING_LOCALES.map(locale=>'<xhtml:link rel="alternate" hreflang="'+locale+'" href="'+MARKETING_ORIGIN+route(locale,type)+'"/>').join('')+
  '<xhtml:link rel="alternate" hreflang="x-default" href="'+MARKETING_ORIGIN+route('en',type)+'"/>';
 }
 return '<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'+
  pages.map(path=>'  <url><loc>'+MARKETING_ORIGIN+path+'</loc>'+alternate(path)+'</url>').join('\n')+'\n</urlset>\n';
}
export async function generateLocalizedMarketing(root=resolve('public')){
 for(const locale of MARKETING_LOCALES){
  const dir=join(root,locale);await mkdir(join(dir,'agents'),{recursive:true});
  await writeFile(join(dir,'index.html'),renderMarketingPage(locale));
  await writeFile(join(dir,'agents','index.html'),renderMarketingPage(locale,'agents'));
 }
 await writeFile(join(root,'sitemap.xml'),marketingSitemap());
 const directory=join(root,'.well-known');await mkdir(directory,{recursive:true});
 await writeFile(join(directory,'luo-agent-discovery.json'),JSON.stringify({
  name:'Luo Chat',site_url:MARKETING_ORIGIN+'/',agent_onboarding:'closed',
  capabilities:{public_discovery:true,paid_registration:false,private_messaging:'requires separately approved membership'},
  documentation:MARKETING_ORIGIN+'/agents',openapi:MARKETING_ORIGIN+'/openapi.json',
  platform_status:MARKETING_ORIGIN+'/api/v1/platform',plan_status:MARKETING_ORIGIN+'/api/v1/plans',
  llms:MARKETING_ORIGIN+'/llms.txt',locale_guides:Object.fromEntries(MARKETING_LOCALES.map(l=>[l,MARKETING_ORIGIN+route(l,'agents')])),
  warning:'Public documentation is not permission to create agent accounts, charge users, impersonate people, or read private messages.'
 },null,2)+'\n');
 const llms=await readFile(join(root,'llms.txt'),'utf8');
 const head=llms.replace(/\n## Localized public guides[\s\S]*$/,'');
 await writeFile(join(root,'llms.txt'),head.trimEnd()+'\n\n## Localized public guides\n'+MARKETING_LOCALES.map(l=>'- '+MARKETING[l].language+': '+MARKETING_ORIGIN+route(l,'home')+' (agent guide: '+MARKETING_ORIGIN+route(l,'agents')+')').join('\n')+'\n- Agent discovery status: '+MARKETING_ORIGIN+'/.well-known/luo-agent-discovery.json\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await generateLocalizedMarketing();
 console.log('Localized marketing, agent discovery and sitemap generated: '+MARKETING_LOCALES.join(', '));
}

import {readFile,writeFile,readdir} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
import {policies} from './site-content.mjs';
import {publicPlans} from '../src/server/agent-platform.js';
export const SITE='https://luo-chat-luokai25.vercel.app';
export const UPDATED='2026-10-25';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const links=[['/about','About'],['/agents','AI agents'],['/help','Help'],['/privacy','Privacy'],['/terms','Terms'],['/cookies','Cookies'],['/refunds','Refunds'],['/eula','EULA'],['/copyright','Copyright'],['/contact','Contact']];
const nav=()=>links.map(([url,label])=>`<a href="${url}">${label}</a>`).join('');
const descriptions={agents:'Learn about Luo Chat’s transparent AI agent memberships, future subscriptions, public APIs and developer integration status.',index:'Luo Chat connects your people through direct and group messages, shared media and account-controlled social features.',about:'Meet Luo Chat, an independent messaging app by Luo’s Creations, and learn about the service and its limitations.',help:'Get help with Luo Chat sign-in, password recovery, installation, permissions and device storage.',contact:'Contact Luo Chat support for account help, privacy requests and security concerns.',connection:'Check Luo Chat public file availability and browser support without accessing your private conversations.'};
export async function enhanceSite(dir='dist'){
 const css=`:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#070709;color:#f4eee2;font:16px/1.65 system-ui,sans-serif}header,footer{padding:20px;border-block:1px solid #403524}main{max-width:850px;margin:auto;padding:24px 20px 70px}h1{font-size:clamp(28px,6vw,42px);line-height:1.2}h2{font-size:21px;color:#edcc87;margin-top:32px}a{color:#edcc87;overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:12px}.brand{font-size:22px;font-weight:800}p{overflow-wrap:anywhere}a:focus-visible,button:focus-visible{outline:3px solid #edcc87;outline-offset:4px}footer{font-size:14px}button{min-height:44px}`;
 await writeFile(`${dir}/luo-public.css`,css);
 for(const [slug,page] of Object.entries(policies))await writeFile(`${dir}/${slug}.html`,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} | Luo Chat</title><link rel="stylesheet" href="/luo-public.css"></head><body><header><a class="brand" href="/">Luo Chat</a><nav aria-label="Public information">${nav()}</nav></header><main><h1>${esc(page.title)}</h1><p>Last updated: ${UPDATED}. Prepared for operator review before release.</p>${page.sections.map(([heading,text])=>`<section><h2>${esc(heading)}</h2><p>${esc(text)}</p></section>`).join('')}</main><footer><a href="/">Return to Luo Chat</a></footer></body></html>`);
 const agentPlans=publicPlans();
 const planText=agentPlans.map(p=>`<section><h2>${esc(p.name)} Agent</h2><p>Regular price: ${p.monthly_price} USD per month. Ten-day launch offer: ${p.id==='starter'?3:p.id==='pro'?6:9} for the first invoice for qualifying new subscribers, then ${p.renewal_monthly_price} per month, unless canceled. Checkout is currently unavailable until payment processor approval.</p><p>Illustrative daily API requests: ${p.limits.api_per_day.toLocaleString('en-US')}; API burst allowance: ${p.limits.api_per_minute} per minute. These limits can change before launch.</p><p>Capabilities planned: ${esc(p.features.join(', '))}.</p></section>`).join('');
 await writeFile(`${dir}/agents.html`,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI agents and memberships | Luo Chat</title><link rel="stylesheet" href="/luo-public.css"></head><body><header><a class="brand" href="/">Luo Chat</a><nav aria-label="Public information">${nav()}</nav></header><main><h1>AI agents on Luo Chat</h1><p>Luo Chat is developing one social and communication ecosystem for humans and clearly identified AI agents. Human accounts remain free. The product minimum age is 12, with verified guardian approval required before ages 12–17 can register.</p><p><strong>Agent registration, subscriptions, payments, messaging APIs and paid features are not active yet.</strong> Regular monthly prices and introductory first-invoice discounts are approved. Live checkout is not available yet. Paying for a future plan will confirm billing, not model origin, safety or endorsement.</p><h2>Membership plans</h2>${planText}<h2>Agent APIs and MCP</h2><p>Machine-readable public discovery is available at <a href="/api/v1/platform">/api/v1/platform</a> and <a href="/api/v1/plans">/api/v1/plans</a>. A read-only development MCP prototype at /api/mcp advertises platform and plan information only. No write, registration or payment tools are enabled.</p><h2>Identity and privacy</h2><p>AI accounts will have an unmistakable AI Agent label, one identity per paid subscription, revocable scoped credentials, quota controls, consent-gated contact and moderation. An agent cannot claim to be a human or use a paid tier to bypass another account’s permissions. Human-to-agent contact must respect age and safety settings.</p><h2>Payment status</h2><p>Three inactive Stripe monthly catalog products have been created; Stripe cannot yet collect payments and PayPal subscription credentials are not provisioned. Only verified paid invoices can activate agents. Payment activation will require verified payment-provider evidence, not an app redirect.</p><h2>Getting help</h2><p>Contact creationslous@gmail.com about operator and integration questions. Never send API secrets or passwords.</p></main><footer><a href="/">Return to Luo Chat</a></footer></body></html>`);
 // Dedicated share card: original icon artwork remains unchanged.
 const icon=await readFile(`${dir}/icon.svg`,'utf8');
 const art=icon.replace(/<svg\b[^>]*>/,match=>match.replace(/\s(?:width|height|x|y)="[^"]*"/g,'').replace('>', ' x="56" y="110" width="400" height="400">'));
 const card=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#070709"/><rect x="20" y="20" width="1160" height="590" rx="32" fill="none" stroke="#cba34f" stroke-width="2"/>${art}<text x="500" y="290" fill="#edcc87" font-family="Georgia,serif" font-size="78" font-weight="bold">Luo Chat</text><text x="505" y="355" fill="#f4eee2" font-family="sans-serif" font-size="28">Stay a little closer.</text></svg>`;
 await writeFile(`${dir}/og-image.png`,new Resvg(card).render().asPng());
 const pages=(await readdir(dir)).filter(n=>n.endsWith('.html')).sort();
 for(const file of pages){
  const slug=file.slice(0,-5),path=slug==='index'?'/':'/'+slug;
  let html=await readFile(`${dir}/${file}`,'utf8');
  const title=html.match(/<title>([^<]+)<\/title>/i)?.[1]||'Luo Chat';
  const description=policies[slug]?.description||descriptions[slug]||'Official Luo Chat information and support.';
  html=html.replace(/<meta\b[^>]*name=["'](?:robots|description)["'][^>]*>/gi,'').replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi,'');
  html=html.replace(/href="\/(about|agents|privacy|help|contact|connection|terms|cookies|refunds|eula|copyright)\.html(?=["#?])/g,'href="/$1');
  const meta=`<meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${SITE+path}"><meta property="og:type" content="website"><meta property="og:site_name" content="Luo Chat"><meta property="og:title" content="${title}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${SITE+path}"><meta property="og:image" content="${SITE}/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Luo Chat gold lettering and app artwork on black"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${SITE}/og-image.png"><link rel="stylesheet" href="/cookie-consent.css"><script src="/cookie-consent.js" defer></script>`;
  html=html.replace('</head>',meta+'</head>');
  html=html.replace(/<img\b[^>]*>/g,tag=>{
   const size=tag.includes('id="myAvatar"')?96:tag.includes('id="avatarFull"')?512:tag.includes('/icon-192.png')?192:null;
   if(!size)return tag;
   return tag.replace(/>$/,`${/\bwidth=/.test(tag)?'':` width="${size}"`}${/\bheight=/.test(tag)?'':` height="${size}"`} decoding="async">`);
  });
  const info=`<div class="luo-policy-links"><nav aria-label="Policies and support">${nav()}</nav></div>`;
  html=html.replace('</body>',info+'</body>');
  // Microdata avoids adding executable inline scripts to the strict CSP.
  html=html.replace('<main>','<main itemscope itemtype="https://schema.org/WebPage"><meta itemprop="name" content="'+title+'"><link itemprop="url" href="'+SITE+path+'">');
  await writeFile(`${dir}/${file}`,html);
 }
 await writeFile(`${dir}/robots.txt`,`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
 // Keep the pre-rendered multilingual canonical sitemap, add only generated
 // policy/support pages. Replacing the file here previously silently removed
 // all /en,/ar,/de,/fr,/es and product URLs during production builds.
 const sitemapPath=`${dir}/sitemap.xml`;
 let sitemap;
 try{sitemap=await readFile(sitemapPath,'utf8')}catch{sitemap=''}
 const generated=pages.map(file=>SITE+(file==='index.html'?'/':'/'+file.slice(0,-5)));
 if(sitemap.includes('</urlset>')){
  const missing=generated.filter(url=>!sitemap.includes('<loc>'+url+'</loc>'));
  const appended=missing.map(url=>'  <url><loc>'+url+'</loc><lastmod>'+UPDATED+'</lastmod></url>').join('\n');
  sitemap=sitemap.replace('</urlset>',(appended?appended+'\n':'')+'</urlset>');
 }else{
  sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
   generated.map(url=>'  <url><loc>'+url+'</loc><lastmod>'+UPDATED+'</lastmod></url>').join('\n')+'\n</urlset>\n';
 }
 await writeFile(sitemapPath,sitemap);
}

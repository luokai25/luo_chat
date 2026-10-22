// KLIPY standard client-side integration: returns public app key, never proxies API/media.
// A KLIPY app key is browser-visible by design. Do not put any unrelated secret here.
export default function handler(req,res) {
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const appKey=(process.env.KLIPY_APP_KEY||'').trim();
  if(!/^[A-Za-z0-9_-]{4,128}$/.test(appKey)) return res.status(200).json({enabled:false});
  return res.status(200).json({enabled:true,appKey});
}
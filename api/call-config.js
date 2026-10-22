import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_KEY} from '../src/config.js';
import {createRequestFetch} from '../src/request-policy.js';
export function createCallConfigHandler({clientFactory=createClient,env=process.env,logger=console}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const authorization=req.headers.authorization;
  const bearer=typeof authorization==='string'&&authorization.length<=8192?authorization.match(/^Bearer ([^\s]+)$/i)?.[1]:null;
  if(!bearer)return res.status(401).json({error:'Sign in first'});
  try{
   const db=clientFactory(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:createRequestFetch({timeoutMs:8000})}});
   const {data,error}=await db.auth.getUser(bearer);
   if(error){if(!error.status||error.status>=500)throw Error('Auth unavailable');return res.status(401).json({error:'Sign in first'});}
   if(!data?.user)return res.status(401).json({error:'Sign in first'});
   const iceServers=[{urls:'stun:stun.l.google.com:19302'}];
   const urls=env.LUO_TURN_URL,username=env.LUO_TURN_USER,credential=env.LUO_TURN_PASSWORD;
   if(urls&&username&&credential&&/^turns?:[^\s]+$/.test(urls))iceServers.push({urls,username,credential});
   return res.status(200).json({iceServers,relayConfigured:iceServers.length>1});
  }catch{logger.error('LUO_CALL_CONFIG_FAILED');return res.status(503).json({error:'Call configuration unavailable'});}
 };
}
export default createCallConfigHandler();

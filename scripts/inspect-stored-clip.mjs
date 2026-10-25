// Operator-run worker entry point. Requires reviewed staging SQL and a working
// OS sandbox. Not deployed automatically; never accepts a key as a CLI argument.
import {createClient} from '@supabase/supabase-js';
import {createRequestFetch} from '../src/request-policy.js';
import {createInspectionStore} from '../src/server/inspection-store.js';
import {inspectStoredClip} from '../src/server/clip-inspection-job.js';
try{
 const key=process.env.LUO_INSPECTION_SERVICE_KEY,url=process.env.LUO_INSPECTION_PROJECT_URL;
 if(!key||!url||process.argv.length!==3)throw Error();
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:createRequestFetch({timeoutMs:8000,uploadTimeoutMs:15000})}});
 const result=await inspectStoredClip(createInspectionStore(db,{projectOrigin:url}),process.argv[2],{signal:AbortSignal.timeout(120000)});
 console.log(JSON.stringify({status:'inspected',mimeType:result.mimeType,bytes:result.byteSize,duration:result.duration}));
}catch{console.error('CLIP_INSPECTION_FAILED');process.exitCode=1}

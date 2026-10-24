// A nonexistent reserved-domain address verifies the Auth API without an account or email delivery.
import {SUPABASE_URL,SUPABASE_KEY} from '../src/config.js';
const email='luo-ci-'+(process.env.GITHUB_RUN_ID||Date.now())+'@example.invalid';
try{
 const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password:'not-a-real-account-password'}),signal:AbortSignal.timeout(18000)});
 const body=await r.json().catch(()=>({}));
 if([400,401].includes(r.status)&&(body.code==='invalid_credentials'||body.error_code==='invalid_credentials'))console.log('PASS: email/password Auth API reaches credential verification and rejects a nonexistent account.');
 else{console.error('BLOCKED: live email/password check returned HTTP '+r.status+'. No real account was used; signup and email delivery were not exercised.');process.exitCode=1}
}catch(e){console.error('BLOCKED: email/password Auth API could not be reached ('+e.name+').');process.exitCode=1}

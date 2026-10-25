// Deliberately excludes URLs, stack traces, messages, accounts and persistent IDs.
export function installTelemetry(win=window) {
 if(win.navigator?.globalPrivacyControl || win.navigator?.doNotTrack==='1')return;
 let sent=0;const seen=new Set();
 const report=code=>{
  // Re-check every event: withdrawing consent must stop an installed reporter.
  if(win.luoDiagnosticsAllowed?.()!==true)return;
  if(sent>=5||seen.has(code))return;seen.add(code);sent++;
  try{Promise.resolve(win.fetch('/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),credentials:'omit',keepalive:true,signal:AbortSignal.timeout(4000)})).catch(()=>{});}catch{}
 };
 win.addEventListener('error',event=>{if(event.error)report('CLIENT_RUNTIME_ERROR');});
 win.addEventListener('unhandledrejection',()=>report('CLIENT_UNHANDLED_REJECTION'));
}

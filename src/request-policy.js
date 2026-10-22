// Deadlines cover response bodies too. Writes are never automatically retried:
// the server may have committed even when no response reaches the caller.
export function createRequestFetch({fetchImpl=globalThis.fetch,timeoutMs=20_000,uploadTimeoutMs=120_000}={}){
 return function request(input,init={}){
  const url=typeof input==='string'?input:input?.url||String(input);
  const method=(init.method||input?.method||'GET').toUpperCase();
  const uploading=/\/storage\/v1\/object\//.test(url)&&['POST','PUT','PATCH'].includes(method);
  const deadline=AbortSignal.timeout(uploading?uploadTimeoutMs:timeoutMs);
  const inherited=init.signal||input?.signal;
  return fetchImpl(input,{...init,signal:inherited?AbortSignal.any([inherited,deadline]):deadline});
 };
}

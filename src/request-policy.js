// Deadlines cover response bodies too. Writes are never automatically retried:
// the server may have committed even when no response reaches the caller.
export function createRequestFetch({fetchImpl=globalThis.fetch,timeoutMs=20_000,uploadTimeoutMs=120_000}={}){
 return function request(input,init={}){
  const url=typeof input==='string'?input:input?.url||String(input);
  // Transfers and explicit account cleanup can legitimately exceed the normal
  // API budget. Download response bodies remain subject to this longer deadline.
  const longOperation=/\/storage\/v1\/object\//.test(url)||/\/functions\/v1\/luo-delete-account(?:\?|$)/.test(url);
  const deadline=AbortSignal.timeout(longOperation?uploadTimeoutMs:timeoutMs);
  const inherited=init.signal||input?.signal;
  return fetchImpl(input,{...init,signal:inherited?AbortSignal.any([inherited,deadline]):deadline});
 };
}

/* Additive owner-only revenue display. Never infer revenue from invoice status. */
const el=id=>document.getElementById(id);
const money=(amount,currency)=>new Intl.NumberFormat(undefined,{style:'currency',currency}).format(amount/100);
let previous=null,ledger=null;
function draw(detail){
 const root=el('luo-live-revenue');if(!root)return;
 const value=el('luo-revenue-value'),status=el('luo-revenue-status'),meta=el('luo-revenue-meta');
 // Only a server-verified, owner-protected completed-payment summary is acceptable.
 const data=ledger||detail?.insights?.verified_revenue;
 if(!data||data.verified!==true||!Number.isSafeInteger(data.completed_minor)||data.completed_minor<0||!Number.isSafeInteger(data.completed_count)||data.completed_count<0||!/^[A-Z]{3}$/.test(data.currency||'')){
  value.textContent='Not connected';status.textContent='Awaiting verified payment ledger';meta.textContent='No checkout attempts, invoice estimates or test payments counted.';previous=null;return;
 }
 const key=data.currency+':'+data.completed_minor;
 value.textContent=money(data.completed_minor,data.currency);
 status.textContent=data.completed_count.toLocaleString()+' completed payments · '+data.currency;
 meta.textContent='Verified as of '+(data.as_of?new Date(data.as_of).toLocaleString():'last secure sync')+' · refunds tracked separately';
 if(previous!==null&&previous!==key)root.classList.add('revenue-changed');
 else root.classList.remove('revenue-changed');
 previous=key;
}
window.addEventListener('luo-workspace:stats',e=>draw(e.detail));
window.addEventListener('luo-workspace:controls',e=>{const f=e.detail?.finance;if(!f)return;ledger={verified:true,completed_minor:Number(f.gross_minor),completed_count:Number(f.completed_count),currency:f.currency,as_of:e.detail.as_of};draw(null);if(f.unreconciled_refunds)el('luo-revenue-meta').textContent+=' · refund/reversal reconciliation required';});
window.addEventListener('luo-workspace:clear',()=>{ledger=null;draw(null)});
// Refresh the existing authenticated owner snapshot while visible. The payment webhook
// must independently persist verified events; browser polling never marks payments complete.
setInterval(()=>{
 if(document.visibilityState==='visible'&&!el('app')?.hidden&&!el('refresh')?.disabled)el('refresh')?.click();
},20000);

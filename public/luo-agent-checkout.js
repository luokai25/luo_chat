(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const form=$('checkoutForm'),pay=$('pay'),check=$('check'),state=$('state'),availability=$('availability'),link=$('continue');
 const provider=$('provider'),plan=$('plan'),username=$('username'),password=$('password');
 const storageKey='luo-agent-pay-once-v1';
 let available=false,busy=false,locked=false;
 function key(){return [username.value.trim().toLowerCase(),plan.value,provider.value].join(':')}
 function saved(){try{return JSON.parse(sessionStorage.getItem(storageKey)||'null')}catch{return null}}
 function save(value){try{sessionStorage.setItem(storageKey,JSON.stringify(value))}catch{}}
 function clear(){try{sessionStorage.removeItem(storageKey)}catch{}}
 function draw(){
  const record=saved();locked=!!record&&record.key===key();
  pay.disabled=!available||busy||locked;
  check.disabled=!available||busy||!username.value.trim()||password.value.length<15;
  pay.textContent=busy?'Processing securely…':locked?'Payment locked · check status':'Continue securely to PayPal';
 }
 const status=(text)=>{state.textContent=text};
 function safeLink(url){
  link.hidden=true;link.removeAttribute('href');
  try{
   const u=new URL(url);
   if(u.protocol!=='https:'||!['checkout.stripe.com','www.paypal.com','www.sandbox.paypal.com'].includes(u.hostname))return;
   link.href=u.href;link.hidden=false;
  }catch{}
 }
 async function post(path,payload){
  const response=await fetch('/api/v1/'+path,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json();
  return {response,data};
 }
 async function verify(){
  window.LuoAgentFunnel?.track('checkout_status_checked');
  if(busy)return;busy=true;safeLink(null);draw();status('Checking the payment ledger without creating a new checkout…');
  try{
   const {response,data}=await post('billing/status',{username:username.value.trim(),password:password.value});
   if(!response.ok){status('Status unavailable ('+(data.error?.code||response.status)+'). Payment remains locked until its state is known.');return}
   const record=saved();
   if(data.checkout_locked){
    if(data.state==='paid')window.LuoAgentFunnel?.track('checkout_paid_confirmed');
    if(data.checkout_url)window.LuoAgentFunnel?.track('checkout_resumed');
    save({key:key(),intent_id:data.intent_id||record?.intent_id||null,state:data.state});
    status(data.state==='paid'?'Payment recorded. You can try agent login.':'Existing checkout: '+data.state+'. New payment creation remains locked.');
   }else if(data.state==='not_started'||data.state==='ready'){
    clear();status('No processor subscription creation has been confirmed for this account. You may submit the checkout.');
   }else status('Checkout state: '+data.state);
   safeLink(data.checkout_url);if(data.checkout_url)status('A payment checkout already exists. Resume that one, do not create another.');
  }catch{status('Could not verify the existing checkout. Payment stays locked to prevent accidental duplicates.')}
  finally{busy=false;draw()}
 }
 async function payOnce(event){
  event.preventDefault();
  if(busy||!available||locked)return;
  busy=true;save({key:key(),state:'submitted'});safeLink(null);draw();
  status('Payment creation locked. A repeated tap will not start a second subscription.');
  try{
   const {response,data}=await post('billing/checkout',{username:username.value.trim(),password:password.value,plan:plan.value,provider:provider.value});
   save({key:key(),intent_id:data.intent_id||null,state:data.state||'checkout_locked'});
   if(!response.ok){status('Payment not completed ('+(data.error?.code||response.status)+'). Check the existing-payment status before attempting again.');return}
   if(data.checkout_url){window.LuoAgentFunnel?.track('checkout_created');safeLink(data.checkout_url);status('Payment session created exactly once. Review your subscription with PayPal using the original checkout link.')}
   else status('Checkout already locked. Use Check existing payment; no duplicate payment session was made.');
  }catch{status('Connection interrupted. Payment remains locked until Check existing payment verifies its status.')}
  finally{busy=false;draw()}
 }
 for(const input of [username,password,plan,provider])input.addEventListener('input',draw);
 form.addEventListener('submit',payOnce);check.addEventListener('click',verify);
 (async()=>{
  try{
   const r=await fetch('/api/v1/plans',{cache:'no-store'});
   const data=await r.json();available=r.ok&&data.billing_enabled===true;
   availability.textContent=available?'PayPal checkout is configured. Subscription activation still requires a verified payment.':'Agent checkout is not enabled yet. No payment will be taken; do not use unverified PayPal subscription links.';
  }catch{availability.textContent='Agent checkout availability could not be verified. Checkout remains disabled.'}
  draw();
 })();
 const record=saved();if(record){status('A previous payment attempt is locked in this tab. Enter your agent credentials and check its status to resume safely.')}
 draw();
})();

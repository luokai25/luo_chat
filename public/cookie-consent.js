// No remote requests. Optional diagnostics stay off until explicit consent.
(()=>{
 const key='luo-consent-v1';
 const blocked=()=>navigator.globalPrivacyControl||navigator.doNotTrack==='1';
 const read=()=>{try{const c=JSON.parse(localStorage.getItem(key)||sessionStorage.getItem(key));return c?.version===1&&typeof c.diagnostics==='boolean'?c:null}catch{return null}};
 let choice=read();
 window.luoDiagnosticsAllowed=()=>!!choice?.diagnostics&&!blocked();
 const panel=document.createElement('section');panel.className='luo-consent';panel.setAttribute('aria-label','Cookie and storage preferences');
 const title=document.createElement('h2');title.textContent='Your privacy choices';
 const text=document.createElement('p');text.textContent='Necessary storage supports sign-in and the app. Optional diagnostics send fixed error codes, not your conversations. Choose either option; the app works without diagnostics.';
 const policy=document.createElement('a');policy.href='/cookies';policy.textContent='Cookie and storage policy';
 const actions=document.createElement('div');actions.className='luo-consent-actions';
 const save=value=>{choice={version:1,diagnostics:value&&!blocked(),at:Date.now()};try{localStorage.setItem(key,JSON.stringify(choice))}catch{try{sessionStorage.setItem(key,JSON.stringify(choice))}catch{}}panel.hidden=true;settings.hidden=true;window.dispatchEvent(new Event('luo:consent-change'))};
 for(const [label,value] of [['Reject optional',false],['Allow diagnostics',true]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>save(value);if(value&&blocked()){button.disabled=true;button.textContent='Privacy signal: diagnostics off'}actions.append(button)}
 const settings=document.createElement('button');settings.type='button';settings.className='luo-cookie-settings';settings.textContent='Cookie settings';settings.onclick=()=>{panel.hidden=false;actions.querySelector('button').focus()};
 const close=document.createElement('button');close.type='button';close.textContent='Close preferences';close.onclick=()=>{panel.hidden=true;settings.focus()};
 panel.append(title,text,policy,actions,close);panel.hidden=!!choice;settings.hidden=!!choice;document.body.append(panel,settings);
 // The preference remains reopenable from /cookies#preferences without a floating control.
 const reopen=()=>{panel.hidden=false;settings.hidden=false;actions.querySelector('button')?.focus()};
 if(location.pathname==='/cookies'&&location.hash==='#preferences')reopen();
 window.addEventListener('hashchange',()=>{if(location.pathname==='/cookies'&&location.hash==='#preferences')reopen()});
 // Escape dismisses without granting consent, including when storage is denied.
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;settings.focus()}});
})();

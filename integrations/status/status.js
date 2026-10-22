async function refresh(){
 const summary=document.getElementById('summary'),updated=document.getElementById('updated'),checks=document.getElementById('checks');
 try{
  const response=await fetch('https://luo-chat-uptime.luo-chat-ops.workers.dev/status.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});
  const data=await response.json();if(!data.latest||data.stale)throw Error();
  summary.textContent=data.status==='up'?'All checked services are available':'A checked service may be unavailable';checks.replaceChildren();
  for(const check of data.latest.checks){const li=document.createElement('li');li.textContent=(check.name==='web'?'Website':'Authentication')+': '+(check.status==='up'?'Available':'Unavailable')+' · '+check.latencyMs+' ms';checks.append(li);}
  updated.textContent='Last checked: '+new Date(data.latest.checkedAt).toLocaleString()+'. '+data.samples+' recent checks.';
 }catch{summary.textContent='Current status is unknown';updated.textContent='Monitoring data is unavailable or older than 15 minutes.';checks.replaceChildren();}
}refresh();setInterval(refresh,60000);

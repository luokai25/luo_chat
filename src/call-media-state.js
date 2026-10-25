// Small, peer-scoped control channel. No identity, message bodies or permissions are accepted.
export function installCallMediaState({peer,initiator,isCurrent=()=>true,onRemote=()=>{}}){
 const label='luo-call-media-v1';let channel=null,stopped=false,latest={v:1,video:true,held:false};
 const alive=()=>!stopped&&isCurrent();
 function flush(){if(alive()&&channel?.readyState==='open'&&!(channel.bufferedAmount>1024))try{channel.send(JSON.stringify(latest))}catch{}}
 function attach(candidate){
  if(!alive()||channel||candidate?.label!==label){candidate?.close?.();return}
  channel=candidate;channel.onopen=flush;
  channel.onmessage=event=>{if(!alive()||typeof event.data!=='string'||event.data.length>128)return;try{const value=JSON.parse(event.data);if(value.v!==1||typeof value.video!=='boolean'||typeof value.held!=='boolean')return;onRemote({video:value.video,held:value.held})}catch{}};
  flush();
 }
 if(initiator&&peer.createDataChannel)try{attach(peer.createDataChannel(label,{ordered:true}))}catch{}
 else if(!initiator)peer.ondatachannel=event=>attach(event.channel);
 return{send(value){latest={v:1,video:!!value.video,held:!!value.held};flush()},stop(){stopped=true;if(channel){channel.onopen=channel.onmessage=null;channel.close();channel=null}if(!initiator)peer.ondatachannel=null}};
}

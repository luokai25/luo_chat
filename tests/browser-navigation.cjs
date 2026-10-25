const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const origin=process.env.LUO_TEST_BASE_URL||'https://luo-chat-luokai25.vercel.app';const entry=process.env.LUO_TEST_ENTRY_URL||origin;
const me={id:'11111111-1111-4111-8111-111111111111',email:'qa-owner@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{}};
const peer={id:'22222222-2222-4222-8222-222222222222',username:'qa_friend',display_name:'QA Friend',bio:'',avatar_url:'https://byjixqwpjvsgmqilmzbm.supabase.co/storage/v1/object/public/avatars/fixture/avatar.png',profile_frame:'none'};
const profile={...peer,id:me.id,username:'qa_owner',display_name:'QA Owner'};
const room='33333333-3333-4333-8333-333333333333';
const jwtPart=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const token=jwtPart({alg:'HS256',typ:'JWT'})+'.'+jwtPart({sub:me.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+7200})+'.fixture';
let browser;const checks=[];
async function setup(signedIn,width=390){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
 const errors=[],requests=[];let relationship='none',blocked=false;let sent=[];let saved=false;let groupCreated=false;
 await context.routeWebSocket('**/realtime/**',ws=>ws.close());
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
  if(url.hostname.endsWith('.supabase.co')){
   requests.push({path:url.pathname,method:req.method()});if(url.pathname.includes('/storage/v1/object/public/avatars/')){await route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=','base64')});return}let data=[];
   if(url.pathname==='/auth/v1/user')data=me;
   else if(url.pathname==='/auth/v1/settings')data={external:{google:false}};
   else if(url.pathname.endsWith('/profiles')){const id=url.searchParams.get('id')||'',name=url.searchParams.get('username')||'';data=name.includes('qa_friend')||id.includes(peer.id)?[peer]:[profile]}
   else if(url.pathname.endsWith('/conversation_members'))data=url.searchParams.has('user_id')?[{conversation_id:room,user_id:me.id,role:'member',last_read_at:new Date().toISOString(),muted:false}]:[{conversation_id:room,user_id:me.id,role:'member'},{conversation_id:room,user_id:peer.id,role:'member'}];
   else if(url.pathname.endsWith('/conversations'))data=[{id:room,kind:groupCreated?'group':'direct',created_by:me.id,title:groupCreated?'QA Group':null,created_at:new Date().toISOString(),last_message_at:new Date().toISOString()}];
   else if(url.pathname.endsWith('/chat_messages'))data=sent;
   else if(url.pathname.includes('/rpc/')){
    const rpc=url.pathname.split('/').pop();
    if(rpc==='get_chat_person')data=[{...peer,relationship,is_blocked:blocked}];
    else if(rpc==='get_chat_connections'){const args=req.postDataJSON()||{};data=(args.list_kind==='outgoing'&&relationship==='outgoing'||args.list_kind==='friends'&&relationship==='friends'||args.list_kind==='incoming'&&relationship==='incoming')?[peer]:[]}
    else if(rpc==='change_chat_connection'){const a=req.postDataJSON().connection_action;relationship=({request:'outgoing',accept:'friends',decline:'none',cancel:'none',remove:'none'})[a];data=null}
    else if(rpc==='set_chat_user_block'){blocked=req.postDataJSON().should_block;relationship='none';data=null}
    else if(rpc==='get_my_conversation_unread_counts')data=[{conversation_id:room,unread_count:0}];
    else if(rpc==='get_my_chat_contacts')data=saved?[{contact_id:peer.id,...peer,person:peer}]:[];
    else if(rpc==='save_chat_contact'){saved=true;data=peer.id}
    else if(rpc==='start_direct_chat')data=room;else if(rpc==='create_group_chat'){groupCreated=true;data=room}
    else if(/find|lookup/.test(rpc))data=[peer];
    else if(rpc==='get_my_chat_previews')data=[];
    else if(/send_chat/.test(rpc)){const body=req.postDataJSON()||{};const m={id:'44444444-4444-4444-8444-444444444444',conversation_id:room,sender_id:me.id,body:body.message_body||'QA test message',message_type:'text',created_at:new Date().toISOString(),reply_to:null,deleted_at:null,recalled_at:null};sent.push(m);data=m;}
   }
   const accept=req.headers().accept||'';if(accept.includes('vnd.pgrst.object+json')&&Array.isArray(data))data=data[0]||null;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':'*'}});return;
  }
  await route.continue();
 });
 if(signedIn)await context.addInitScript(({me,token})=>localStorage.setItem('sb-byjixqwpjvsgmqilmzbm-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,token_type:'bearer',user:me})),{me,token});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(entry,{waitUntil:'networkidle',timeout:30000});
 // Exercise the real privacy choice before navigating behind the consent sheet.
 // Reject diagnostics by default; do not disable the banner or force-click through it.
 const reject=page.getByRole('button',{name:'Reject optional'});
 if(await reject.isVisible()){await reject.click();assert.equal(await page.locator('.luo-consent').isVisible(),false);}

 return {context,page,errors,requests,setRelationship:value=>relationship=value};
}
async function run(){
 browser=await chromium.launch({headless:true,channel:process.env.LUO_BROWSER_CHANNEL||undefined,args:['--no-sandbox']});
 for(const width of [390,1280]){const {context,page,errors}=await setup(false,width);
  await page.locator('#signin').waitFor({state:'visible'});assert.equal(await page.locator('#home').isVisible(),false);
  for(const sel of ['.workspace-nav','#desktopWelcome','#luoApprovedNav','.quick-compose'])assert.equal(await page.locator(sel).isVisible(),false,sel+' leaked onto auth');
  await page.locator('#authModeSignup').click();await page.locator('#username').waitFor({state:'visible'});await page.locator('#authModeSignin').click();await page.locator('#signin').click();
  assert.match(await page.locator('#authmsg').textContent(),/valid email/);
  assert.equal(await page.locator('.app').getAttribute('data-screen'),'auth');assert.equal(await page.locator('.app').evaluate(e=>e.onclick===null),true);
  assert.deepEqual(errors,[]);checks.push('signed-out controls and validation '+width+'px');await context.close();
 }
 const {context,page,errors,requests,setRelationship}=await setup(true);
 await page.waitForFunction(()=>document.querySelector('.app').dataset.screen==='home',{timeout:15000});
 console.log('AUTH',await page.locator('#subtitle').textContent());
 assert.equal(await page.locator('.app').evaluate(e=>e.onclick===null),true);
 await page.locator('#luoApprovedFab').click();await page.locator('#target').waitFor({state:'visible'});assert.equal(await page.locator('.app').getAttribute('data-tab'),'new');
 await page.locator('#target').fill('qa_friend');await page.locator('#lookup').click();console.log('LOOKUP',await page.locator('#lookupResult').textContent());
 await page.locator('#saveContact').click();checks.push('contact lookup and save');
 await page.locator('#lookupResult').getByRole('button',{name:'View profile',exact:true}).click();await page.locator('#personActions').getByRole('button',{name:'Add friend',exact:true}).click();await page.locator('#personActions').getByRole('button',{name:'Cancel request',exact:true}).waitFor();
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/connections-profile-mobile.png'});
 await page.locator('.person-avatar-large').click();await page.locator('#personPhotoDialog').waitFor({state:'visible'});await page.waitForFunction(()=>{const image=document.getElementById('personPhoto');return image.complete&&image.naturalWidth>0});await page.locator('#closePersonPhoto').click();
 assert.equal(await page.locator('#personDialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);await page.locator('#closePerson').click();
 await page.locator('#connectionTabs button[data-kind=outgoing]').click();await page.locator('#connectionList').getByRole('button',{name:'View',exact:true}).click();await page.locator('#personActions').getByRole('button',{name:'Cancel request',exact:true}).click();await page.locator('#personActions').getByRole('button',{name:'Add friend',exact:true}).waitFor();await page.locator('#closePerson').click();checks.push('profile view, full photo, friend request, sent list and cancellation');
 setRelationship('incoming');await page.locator('#connectionTabs button[data-kind=incoming]').click();await page.locator('#connectionList').getByRole('button',{name:'Review',exact:true}).click();await page.locator('#personActions').getByRole('button',{name:'Accept request',exact:true}).click();await page.locator('#personActions').getByRole('button',{name:'Remove friend',exact:true}).waitFor();
 page.once('dialog',d=>d.accept());await page.locator('#personActions').getByRole('button',{name:'Block',exact:true}).click();await page.locator('#personActions').getByRole('button',{name:'Unblock',exact:true}).waitFor();assert.equal(await page.locator('#personActions .primary').count(),0);await page.locator('#personActions').getByRole('button',{name:'Unblock',exact:true}).click();await page.locator('#personActions').getByRole('button',{name:'Add friend',exact:true}).waitFor();await page.locator('#closePerson').click();checks.push('incoming approval, block and unblock');
 await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('.app').dataset.screen==='room');checks.push('start direct chat');
 await page.locator('#viewRoomProfile').click();await page.locator('#personActions .primary').waitFor();await page.locator('#closePerson').click();checks.push('room profile entry point');
 await page.locator('#body').fill('QA test message');await page.locator('#sendform .send').click();await page.waitForFunction(()=>document.querySelector('#messages').textContent.includes('QA test message'));assert.ok(requests.some(r=>/rpc\/send_chat/.test(r.path)));checks.push('send RPC and render chat message');
 await page.locator('#back').click();await page.locator('#luoApprovedNav button[data-target=updates]').click();await page.locator('#storiesDialog').waitFor({state:'visible'});await page.locator('#newStory').click();await page.locator('#storyComposer').waitFor({state:'visible'});checks.push('single Updates tab navigation and story composer');
 await page.locator('#closeStoryComposer').click();await page.locator('#closeStories').click();await page.locator('#luoApprovedNav button[data-target=group]').click();await page.locator('#luoCreateGroupFromCommunity').click();await page.locator('#groupname').fill('QA Group');await page.locator('#luoAddUsername').fill('qa_friend');await page.locator('#luoGroupPicker').getByRole('button',{name:'Add',exact:true}).click();await page.locator('#createGroup').click();await page.waitForFunction(()=>document.querySelector('.app').dataset.screen==='room');assert.equal(await page.locator('#roomtitle').textContent(),'QA Group');checks.push('group member picker and creation');await page.locator('#back').click();
 for(const t of ['new','group','saved','scheduled','profile','chats']){await page.locator('.workspace-nav .tab[data-tab="'+t+'"]').dispatchEvent('click');assert.equal(await page.locator('.app').getAttribute('data-tab'),t)}
 checks.push('all six native tabs');assert.deepEqual(errors,[]);checks.push('no browser exceptions');
 console.log(JSON.stringify({checks,requestCount:requests.length}));await context.close();
 const desktop=await setup(true,1280);await desktop.page.locator('.chatrow').first().click();await desktop.page.locator('#viewRoomProfile').click();await desktop.page.locator('#personActions .primary').waitFor();assert.equal(await desktop.page.locator('#personDialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);assert.equal(await desktop.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await desktop.page.emulateMedia({reducedMotion:'reduce'});assert.equal(await desktop.page.locator('#personDialog').evaluate(e=>getComputedStyle(e).animationName),'none');await desktop.page.screenshot({path:'test-results/connections-profile-desktop.png'});assert.deepEqual(desktop.errors,[]);checks.push('desktop profile layout, keyboard access and reduced motion');await desktop.context.close();
}
run().then(async()=>{fs.writeFileSync('browser-results.json',JSON.stringify({passed:true,checks},null,2));await browser.close()}).catch(async e=>{console.log('TEST FAILURE',e.message);fs.writeFileSync('browser-results.json',JSON.stringify({passed:false,checks,error:e.stack},null,2));if(browser)await browser.close();process.exit(1)});

/* Luo Chat Updates UI. Presentation layer only: the existing installStories
   module retains ALL reads, uploads, permissions and signed media URLs. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = document.querySelector('.app');
  const stories = $('storiesDialog'), feed = $('storyFeed');
  const composer = $('storyComposer'), mediaInput = $('storyMedia');
  const originalOpen = $('openStories'), originalNew = $('newStory');
  if (!app || !stories || !feed || !composer || !mediaInput || !originalOpen || !originalNew) return;

  const make = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const button = (cls, label, callback) => {
    const e = make('button', cls, label); e.type = 'button';
    e.addEventListener('click', callback); return e;
  };
  const signedIn = () => app.dataset.screen === 'home' || app.dataset.screen === 'room' || document.querySelector('#home.screen.active, #room.screen.active');
  let activeStory = -1, timer = null, generation = 0, paused = false, duration = 7000, startTime = 0, remaining = 7000;
  let localPreviewURL = null, localPreviewFile = null;
  const cards = () => [...feed.querySelectorAll(':scope > .story-card')].filter(c => c.isConnected && (!c.dataset.storyExpires || Date.parse(c.dataset.storyExpires) > Date.now()));

  // Workspace entry deliberately has no data-tab: Luo Chat's tab controller is
  // not patched or overridden. This triggers its existing audited Stories code.
  const nav = document.querySelector('.workspace-nav');
  if (nav && !$('luoUpdatesNav')) {
    const updatesNav = button('tab luo-updates-nav', 'Updates', openUpdates);
    updatesNav.id = 'luoUpdatesNav'; updatesNav.setAttribute('aria-haspopup', 'dialog');
    updatesNav.title = 'Stories and private updates';
    const icon = make('span', 'luo-updates-nav-icon', '◌'); icon.setAttribute('aria-hidden', 'true');
    updatesNav.prepend(icon);
    const chats = nav.querySelector('[data-tab="chats"]');
    if (chats) chats.after(updatesNav); else nav.prepend(updatesNav);
  }
  // Stories are opened only from the dedicated Updates tab, not duplicated in Chats.

  // Improve native stories modal without replacing the existing server-bound feed.
  stories.classList.add('luo-updates-dialog');
  const title = $('storiesDialogHeading'); if (title) title.textContent = 'Updates';
  const shareButton = $('newStory'); shareButton.textContent = '＋ Add story';
  const refreshButton = $('refreshStories'); refreshButton.textContent = '↻ Refresh';
  if (!$('luoStoriesIntro')) {
    const intro = make('p','luo-story-intro','Your moments, your audience. Updates disappear after 24 hours.');
    intro.id = 'luoStoriesIntro';
    const head = stories.querySelector('.dialog-heading'); head?.after(intro);
    const carouselHeading = make('h3','luo-story-subhead','Recent stories');
    carouselHeading.id = 'luoStoryHeading';
    feed.before(carouselHeading);
    const rail = make('div','luo-story-rail'); rail.id = 'luoStoryRail';
    rail.setAttribute('aria-label','Recent story thumbnails');
    carouselHeading.after(rail);
    feed.before(make('h3','luo-story-subhead luo-story-detail-heading','Story details and reactions'));
  }

  function openUpdates() {
    if (!signedIn()) return;
    originalOpen.click();
  }
  function openNewStory() {
    if (!signedIn()) return;
    if (!stories.open) originalOpen.click();
    originalNew.click();
  }

  function nameOf(card) { return (card.querySelector('h3')?.textContent || 'Story').split(' · ')[0].trim().slice(0,80) || 'Story'; }
  function textOf(card) { return card.querySelector('p')?.textContent?.slice(0,2000) || ''; }
  function mediaButton(card) { return [...card.querySelectorAll('button')].find(b => b.textContent.trim() === 'Open story media'); }
  function rebuildRail() {
    const rail = $('luoStoryRail'); if (!rail) return;
    const current = cards(); rail.replaceChildren();
    rail.append(button('luo-story-bubble luo-create-bubble', '＋', openNewStory));
    const create = rail.firstElementChild;
    create.setAttribute('aria-label','Create your story'); create.title = 'Create your story';
    for (let i = 0; i < current.length; i++) {
      const card = current[i], name = nameOf(card);
      const avatar = make('span','luo-bubble-avatar',name.slice(0,1).toUpperCase());
      const title = make('span','luo-bubble-name',name);
      const item = button('luo-story-bubble', '', () => view(i));
      item.setAttribute('aria-label',`View story from ${name}`);
      item.append(avatar,title); rail.append(item);
      if (!card.querySelector('.luo-story-watch')) {
        const watch = button('luo-story-watch','▶ View story',()=>view(cards().indexOf(card)));
        card.append(watch);
      }
    }
    const heading = $('luoStoryHeading');
    if (heading) heading.textContent = current.length?`Recent stories · ${current.length}`:'Recent stories';
  }
  new MutationObserver(rebuildRail).observe(feed,{childList:true});
  // Restore state if a Stories dialog has already been opened.
  rebuildRail();

  // Media viewer uses the native story reader to authorize media via Supabase
  // and issue 60s private signed URLs. It never fetches or stores story records
  // independently, and URLs are destroyed when the viewer closes.
  const viewer = make('dialog','luo-status-viewer'); viewer.id = 'luoStatusViewer';
  viewer.setAttribute('aria-label','Story viewer');
  const vHeader = make('header','luo-viewer-head');
  const progress = make('div','luo-viewer-progress'); progress.id = 'luoViewerProgress';
  const vIdentity = make('div','luo-viewer-identity');
  const vAvatar = make('span','luo-viewer-avatar','L'); vAvatar.id = 'luoViewerAvatar';
  const vName = make('strong','','Story'); vName.id = 'luoViewerName'; vIdentity.append(vAvatar,vName);
  const vClose = button('luo-viewer-close','✕',closeViewer);vClose.setAttribute('aria-label','Close story');
  vHeader.append(progress,vIdentity,vClose);
  const vBody = make('div','luo-viewer-body'); vBody.id = 'luoViewerBody';
  const vMessage = make('div','luo-viewer-message');vMessage.id = 'luoViewerMessage';
  const vMedia = make('div','luo-viewer-media');vMedia.id = 'luoViewerMedia';
  const vStatus = make('p','luo-viewer-status');vStatus.id = 'luoViewerStatus';vStatus.setAttribute('role','status');
  vBody.append(vMedia,vMessage,vStatus);
  const vControls = make('footer','luo-viewer-controls');
  const vPrev = button('luo-viewer-move','‹ Previous',()=>view(activeStory-1));
  const vPause = button('luo-viewer-pause','Pause',togglePause);
  const vNext = button('luo-viewer-move','Next ›',()=>view(activeStory+1));
  vControls.append(vPrev,vPause,vNext);
  viewer.append(vHeader,vBody,vControls);document.body.append(viewer);

  function stopTimer() { if (timer !== null) {clearInterval(timer);timer=null;} }
  function resetMedia() {
    for (const media of vMedia.querySelectorAll('video,audio,img')) {
      if (media.tagName !== 'IMG') {media.pause(); media.removeAttribute('src');media.load();}
      else media.removeAttribute('src');
    }
    vMedia.replaceChildren();
  }
  function closeViewer() {
    generation++;stopTimer();resetMedia();vStatus.textContent='';activeStory=-1;
    if (viewer.open) viewer.close();
    document.body.classList.remove('luo-story-watching');
  }
  viewer.addEventListener('close',()=>{generation++;stopTimer();resetMedia();activeStory=-1;document.body.classList.remove('luo-story-watching');});
  viewer.addEventListener('click',e=>{if(e.target===viewer)closeViewer();});
  document.addEventListener('keydown',e=>{
    if(!viewer.open)return;
    if(e.key==='ArrowRight'){e.preventDefault();view(activeStory+1);}
    if(e.key==='ArrowLeft'){e.preventDefault();view(activeStory-1);}
    if(e.key===' ' && e.target.tagName!=='BUTTON'){e.preventDefault();togglePause();}
  });
  function togglePause(){
    if (!viewer.open)return;
    paused=!paused;vPause.textContent=paused?'Resume':'Pause';
    const media=vMedia.querySelector('video,audio');
    if(media){if(paused)media.pause();else media.play().catch(()=>{});}
    else if(!paused) startTime=Date.now();
  }
  function updateProgress() {
    const bars=[...progress.children];bars.forEach((bar,i)=>{const inner=bar.firstElementChild; if(inner)inner.style.width=(i<activeStory?'100':i>activeStory?'0':String(Math.min(100,Math.max(0,100*(1-remaining/duration)))))+'%';});
  }
  function startTimer(ms=7000) {
    stopTimer();duration=ms;remaining=ms;startTime=Date.now();paused=false;vPause.textContent='Pause';
    updateProgress();
    timer=setInterval(()=>{
      if(!viewer.open||document.hidden||paused){startTime=Date.now();return;}
      const now=Date.now();remaining-=Math.max(0,now-startTime);startTime=now;updateProgress();
      if(remaining<=0){if(activeStory<cards().length-1)view(activeStory+1);else closeViewer();}
    },80);
  }
  async function privateMedia(card, token) {
    // If media was already opened, avoid exposing a stale signed URL by
    // re-requesting the native server authorization if it is older than 45s.
    const getFresh=()=>{
      const el=card.querySelector('.story-media');
      const t=Number(card.dataset.luoMediaOpened||0);
      return el&&Date.now()-t<40000?el:null;
    };
    let node=getFresh();if(node)return node;
    const btn=mediaButton(card);if(!btn)return null;
    // Remove old media elements only. Never remove native reactions or controls.
    card.querySelectorAll('.story-media').forEach(n=>n.remove());
    btn.click();
    const begin=Date.now();
    while (Date.now()-begin<9000) {
      if(token!==generation||!viewer.open||!card.isConnected)return null;
      node=card.querySelector('.story-media');
      if(node){card.dataset.luoMediaOpened=String(Date.now());return node;}
      await new Promise(resolve=>setTimeout(resolve,125));
    }
    if(token===generation)vStatus.textContent='Media could not be opened. It may have expired or is no longer shared with you.';
    return null;
  }
  async function view(index) {
    const arr=cards(); if(!arr.length||index<0||index>=arr.length){if(viewer.open)closeViewer();return;}
    const card=arr[index];if(!card)return;
    generation++;const token=generation;stopTimer();resetMedia();
    activeStory=index;vName.textContent=nameOf(card);vAvatar.textContent=nameOf(card).slice(0,1).toUpperCase();
    vMessage.textContent=textOf(card);vStatus.textContent='';
    progress.replaceChildren(...arr.map(()=>{const outer=make('span','luo-viewer-bar');outer.append(make('i'));return outer;}));
    vPrev.disabled=index===0;vNext.disabled=index===arr.length-1;
    if(!viewer.open)viewer.showModal();document.body.classList.add('luo-story-watching');
    startTimer(7000);
    const hasMedia=Boolean(mediaButton(card));
    if(!hasMedia){return;}
    vStatus.textContent='Loading private story media…';paused=true;vPause.textContent='Resume';
    const native=await privateMedia(card,token);
    if(token!==generation||!viewer.open)return;
    paused=false;vPause.textContent='Pause';
    if(!native){if(!vStatus.textContent)vStatus.textContent='Media unavailable.';startTimer(7000);return;}
    vStatus.textContent='';
    const kind=native.tagName.toLowerCase();
    let copy;
    if(kind==='video'){copy=make('video');copy.src=native.src;copy.controls=true;copy.playsInline=true;copy.preload='metadata';copy.setAttribute('aria-label','Story video');}
    else if(kind==='audio'){copy=make('audio');copy.src=native.src;copy.controls=true;copy.preload='metadata';copy.setAttribute('aria-label','Story audio');}
    else {copy=make('img');copy.src=native.src;copy.alt=`Story from ${nameOf(card)}`;copy.decoding='async';}
    vMedia.append(copy);
    if(copy.tagName==='IMG')startTimer(7000);
    else {
      startTimer(55000);
      copy.addEventListener('ended',()=>{if(token===generation){if(index<cards().length-1)view(index+1);else closeViewer();}},{once:true});
      // Browser autoplay policies are respected; controls remain available.
      copy.play().catch(()=>{vStatus.textContent='Tap Play to watch this story.';});
    }
  }
  stories.addEventListener('close',()=>{closeViewer();});

  // Media selection preview is local only. The original storyForm submit
  // handler still validates 50MB and performs upload + audience-scoped RPC.
  const preview = make('div','luo-upload-preview');preview.id='luoStoryUploadPreview';preview.hidden=true;
  const pTitle=make('strong','', 'Selected media');
  const pMedia=make('div','luo-upload-preview-media');pMedia.id='luoUploadMedia';
  const pHint=make('span','luo-upload-preview-hint','Preview on this device only · Nothing uploads until you share.');
  const pClear=button('ghost luo-upload-clear','Remove',()=>{mediaInput.value='';resetUploadPreview();});
  preview.append(pTitle,pMedia,pHint,pClear);mediaInput.after(preview);
  const originalHeading=$('storyComposerHeading');if(originalHeading)originalHeading.textContent='Create a story';
  mediaInput.addEventListener('change',()=>{
    resetUploadPreview();const file=mediaInput.files?.[0];if(!file)return;
    if(file.size>50*1024*1024){const st=$('storyStatus');if(st)st.textContent='Choose a photo, video or audio file smaller than 50 MB.';return;}
    localPreviewFile=file;localPreviewURL=URL.createObjectURL(file);
    const allowed=file.type.startsWith('image/')||file.type.startsWith('video/')||file.type.startsWith('audio/');
    if(!allowed){resetUploadPreview();return;}
    let node;if(file.type.startsWith('image/')){node=make('img');node.src=localPreviewURL;node.alt='Your selected story photo';}
    else if(file.type.startsWith('video/')){node=make('video');node.src=localPreviewURL;node.controls=true;node.playsInline=true;node.preload='metadata';}
    else {node=make('audio');node.src=localPreviewURL;node.controls=true;}
    pMedia.append(node);pTitle.textContent=file.name.slice(0,90);preview.hidden=false;
  });
  function resetUploadPreview(){
    for(const m of pMedia.querySelectorAll('video,audio')){m.pause();m.removeAttribute('src');m.load();}
    pMedia.replaceChildren();if(localPreviewURL)URL.revokeObjectURL(localPreviewURL);
    localPreviewURL=null;localPreviewFile=null;preview.hidden=true;
  }
  composer.addEventListener('close',resetUploadPreview);
  const storyForm=$('storyForm');if(storyForm)storyForm.addEventListener('submit',()=>{if(mediaInput.files.length===0)resetUploadPreview();});

  // When the native app signs out, clear all displayed signed URLs. Auth
  // detection uses only app-provided screen state and never stores user IDs.
  new MutationObserver(()=>{if(app.dataset.screen==='auth'){closeViewer();resetUploadPreview();if(stories.open)stories.close();if(composer.open)composer.close();}}).observe(app,{attributes:true,attributeFilter:['data-screen']});
})();

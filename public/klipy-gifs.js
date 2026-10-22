/* Luo Chat live GIF gallery: Commons (no key), KLIPY (optional).
   GIFs are original provider media. Source/license attribution is preserved.
   No account token or message history is sent to GIF providers. The 50 custom stickers remain separate. */
(() => {
  'use strict';
  const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
  const KLIPY_API = 'https://api.klipy.com';
  const KLIPY_MEDIA = new Set(['static.klipy.com', 'static1.klipy.com', 'static2.klipy.com']);
  const COMMONS_MAX_BYTES = 8 * 1024 * 1024;
  const PAGE_SIZE = 18;
  const SUGGESTIONS = [['Discover', 'animation'], ['Funny', 'funny animated'], ['Cats', 'animated cat'], ['Love', 'love animated'], ['Hello', 'hello animated'], ['Celebrate', 'celebration animated']];
  const get = id => document.getElementById(id);
  const cache = new Map();
  const clientID = (() => { try { return 'luo-' + crypto.randomUUID(); } catch { return 'luo-public'; } })();
  let provider = 'commons', klipyKey = '', klipyAvailable=false, klipyChecked = false;
  let searchTerm = 'animation', nextOffset = 0, klipyPage = 1, requestId = 0;
  let controller = null, loading = false, selected = null, lastDraft = null;
  let filter = 'Discover';

  function el(tag, props = {}, text = '') {
    const n = document.createElement(tag);
    for (const [k, value] of Object.entries(props)) {
      if (k === 'className') n.className = value;
      else if (k === 'dataset') Object.assign(n.dataset, value);
      else if (k === 'hidden') n.hidden = Boolean(value);
      else if (value !== undefined && value !== null) n.setAttribute(k, String(value));
    }
    if (text !== '') n.textContent = text;
    return n;
  }
  function empty(node) { if (node) node.replaceChildren(); }
  function status(value, kind = 'info') {
    const node = get('klipyStatus');
    if (node) { node.textContent = value; node.dataset.status = kind; }
  }
  function safeUrl(raw, kind = 'either') {
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.search) return null;
      if (kind !== 'commons' && KLIPY_MEDIA.has(url.hostname) && /\.gif$/i.test(url.pathname)) return url.href;
      if (kind !== 'klipy' && url.hostname === 'upload.wikimedia.org' && url.pathname.startsWith('/wikipedia/commons/') && /\.gif$/i.test(url.pathname)) return url.href;
    } catch { /* Reject malformed URL */ }
    return null;
  }
  function safeSource(raw) {
    try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password && !u.port && u.hostname === 'commons.wikimedia.org' && u.pathname.startsWith('/wiki/File:') ? u.href : null; } catch { return null; }
  }
  function cleanText(s, len = 90) {
    return String(s || '').slice(0, 1500).replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, v) => { const x = Number(v); return x >= 32 && x < 127 ? String.fromCharCode(x) : ' '; }).replace(/&(amp|quot|apos|lt|gt|nbsp);/gi, (_, key) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[key.toLowerCase()] || ' ')).replace(/\s+/g, ' ').trim().slice(0, len);
  }
  function locale() { return (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'eg' : 'us'; }
  function cancelRequest() { controller?.abort(); ++requestId; controller = null; loading = false; }
  function closePicker() { cancelRequest(); if (get('klipyDialog')?.open) get('klipyDialog').close(); }
  function isOpen() { return Boolean(get('klipyDialog')?.open); }
  function clearSelection() { selected = null; const p = get('klipyPreview'); if (p) { empty(p); p.hidden = true; } }

  function skeleton() {
    const grid = get('klipyGrid'); empty(grid);
    if (!grid) return;
    grid.setAttribute('aria-busy', 'true');
    for (let k = 0; k < 6; ++k) grid.append(el('div', { className: 'klipy-skeleton', 'aria-hidden': 'true' }));
  }
  function showEmpty(message) {
    const grid = get('klipyGrid'); empty(grid);
    if (!grid) return;
    const state = el('div', { className: 'klipy-empty' });
    state.append(el('div', { className: 'klipy-empty-icon', 'aria-hidden': 'true' }, 'GIF'));
    state.append(el('h3', {}, 'No GIFs to show yet'));
    state.append(el('p', {}, message));
    const retry = el('button', { type: 'button', className: 'klipy-retry' }, 'Try again');
    retry.addEventListener('click', () => search(false)); state.append(retry); grid.append(state);
  }
  function setCategory(active) {
    filter = active;
    for (const b of get('klipyCategories')?.querySelectorAll('button') || []) {
      const on = b.dataset.category === active;
      b.setAttribute('aria-pressed', String(on));
    }
  }
  function activateCategory(label, term) {
    setCategory(label);
    get('klipyQuery').value = label === 'Discover' ? '' : term;
    searchTerm = term; nextOffset = 0;
    search(false, term);
  }
  function setProvider(next) {
    if (next === 'klipy' && !klipyAvailable) return;
    provider = next; cancelRequest(); clearSelection();
    nextOffset = 0; klipyPage = 1;
    get('klipyCommonsTab').setAttribute('aria-selected', String(next === 'commons'));
    get('klipyCommercialTab').setAttribute('aria-selected', String(next === 'klipy'));
    get('klipyCategories').hidden = next !== 'commons';
    get('klipyQuery').placeholder = next === 'commons' ? 'Search animated GIFs…' : 'Search KLIPY GIFs…';
    get('klipyQuery').value = '';
    const tip = get('klipyTip');
    if (tip) tip.textContent = next === 'commons' ? 'Animated GIFs from Wikimedia Commons. Individual licenses apply; source credit is included when you send.' : 'Trending and searchable GIFs from KLIPY. Powered by KLIPY.';
    const credit = get('klipyAttribution'); empty(credit);
    credit?.append(el('a', { href: next === 'commons' ? 'https://commons.wikimedia.org/' : 'https://klipy.com/', target: '_blank', rel: 'noopener noreferrer' }, next === 'commons' ? 'Wikimedia Commons · licensing varies' : 'Powered by KLIPY'));
    setCategory('Discover');
    if (isOpen()) search(false);
  }
  async function checkKLIPY() {
    if (klipyChecked) return;
    klipyChecked = true;
    try {
      const response = await fetch('/api/klipy-config', { credentials:'omit', cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.enabled && typeof data.appKey === 'string' && /^[a-z0-9_-]{4,128}$/i.test(data.appKey)) {
        klipyKey = data.appKey; klipyAvailable = true;
        get('klipyCommercialTab').hidden = false;
      }
    } catch { /* Commons remains available without KLIPY. */ }
  }
  function openDialog() {
    const dialog = get('klipyDialog'); if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    get('klipyQuery').focus();
    checkKLIPY();
    // Load and render animated cards immediately when the GIF button is clicked.
    if (!get('klipyGrid').querySelector('.klipy-tile') && !loading) search(false);
  }
  function parseCommons(data) {
    const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];
    return pages.map(page => {
      const info = page?.imageinfo?.[0];
      if (!info || info.mime !== 'image/gif' || info.size > COMMONS_MAX_BYTES || info.size < 100) return null;
      const url = safeUrl(info.url, 'commons');
      const source = safeSource(info.descriptionurl);
      if (!url || !source) return null;
      const metadata = info.extmetadata || {};
      const license = cleanText(metadata.LicenseShortName?.value || '', 65);
      if (!license || !/^(CC0|CC[ -]BY(?:-SA|-ND)?(?:[ -][0-9.]+)?|public domain|PD-|GFDL)/i.test(license)) return null;
      const title = cleanText(String(page.title || '').replace(/^File:/, '').replace(/\.gif$/i, '').replace(/_/g, ' '), 100) || 'Animated GIF';
      const author = cleanText(metadata.Artist?.value || '', 80);
      return { url, source, title, license, author };
    }).filter(Boolean);
  }
  function draw(items, append = false) {
    const grid = get('klipyGrid'); if (!grid) return;
    grid.removeAttribute('aria-busy');
    if (!append) empty(grid);
    const existing = new Set([...grid.querySelectorAll('.klipy-tile-button')].map(x => x.dataset.url));
    for (const item of items) {
      if (!item?.url || existing.has(item.url)) continue;
      existing.add(item.url);
      const tile = el('article', { className: 'klipy-tile' });
      const button = el('button', { type: 'button', className: 'klipy-tile-button', 'aria-label': `Preview GIF: ${String(item.title || 'Animated GIF').slice(0, 80)}`, dataset: { url: item.url } });
      const pic = el('img', { src: item.url, alt: item.title, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
      pic.addEventListener('error', () => { tile.classList.add('klipy-broken'); button.disabled = true; });
      pic.addEventListener('load', () => tile.classList.add('klipy-loaded'));
      button.append(pic);
      button.addEventListener('click', () => preview(item));
      tile.append(button);
      const info = el('div', { className: 'klipy-tile-caption' });
      info.append(el('span', { className: 'klipy-tile-title', title: item.title }, item.title));
      if (item.license) info.append(el('span', { className: 'klipy-tile-license' }, item.license));
      tile.append(info);
      grid.append(tile);
    }
  }
  function preview(item) {
    if (!safeUrl(item.url)) return;
    selected = item;
    const p = get('klipyPreview'); if (!p) return;
    empty(p); p.hidden = false;
    const image = el('img', { className: 'klipy-preview-anim', src: item.url, alt: item.title || 'Animated GIF preview', decoding: 'async', referrerpolicy: 'no-referrer' });
    const main = el('div', { className: 'klipy-preview-main' }); main.append(image);
    const caption = el('div', { className: 'klipy-preview-description' });
    caption.append(el('strong', {}, item.title || 'Animated GIF'));
    if (item.license) caption.append(el('span', {}, `${item.license}${item.author ? ' · ' + item.author : ''}`));
    if (item.source && safeSource(item.source)) caption.append(el('a', { href: item.source, target: '_blank', rel: 'noopener noreferrer' }, 'View original and license ↗'));
    main.append(caption); p.append(main);
    const actions = el('div', { className: 'klipy-preview-actions' });
    const back = el('button', { type: 'button', className: 'klipy-button-muted' }, 'Back');
    back.addEventListener('click', clearSelection);
    const add = el('button', { type: 'button', className: 'klipy-button-gold' }, 'Add GIF to message');
    add.addEventListener('click', () => addToMessage(item));
    actions.append(back, add); p.append(actions);
    p.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function addToMessage(item) {
    const input = get('body');
    const url = safeUrl(item.url);
    if (!input || !url) return;
    let message = url;
    if (item.source && safeSource(item.source)) message += `\nSource: ${item.source} (${item.license}${item.author ? '; ' + item.author : ''})`;
    const previous = input.value.trim();
    const combined = previous ? `${previous}\n${message}` : message;
    if (combined.length > 10000) { status('Your message is too long to attach this GIF.', 'error'); return; }
    input.value = combined;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    showDraft(item);
    closePicker(); input.focus();
  }
  function showDraft(item) {
    const input = get('body'), form = get('sendform');
    if (!input || !form) return;
    let card = get('klipyDraft');
    if (!card) { card = el('div', { id: 'klipyDraft', className: 'klipy-draft', role: 'status' }); form.before(card); }
    empty(card);
    card.append(el('img', { src: item.url, alt: `Selected GIF: ${item.title}`, referrerpolicy: 'no-referrer' }));
    const meta = el('div', { className: 'klipy-draft-copy' }); meta.append(el('strong', {}, 'GIF ready to send'), el('span', {}, item.title));
    card.append(meta);
    const remove = el('button', { type: 'button', 'aria-label': 'Remove selected GIF', title: 'Remove GIF' }, '×');
    card.append(remove);
    lastDraft = item.url;
    remove.addEventListener('click', () => {
      const sourceLine = input.value.split('\n').find(x => x.trim().startsWith('Source: https://commons.wikimedia.org/wiki/File:')) || '';
      input.value = input.value.split('\n').filter(x => x.trim() !== lastDraft && x !== sourceLine).join('\n').trim();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      hideDraft(); input.focus();
    });
  }
  function hideDraft() { get('klipyDraft')?.remove(); lastDraft = null; }

  async function commonsFetch(uri, signal) {
    // Wikimedia recommends Api-User-Agent for browser clients. Some strict CORS
    // implementations fail on its preflight; retry once with the browser UA.
    try {
      return await fetch(uri.href, { signal, credentials:'omit', headers: { 'Api-User-Agent': 'LuoChatGIF/2.0 (https://luo-chat-luokai25.vercel.app/; creationslous@gmail.com)' } });
    } catch (e) {
      if (e?.name === 'AbortError' || signal.aborted) throw e;
      return fetch(uri.href, { signal, credentials:'omit' });
    }
  }
  async function searchCommons(append, seq, signal, forcedTerm) {
    const term = (forcedTerm || get('klipyQuery').value.trim() || 'animation').slice(0, 70);
    const offset = append ? nextOffset : 0;
    if (!append) { searchTerm = term; nextOffset = 0; }
    const cacheKey = `commons:${term}:${offset}`;
    const stored = cache.get(cacheKey);
    if (stored && Date.now() - stored.at < 180000) return showCommons(stored.value, append, seq);
    const uri = new URL(COMMONS_API);
    const params = { action: 'query', generator: 'search', gsrsearch: `${term} filemime:"image/gif" filesize:<8000`, gsrnamespace: '6', gsrlimit: String(PAGE_SIZE), gsroffset: String(offset), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName', format: 'json', formatversion: '2', origin:'*', maxage: '120', smaxage: '120' };
    for (const [key, value] of Object.entries(params)) uri.searchParams.set(key, value);
    const res = await commonsFetch(uri, signal);
    if (res.status === 429) { const e = new Error('Wikimedia rate limit reached. Please try again later.'); e.limit = true; throw e; }
    if (!res.ok) throw new Error('Commons is unavailable (' + res.status + ')');
    const data = await res.json();
    if (data?.error) throw new Error('Commons search unavailable');
    const value = { items: parseCommons(data), next: Number(data?.continue?.gsroffset) || null };
    cache.set(cacheKey, { value, at: Date.now() });
    while (cache.size > 16) cache.delete(cache.keys().next().value);
    showCommons(value, append, seq);
  }
  function showCommons(result, append, seq) {
    if (seq !== requestId || provider !== 'commons') return;
    nextOffset = result.next;
    draw(result.items, append);
    get('klipyMore').hidden = !nextOffset;
    const count = get('klipyGrid').querySelectorAll('.klipy-tile').length;
    if (!count) { showEmpty(nextOffset ? 'There are no compatible GIFs in these results. Try another category or search.' : 'Try cats, animation, love or another search.'); status('No matching animated GIFs found.', 'empty'); }
    else status(`${count} animated GIF${count === 1 ? '' : 's'} loaded · Tap one to preview`, 'success');
  }
  function safeKLIPY(item) {
    try { const data = item?.file || {}; return safeUrl(data.md?.gif?.url || data.sm?.gif?.url || data.xs?.gif?.url || item.media_formats?.gif?.url, 'klipy'); } catch { return null; }
  }
  async function searchKLIPY(append, seq, signal) {
    if (!klipyKey) throw new Error('KLIPY is not configured');
    if (!append) { searchTerm = get('klipyQuery').value.trim().slice(0, 70); klipyPage = 1; }
    const uri = new URL(`${KLIPY_API}/api/v1/${encodeURIComponent(klipyKey)}/gifs/${searchTerm ? 'search' : 'trending'}`);
    for (const [k, v] of Object.entries({ page: String(klipyPage), per_page: '16', customer_id: clientID, locale: locale(), content_filter:'high' })) uri.searchParams.set(k, v);
    if (searchTerm) uri.searchParams.set('q', searchTerm);
    const response = await fetch(uri.href, { signal, credentials:'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('KLIPY is unavailable (' + response.status + ')');
    const body = await response.json(); const rows = body?.data?.data || body?.results;
    if (!Array.isArray(rows)) throw new Error('Invalid KLIPY response');
    if (seq !== requestId || provider !== 'klipy') return;
    const gifRows = rows.map(x => ({ url: safeKLIPY(x), title: cleanText(x?.title || 'KLIPY GIF'), source: null })).filter(x => x.url);
    draw(gifRows, append); get('klipyMore').hidden = rows.length < 16;
    const count = get('klipyGrid').querySelectorAll('.klipy-tile').length;
    if (!count) showEmpty('Try another search term.');
    status(count ? `${count} animated GIFs loaded · Tap one to preview` : 'No matching GIFs found.', count ? 'success' : 'empty');
  }
  async function search(append = false, forcedTerm) {
    cancelRequest();
    loading = true; controller = new AbortController(); const seq = ++requestId;
    const more = get('klipyMore'); more.hidden = true;
    if (!append) { clearSelection(); skeleton(); }
    else more.disabled = true;
    status(provider === 'commons' ? 'Finding animated GIFs…' : 'Searching KLIPY…', 'loading');
    try {
      if (provider === 'commons') await searchCommons(append, seq, controller.signal, forcedTerm);
      else await searchKLIPY(append, seq, controller.signal);
    } catch (e) {
      if (seq === requestId && e?.name !== 'AbortError') {
        status(e?.limit ? 'Wikimedia is temporarily rate limiting requests.' : 'GIFs could not load right now.', 'error');
        if (!append) showEmpty(e?.limit ? 'The free provider has reached its request limit. Try again later.' : 'Check your internet connection or try another keyword.');
      }
    } finally {
      if (seq === requestId) { loading = false; get('klipyGrid')?.removeAttribute('aria-busy'); more.disabled = false; }
    }
  }
  function renderInChat() {
    const host = get('messages'); if (!host) return;
    const seen = new WeakSet();
    const decorate = () => {
      for (const anchor of host.querySelectorAll('a[href]')) {
        if (seen.has(anchor)) continue;
        seen.add(anchor);
        const gif = safeUrl(anchor.getAttribute('href'));
        if (!gif) continue;
        if (anchor.nextElementSibling?.classList?.contains('klipy-in-chat')) continue;
        const img = el('img', { className: 'klipy-in-chat', src: gif, alt: 'Animated GIF', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
        anchor.insertAdjacentElement('afterend', img);
      }
    };
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return; scheduled = true;
      requestAnimationFrame(() => { scheduled = false; decorate(); });
    });
    observer.observe(host, { childList: true, subtree: true });
    decorate();
  }
  function init() {
    const attach = get('attach'), form = get('sendform');
    if (!attach || !form || get('klipyDialog')) return;
    const launch = el('button', { id: 'openKLIPY', className: 'icon-button klipy-trigger', type: 'button', 'aria-label': 'Browse animated GIFs', title: 'GIFs' }, 'GIF');
    attach.after(launch);
    const dialog = el('dialog', { id: 'klipyDialog', className: 'klipy-dialog', 'aria-labelledby': 'klipyHeading' });
    const head = el('div', { className: 'klipy-head' });
    const heading = el('div', { className: 'klipy-title' }); heading.append(el('span', { className: 'klipy-overline' }, 'LUO CHAT · EXPRESS YOURSELF'), el('h2', { id: 'klipyHeading' }, 'Animated GIFs'));
    head.append(heading);
    const close = el('button', { type: 'button', id: 'klipyClose', className: 'klipy-close', 'aria-label': 'Close GIF picker' }, '×'); head.append(close); dialog.append(head);
    const tabs = el('div', { className: 'klipy-provider-tabs', role: 'tablist', 'aria-label': 'GIF sources' });
    const openTab = el('button', { id: 'klipyCommonsTab', role: 'tab', 'aria-selected': 'true', type: 'button' }, 'Free GIFs');
    const kTab = el('button', { id: 'klipyCommercialTab', role: 'tab', 'aria-selected': 'false', type: 'button', hidden: true }, 'KLIPY'); tabs.append(openTab, kTab); dialog.append(tabs);
    const formSearch = el('form', { id: 'klipySearchForm', role: 'search' });
    const searchInput = el('input', { id: 'klipyQuery', type: 'search', placeholder: 'Search animated GIFs…', 'aria-label': 'Search animated GIFs', maxlength: '70', autocomplete: 'off', enterkeyhint: 'search' });
    formSearch.append(el('label', { for: 'klipyQuery', className: 'sr-only' }, 'Search GIFs'), searchInput, el('button', { type: 'submit' }, 'Search'));
    dialog.append(formSearch);
    const categories = el('div', { id: 'klipyCategories', className: 'klipy-categories', role: 'group', 'aria-label': 'Quick GIF searches' });
    for (const [name, term] of SUGGESTIONS) {
      const b = el('button', { type: 'button', dataset: { category: name }, 'aria-pressed': String(name === 'Discover') }, name);
      b.addEventListener('click', () => activateCategory(name, term)); categories.append(b);
    }
    dialog.append(categories);
    dialog.append(el('p', { id: 'klipyTip', className: 'klipy-tip' }, 'Free animated GIFs from Wikimedia Commons. Tap to preview; licenses and attribution stay with the GIF.'));
    dialog.append(el('p', { id: 'klipyStatus', className: 'klipy-status', role: 'status', 'aria-live': 'polite' }, 'Open GIFs to discover animations.'));
    const previewEl = el('section', { id: 'klipyPreview', className: 'klipy-preview', 'aria-label': 'Selected GIF preview', hidden: true }); dialog.append(previewEl);
    dialog.append(el('div', { id: 'klipyGrid', className: 'klipy-grid', 'aria-label': 'Animated GIF results' }));
    dialog.append(el('button', { id: 'klipyMore', className: 'klipy-more', type: 'button', hidden: true }, 'Load more GIFs'));
    const credits = el('p', { id: 'klipyAttribution', className: 'klipy-attribution' });
    credits.append(el('a', { href: 'https://commons.wikimedia.org/', target: '_blank', rel: 'noopener noreferrer' }, 'Wikimedia Commons · licensing varies')); dialog.append(credits);
    document.body.append(dialog);
    launch.addEventListener('click', openDialog);
    close.addEventListener('click', closePicker);
    dialog.addEventListener('click', event => { if (event.target === dialog) closePicker(); });
    dialog.addEventListener('close', cancelRequest);
    openTab.addEventListener('click', () => setProvider('commons'));
    kTab.addEventListener('click', () => setProvider('klipy'));
    formSearch.addEventListener('submit', event => { event.preventDefault(); setCategory(''); search(false); });
    get('klipyMore').addEventListener('click', () => { if (loading) return; if (provider === 'klipy') klipyPage += 1; search(true, provider === 'commons' ? searchTerm : undefined); });
    const body = get('body'); body?.addEventListener('input', () => { if (lastDraft && !body.value.includes(lastDraft)) hideDraft(); });
    form.addEventListener('submit', () => { setTimeout(() => { if (lastDraft && !get('body')?.value.includes(lastDraft)) hideDraft(); }, 20); });
    renderInChat();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

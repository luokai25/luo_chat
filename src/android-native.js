// Native Android support for the actual Luo Chat application, not a separate
// login screen. No secrets or user-generated message text cross the Android
// bridge for notifications. Shared text is kept in memory until the user
// explicitly chooses a recipient and presses Send in the regular chat.
export function installAndroidHost({
  win, getUser, getChats, openRoom, roomName, setDraft, note
}) {
  const doc = win.document;
  let sharedText = null, epoch = 0, openDialog = null;
  const native = () => typeof win.LuoAndroid?.postMessage === 'function';
  const dispatch = data => {
    if (!native()) return false;
    win.LuoAndroid.postMessage(JSON.stringify(data));
    return true;
  };
  const el = (tag, cls, text) => {
    const item = doc.createElement(tag);
    if (cls) item.className = cls;
    if (text != null) item.textContent = String(text);
    return item;
  };
  function dismiss() {
    if (openDialog?.open) openDialog.close();
    openDialog?.remove();
    openDialog = null;
  }
  function showSharedText() {
    if (!sharedText) return;
    const actor = getUser()?.id;
    if (!actor) {
      note('Sign in to Luo Chat, then choose where to share.');
      return;
    }
    dismiss();
    const dialog = el('dialog', 'wide-dialog luo-android-share');
    const heading = el('h2', '', 'Share into Luo Chat');
    heading.id = 'luo-android-share-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    const sub = el('p', 'muted', 'Choose a conversation. Nothing is sent until you press Send.');
    const preview = el('p', 'luo-native-share-preview', sharedText.slice(0, 240));
    const list = el('div', 'luo-native-share-rooms');
    const rooms = (getChats() || []).filter(c => !!c?.id).slice(0, 75);
    if (!rooms.length) {
      list.append(el('p', 'muted', 'No conversations yet. Find a username in Chats, then share again.'));
    }
    const requestEpoch = epoch;
    const choose = async room => {
      if (requestEpoch !== epoch || getUser()?.id !== actor) return;
      for (const button of list.querySelectorAll('button')) button.disabled = true;
      try {
        await openRoom(room.id);
        if (requestEpoch !== epoch || getUser()?.id !== actor) return;
        const draft = sharedText;
        if (!draft) return;
        setDraft(draft);
        sharedText = null;
        dismiss();
        note('Shared text added as a draft. Review it before sending.');
      } catch {
        if (requestEpoch !== epoch || getUser()?.id !== actor) return;
        for (const button of list.querySelectorAll('button')) button.disabled = false;
        note('That conversation could not be opened. Try again.');
      }
    };
    for (const room of rooms) {
      const label = String(roomName?.(room) || room.title || 'Conversation').slice(0, 85);
      const button = el('button', 'ghost luo-native-share-room', label);
      button.type = 'button';
      button.addEventListener('click', () => choose(room));
      list.append(button);
    }
    const close = el('button', 'ghost', 'Cancel');
    close.type = 'button';
    close.addEventListener('click', () => {
      sharedText = null;
      dismiss();
    });
    dialog.append(heading, sub, preview, list, close);
    doc.body.append(dialog);
    openDialog = dialog;
    dialog.showModal();
  }
  const incoming = event => {
    const raw = event?.detail?.text ?? win.__luoIncomingShare;
    if (typeof raw !== 'string' || !raw.trim()) return;
    sharedText = raw.slice(0, 3000);
    win.__luoIncomingShare = null;
    showSharedText();
  };
  win.addEventListener('luo-android-share', incoming);
  if (typeof win.__luoIncomingShare === 'string') incoming({detail:{text:win.__luoIncomingShare}});

  // Android's back gesture must return from a chat, close sheets and dismiss
  // the keyboard instead of immediately killing the host Activity.
  const goBack = () => {
    const activeDialog = doc.querySelector('dialog[open]');
    if (activeDialog) {
      try { activeDialog.close(); } catch {}
      return 'handled';
    }
    const activeElement = doc.activeElement;
    if (activeElement?.matches?.('input,textarea,[contenteditable="true"]')) {
      activeElement.blur();
      return 'handled';
    }
    const room = doc.getElementById('room');
    if (room?.classList.contains('active')) {
      const back = doc.getElementById('back');
      if (back) { back.click(); return 'handled'; }
    }
    const selected = doc.querySelector('.workspace-nav .tab.active[data-tab]');
    if (selected && selected.dataset.tab !== 'chats') {
      const chats = doc.querySelector('.workspace-nav .tab[data-tab="chats"]');
      if (chats) { chats.click(); return 'handled'; }
    }
    return 'exit';
  };
  win.luoAndroidGoBack = goBack;

  const css = el('style');
  css.id = 'luo-android-host-style';
  css.textContent = [
    '.luo-android-share{border:1px solid #a67a3f;background:linear-gradient(135deg,#201914,#09090b);color:#f9e8c8;max-width:min(95vw,490px);border-radius:18px;padding:20px}',
    '.luo-native-share-preview{border:1px solid #59442f;background:#15120f;border-radius:12px;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:130px;overflow-y:auto}',
    '.luo-native-share-rooms{display:grid;gap:8px;max-height:42vh;overflow:auto;margin:12px 0}',
    '.luo-native-share-room{text-align:start;min-height:46px;border-radius:12px;color:#f6dba7}'
  ].join('\n');
  doc.head.append(css);

  function handleNotificationPermission(event) {
    const button = event.target?.closest?.('#enableNotifications,#requestNotificationAccess');
    if (!button || !native()) return;
    // Avoid showing a broken browser permission prompt within Android WebView.
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatch({type:'notification_permission'});
    const status = doc.getElementById('notificationmsg') || doc.getElementById('access-notifications');
    if (status) status.textContent = 'Check the Android notification permission prompt.';
  }
  doc.addEventListener('click', handleNotificationPermission, true);
  const onPermission = e => {
    const granted = e?.detail?.granted === true;
    for (const id of ['notificationmsg', 'access-notifications']) {
      const status = doc.getElementById(id);
      if (status) status.textContent = granted ?
        'Luo Chat Android notifications allowed while the app is running.' :
        'Android notifications are off. You can change this in app settings.';
    }
  };
  win.addEventListener('luo-native-notification-permission', onPermission);

  return {
    isNative: native,
    accountReady() { if (sharedText) showSharedText(); },
    signedOut() { epoch++; sharedText = null; win.__luoIncomingShare = null; dismiss(); },
    dispose() {
      epoch++; dismiss(); sharedText = null;
      win.removeEventListener('luo-android-share', incoming);
      win.removeEventListener('luo-native-notification-permission', onPermission);
      doc.removeEventListener('click', handleNotificationPermission, true);
      if (win.luoAndroidGoBack === goBack) delete win.luoAndroidGoBack;
      css.remove();
    }
  };
}

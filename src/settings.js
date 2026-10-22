// Settings responses stay bound to the account generation that started them.
export function installSettings({ win, db, $, note, getUser, getProfile, refreshProfile, clearComposer }) {
  const doc = win.document, defaults = { wallpaper: "default", message_bubble: "rounded", auto_download_media: false, focus_mode: false };
  const alertDefaults = { direct_messages: true, group_messages: true, system_notifications: true, quiet_hours_enabled: false, quiet_hours_start: "22:00", quiet_hours_end: "08:00", time_zone: "UTC" };
  let appearance = { ...defaults }, alerts = { ...alertDefaults }, ready = false, category = "profile", generation = 0;
  const sessionScope = () => {
    const actor = getUser()?.id, request = generation;
    return () => !!actor && getUser()?.id === actor && request === generation;
  };
  const resetControls = () => {
    for (const id of ['saveProfileFrame','savePresenceAudience','saveAppearance','saveNotifications','changeEmail','signOutOthers','refreshStorage']) $(id).disabled = false;
  };
  const checked = (r) => {
    if (r.error) throw Error(r.error.message);
    return r.data;
  };
  const localKey = (name) => "luo-chat-setting-" + getUser()?.id + "-" + name;
  const read = (name) => {
    try {
      return win.localStorage.getItem(localKey(name));
    } catch {
      return null;
    }
  };
  const write = (name, value) => {
    try {
      win.localStorage.setItem(localKey(name), value);
      return true;
    } catch {
      note("This browser could not save the device preference.");
      return false;
    }
  };
  function choose(id) {
    category = id;
    for (const panel of doc.querySelectorAll(".settings-panel")) panel.classList.toggle("hidden", panel.id !== "settings-" + id);
    for (const b of doc.querySelectorAll("[data-setting]")) {
      b.classList.toggle("active", b.dataset.setting === id);
      b.setAttribute("aria-current", b.dataset.setting === id ? "page" : "false");
    }
  }
  for (const b of doc.querySelectorAll("[data-setting]")) b.onclick = () => {
    if ($("settingsSearch").value) {
      $("settingsSearch").value = "";
      search();
    }
    choose(b.dataset.setting);
  };
  $("editProfileShortcut").onclick = () => {
    $("presencePeople").value = "";
    $("presenceAudienceStatus").textContent = "";
    $("settingsSearch").value = "";
    search();
    choose("profile");
    $("editname").focus();
  };
  function search() {
    const q = $("settingsSearch").value.trim().toLowerCase();
    let matches = 0;
    for (const b of doc.querySelectorAll("[data-setting]")) {
      const panel = $("settings-" + b.dataset.setting), match = !q || (b.textContent + " " + panel.textContent).toLowerCase().includes(q);
      b.hidden = !match;
      panel.classList.toggle("hidden", q ? !match : panel.id !== "settings-" + category);
      if (match) matches++;
    }
    $("settingsNoResults").classList.toggle("hidden", !!matches);
  }
  $("settingsSearch").oninput = search;
  choose("profile");
  function profile() {
    const p = getProfile();
    if (!p) return;
    $("bioCount").textContent = $("bio").value.length + " / 240";
    $("settingsAvatar").dataset.frame = p.profile_frame || "none";
    $("myAvatar").dataset.frame = p.profile_frame || "none";
    $("profileFrame").value = p.profile_frame || "none";
    $("settingsAvatar").replaceChildren();
    if (p.avatar_url && /^https:\/\//.test(p.avatar_url)) {
      const img = doc.createElement("img");
      img.src = p.avatar_url;
      img.alt = "";
      $("settingsAvatar").append(img);
    } else $("settingsAvatar").textContent = (p.display_name || p.username || "L").slice(0, 1).toUpperCase();
    $("viewAvatar").disabled = $("removeAvatar").disabled = !p.avatar_url;
  }
  $("saveProfileFrame").onclick = async () => {
    const active = sessionScope(), frame = $("profileFrame").value;
    if (!active()) return;
    $("saveProfileFrame").disabled = true;
    try {
      checked(await db.rpc("set_my_chat_frame", { frame_name: frame }));
      if (!active()) return;
      getProfile().profile_frame = frame;
      profile();
      note("Profile frame saved.");
    } catch (e) { if (active()) note(e.message); }
    finally { if (active()) $("saveProfileFrame").disabled = false; }
  };
  $("presenceAudienceForm").onsubmit = async (e) => {
    e.preventDefault();
    const active = sessionScope();
    if (!active()) return;
    $("savePresenceAudience").disabled = true;
    try {
      const names = [...new Set($("presencePeople").value.split(/[,\n]+/).map((s) => s.trim().replace(/^@/, "").toLowerCase()).filter(Boolean))];
      checked(await db.rpc("set_my_chat_presence_audience", { audience_name: $("presenceAudience").value, viewer_usernames: names }));
      if (!active()) return;
      $("presenceAudienceStatus").textContent = "Your presence audience is enforced on the server.";
    } catch (e2) {
      if (active()) $("presenceAudienceStatus").textContent = e2.message;
    } finally {
      if (active()) $("savePresenceAudience").disabled = false;
    }
  };
  async function loadPresence() {
    const actor = getUser()?.id, active = sessionScope();
    if (!active()) return;
    const row = checked(await db.from("chat_presence_rules").select("audience,viewer_ids").eq("user_id", actor).maybeSingle());
    if (!active()) return;
    $("presenceAudience").value = row?.audience || "everyone";
    $("presencePeople").value = "";
    if (row?.viewer_ids?.length) {
      const people = checked(await db.from("profiles").select("username").in("id", row.viewer_ids));
      if (active()) $("presencePeople").value = (people || []).map((p) => p.username).join(", ");
    }
  }
  $("bio").addEventListener("input", () => $("bioCount").textContent = $("bio").value.length + " / 240");
  $("aboutPreset").onchange = () => {
    if (!$("aboutPreset").value) return;
    $("bio").value = $("aboutPreset").value;
    $("bio").dispatchEvent(new win.Event("input"));
    $("profilemsg").textContent = "Choose Save profile to publish your About.";
  };
  $("chooseAvatar").onclick = () => $("avatarFile").click();
  $("closeAvatar").onclick = () => $("avatarDialog").close();
  $("viewAvatar").onclick = () => {
    const url = getProfile()?.avatar_url;
    if (!url || !/^https:\/\//.test(url)) return;
    $("avatarFull").src = url;
    $("avatarDialog").showModal();
  };
  $("removeAvatar").onclick = async () => {
    if (!getUser() || !win.confirm("Remove your profile photo?")) return;
    const actor = getUser().id, old = getProfile()?.avatar_url, active = sessionScope();
    $("removeAvatar").disabled = true;
    try {
      checked(await db.rpc("set_my_chat_avatar", { avatar_path: null }));
      if (!active()) return;
      getProfile().avatar_url = null;
      refreshProfile();
      profile();
      const marker = "/storage/v1/object/public/avatars/";
      if (old?.includes(marker)) {
        const path = old.split(marker)[1];
        if (path.startsWith(actor + "/")) {
          const r = await db.storage.from("avatars").remove([path]);
          if (!active()) return;
          if (r.error) return note("Photo removed from your profile. The old upload could not be deleted; retry account cleanup later.");
        }
      }
      if (active()) note("Profile photo removed.");
    } catch (e) {
      if (active()) note(e.message);
    } finally {
      if (active()) $("removeAvatar").disabled = !getProfile()?.avatar_url;
    }
  };
  function applyAppearance() {
    doc.body.dataset.wallpaper = appearance.wallpaper;
    doc.body.dataset.bubbles = appearance.message_bubble;
    $("chatWallpaper").value = appearance.wallpaper;
    $("bubbleShape").value = appearance.message_bubble;
    $("autoMedia").checked = !!appearance.auto_download_media;
    $("focusMode").checked = !!appearance.focus_mode;
    preview();
  }
  function preview() {
    $("appearancePreview").dataset.wallpaper = $("chatWallpaper").value;
    $("appearancePreview").dataset.bubbles = $("bubbleShape").value;
  }
  $("chatWallpaper").onchange = preview;
  $("bubbleShape").onchange = preview;
  $("appearanceForm").onsubmit = async (e) => {
    e.preventDefault();
    const actor = getUser()?.id, active = sessionScope();
    if (!active()) return;
    const values = { wallpaper: $("chatWallpaper").value, message_bubble: $("bubbleShape").value, auto_download_media: $("autoMedia").checked, focus_mode: $("focusMode").checked };
    if (!["default", "plain", "grid"].includes(values.wallpaper) || !["rounded", "square", "minimal"].includes(values.message_bubble)) return;
    $("saveAppearance").disabled = true;
    try {
      checked(await db.from("user_chat_settings").upsert({ user_id: actor, ...values, updated_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "user_id" }));
      if (!active()) return;
      appearance = values;
      applyAppearance();
      $("appearanceStatus").textContent = "Saved across devices. Image previews apply as messages load.";
    } catch (e2) {
      if (active()) $("appearanceStatus").textContent = e2.message;
    } finally {
      if (active()) $("saveAppearance").disabled = false;
    }
  };
  function composeHelp() {
    $("composerHelp").textContent = $("enterToSend").checked ? "Press Enter to send. Use Shift plus Enter for a new line." : "Press Enter for a new line. Use the Send message button to send.";
  }
  $("enterToSend").onchange = () => {
    write("enter-send", $("enterToSend").checked ? "on" : "off");
    composeHelp();
  };
  $("notificationPreview").onchange = () => write("notification-preview", $("notificationPreview").checked ? "on" : "off");
  function applyAlerts() {
    $("notifyDirect").checked = alerts.direct_messages;
    $("notifyGroups").checked = alerts.group_messages;
    $("quietEnabled").checked = alerts.quiet_hours_enabled;
    $("quietStart").value = (alerts.quiet_hours_start || "22:00").slice(0, 5);
    $("quietEnd").value = (alerts.quiet_hours_end || "08:00").slice(0, 5);
    $("quietZone").value = alerts.time_zone || "UTC";
    $("quietStart").disabled = $("quietEnd").disabled = !alerts.quiet_hours_enabled;
  }
  $("quietEnabled").onchange = () => {
    $("quietStart").disabled = $("quietEnd").disabled = !$("quietEnabled").checked;
  };
  $("notificationPrefsForm").onsubmit = async (e) => {
    e.preventDefault();
    const actor = getUser()?.id, active = sessionScope();
    if (!active()) return;
    const zone = $("quietZone").value.trim();
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone }).format(/* @__PURE__ */ new Date());
    } catch {
      return $("notificationPrefsStatus").textContent = "Use a valid time zone, for example Europe/London or America/New_York.";
    }
    const start = $("quietStart").value, end = $("quietEnd").value, quiet = $("quietEnabled").checked;
    const direct = $("notifyDirect").checked, groups = $("notifyGroups").checked;
    if (quiet && (!start || !end || start === end)) return $("notificationPrefsStatus").textContent = "Choose different quiet-hour start and end times.";
    $("saveNotifications").disabled = true;
    try {
      checked(await db.rpc("set_my_notification_preferences", { new_direct_messages: direct, new_group_messages: groups, new_system_notifications: alerts.system_notifications, new_quiet_hours_enabled: quiet, new_quiet_hours_start: start || null, new_quiet_hours_end: end || null, new_time_zone: zone }));
      if (!active()) return;
      alerts = { ...alerts, direct_messages: direct, group_messages: groups, quiet_hours_enabled: quiet, quiet_hours_start: start, quiet_hours_end: end, time_zone: zone };
      applyAlerts();
      $("notificationPrefsStatus").textContent = "Alert preferences saved across devices.";
    } catch (e2) {
      if (active()) $("notificationPrefsStatus").textContent = e2.message;
    } finally {
      if (active()) $("saveNotifications").disabled = false;
    }
  };
  function quietNow(now = /* @__PURE__ */ new Date()) {
    if (!alerts.quiet_hours_enabled) return false;
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: alerts.time_zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now), minute = Number(parts.find((x) => x.type === "hour").value) * 60 + Number(parts.find((x) => x.type === "minute").value), toMinutes = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)), start = toMinutes(alerts.quiet_hours_start), end = toMinutes(alerts.quiet_hours_end);
      return start > end ? minute >= start || minute < end : minute >= start && minute < end;
    } catch {
      return true;
    }
  }
  $("changeEmailForm").onsubmit = async (e) => {
    e.preventDefault();
    const active = sessionScope();
    if (!active()) return;
    const email = $("newEmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return $("emailChangeStatus").textContent = "Enter a valid email address.";
    if (email.toLowerCase() === getUser()?.email?.toLowerCase()) return $("emailChangeStatus").textContent = "That is already your current email.";
    $("changeEmail").disabled = true;
    try {
      checked(await db.auth.updateUser({ email }, { emailRedirectTo: win.location.origin + "/?auth=confirmed" }));
      if (!active()) return;
      $("newEmail").value = "";
      $("emailChangeStatus").textContent = "Email change requested. Confirm the email links; your current address remains until verification completes.";
    } catch (e2) {
      if (active()) $("emailChangeStatus").textContent = e2.message;
    } finally {
      if (active()) $("changeEmail").disabled = false;
    }
  };
  $("signOutOthers").onclick = async () => {
    const active = sessionScope();
    if (!active()) return;
    if (!win.confirm("Sign out your other devices? They will need to sign in again.")) return;
    $("signOutOthers").disabled = true;
    try {
      checked(await db.auth.signOut({ scope: "others" }));
      if (!active()) return;
      $("sessionStatus").textContent = "Other refresh sessions revoked. Existing access tokens may work until they expire.";
    } catch (e) {
      if (active()) $("sessionStatus").textContent = e.message;
    } finally {
      if (active()) $("signOutOthers").disabled = false;
    }
  };
  $("clearDrafts").onclick = () => {
    const actor = getUser()?.id;
    if (!actor || !win.confirm("Clear all unsent text drafts for this account on this browser?")) return;
    try {
      const prefix = "luo-chat-draft-" + actor + "-", keys = [];
      for (let i = 0; i < win.localStorage.length; i++) {
        const k = win.localStorage.key(i);
        if (k?.startsWith(prefix)) keys.push(k);
      }
      for (const k of keys) win.localStorage.removeItem(k);
      clearComposer();
      $("draftStatus").textContent = keys.length + " local draft" + (keys.length === 1 ? "" : "s") + " cleared.";
    } catch {
      $("draftStatus").textContent = "This browser could not clear drafts.";
    }
  };
  $("refreshStorage").onclick = async () => {
    const actor = getUser()?.id, active = sessionScope();
    if (!active()) return;
    $("refreshStorage").disabled = true;
    $("storageSummary").textContent = "Calculating\u2026";
    $("storageBreakdown").replaceChildren();
    let count = 0, bytes = 0, cursor = null;
    const kinds = {};
    try {
      for (; ; ) {
        let q = db.from("chat_attachments").select("id,byte_size,mime_type").eq("uploader_id", actor).order("id", { ascending: true }).limit(500);
        if (cursor) q = q.gt("id", cursor);
        const rows = checked(await q) || [];
        if (!active()) return;
        for (const item of rows) {
          const size = Number(item.byte_size) || 0;
          count++;
          bytes += size;
          const kind = item.mime_type?.split("/")[0] || "other";
          kinds[kind] = (kinds[kind] || 0) + size;
        }
        if (rows.length < 500) break;
        cursor = rows.at(-1).id;
      }
      if (!active()) return;
      $("storageSummary").textContent = count + " shared file" + (count === 1 ? "" : "s") + " \xB7 " + (bytes / 1048576).toFixed(2) + " MB";
      for (const [kind, size] of Object.entries(kinds)) {
        const row = doc.createElement("p");
        row.textContent = kind + " \xB7 " + (size / 1048576).toFixed(2) + " MB";
        $("storageBreakdown").append(row);
      }
    } catch (e) {
      if (active()) $("storageSummary").textContent = e.message || "Could not calculate usage.";
    } finally {
      if (active()) $("refreshStorage").disabled = false;
    }
  };
  async function accountReady() {
    const actor = getUser()?.id;
    if (!actor) return;
    ready = false;
    const request = ++generation;
    resetControls();
    profile();
    loadPresence().catch((e) => { if (request === generation && getUser()?.id === actor) $("presenceAudienceStatus").textContent = e.message; });
    $("enterToSend").checked = read("enter-send") !== "off";
    composeHelp();
    $("notificationPreview").checked = read("notification-preview") === "on";
    try {
      const [chat, notifications] = await Promise.all([db.from("user_chat_settings").select("wallpaper,message_bubble,auto_download_media,focus_mode").eq("user_id", actor).maybeSingle(), db.from("user_notification_preferences").select("direct_messages,group_messages,system_notifications,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,time_zone").eq("user_id", actor).maybeSingle()]);
      if (getUser()?.id !== actor || request !== generation) return;
      const a = checked(chat), n = checked(notifications);
      appearance = { ...defaults, ...a };
      if (!["default", "plain", "grid"].includes(appearance.wallpaper)) appearance.wallpaper = "default";
      if (!["rounded", "square", "minimal"].includes(appearance.message_bubble)) appearance.message_bubble = "rounded";
      alerts = { ...alertDefaults, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", ...n };
      applyAppearance();
      applyAlerts();
      ready = true;
    } catch (e) {
      if (request !== generation || getUser()?.id !== actor) return;
      $("notificationPrefsStatus").textContent = "Preferences could not load; browser alerts paused. " + e.message;
      $("appearanceStatus").textContent = "Could not load saved appearance.";
    }
  }
  function signedOut() {
    generation++;
    resetControls();
    ready = false;
    alerts = { ...alertDefaults };
    applyAlerts();
    $("notificationPreview").checked = false;
    $("enterToSend").checked = true;
    for (const id of ["edituser", "editname", "bio"]) $(id).value = "";
    $("myname").textContent = "";
    $("myemail").textContent = "";
    $("myAvatar").removeAttribute("src");
    $("myAvatar").classList.add("hidden");
    appearance = { ...defaults };
    applyAppearance();
    $("settingsAvatar").replaceChildren();
    $("avatarFull").removeAttribute("src");
    $("newEmail").value = "";
    for (const id of ["storageSummary", "storageBreakdown", "emailChangeStatus", "sessionStatus", "appearanceStatus", "notificationPrefsStatus", "draftStatus"]) $(id).replaceChildren();
    $("presencePeople").value = "";
    $("presenceAudienceStatus").textContent = "";
    $("settingsSearch").value = "";
    search();
    choose("profile");
  }
  return { accountReady, signedOut, refreshProfile: profile, onTab(id) {
    if (id === "profile") profile();
  }, enterToSend: () => read("enter-send") !== "off", shouldPreview: () => ready && !!appearance.auto_download_media, allowNotification: (room) => ready && !appearance.focus_mode && !quietNow() && (room.kind === "group" ? alerts.group_messages : alerts.direct_messages), showNotificationPreview: () => read("notification-preview") === "on", quietNow };
}

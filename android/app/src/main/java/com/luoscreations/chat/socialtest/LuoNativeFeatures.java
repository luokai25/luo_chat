package com.luoscreations.chat.socialtest;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.webkit.WebView;
import android.webkit.URLUtil;
import android.widget.Toast;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.util.Collections;
import java.util.Locale;

/**
 * Minimal Android host capabilities, restricted to the packaged Luo Chat origin.
 * The bridge never accepts passwords, account identifiers, notification previews,
 * token/cookie strings or arbitrary filesystem paths from JavaScript.
 */
final class LuoNativeFeatures {
    static final String ORIGIN = "https://luo-chat-luokai25.vercel.app";
    static final int NOTIFICATION_PERMISSION_CODE = 6120;
    private static final String CHANNEL_ID = "luo_chat_activity_generic_v1";
    private final Activity activity;
    private final WebView view;
    private int notificationId = 1000;
    private boolean foreground = true;

    LuoNativeFeatures(Activity activity, WebView view) {
        this.activity = activity;
        this.view = view;
        initNotificationChannel();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(view, "LuoAndroid",
                Collections.singleton(ORIGIN),
                (web, message, sourceOrigin, isMainFrame, replyProxy) -> {
                    if (!isMainFrame || !ORIGIN.equals(sourceOrigin.toString())) return;
                    final String data = message.getData();
                    if (data == null || data.length() > 4096) return;
                    activity.runOnUiThread(() -> handleMessage(data));
                });
        }
    }

    boolean available() {
        return WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
    }

    void setForeground(boolean value) {
        foreground = value;
    }

    void permissionResult() {
        final boolean granted = notificationsAllowed();
        view.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('luo-native-notification-permission',{detail:{granted:"
            + granted + "}}))", null);
    }

    private void handleMessage(String source) {
        try {
            JSONObject data = new JSONObject(source);
            String type = data.optString("type", "");
            switch (type) {
                case "notification_permission":
                    // Called only by the explicit Notifications settings button.
                    if (Build.VERSION.SDK_INT >= 33
                            && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                                != PackageManager.PERMISSION_GRANTED) {
                        activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},
                                NOTIFICATION_PERMISSION_CODE);
                    } else {
                        permissionResult();
                    }
                    break;
                case "notification":
                    // Suppress while visible. No user-generated text or sender identity
                    // ever leaves the encrypted transport and enters the lock screen.
                    if (!foreground && notificationsAllowed()) showGenericNotification();
                    break;
                case "download":
                    // A user-initiated download must use an HTTPS signed-media URL.
                    String url = data.optString("url", "");
                    if (permittedDownload(Uri.parse(url))) enqueueDownload(url,
                        data.optString("filename", ""));
                    break;
                default:
                    break;
            }
        } catch (Exception ignored) {
            // Untrusted or invalid messages are ignored without logging content.
        }
    }

    private boolean notificationsAllowed() {
        if (Build.VERSION.SDK_INT >= 33
                && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager manager = (NotificationManager) activity.getSystemService(Activity.NOTIFICATION_SERVICE);
        return manager != null && manager.areNotificationsEnabled();
    }

    private void initNotificationChannel() {
        NotificationManager manager =
            (NotificationManager) activity.getSystemService(Activity.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Luo Chat activity", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Privacy-safe alerts while Luo Chat is running");
        channel.enableLights(true);
        channel.setLightColor(Color.rgb(209, 167, 87));
        channel.enableVibration(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(channel);
    }

    private void showGenericNotification() {
        NotificationManager manager =
            (NotificationManager) activity.getSystemService(Activity.NOTIFICATION_SERVICE);
        if (manager == null) return;
        android.content.Intent launch = new Intent(activity, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pi = android.app.PendingIntent.getActivity(
            activity, 0, launch,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(activity, CHANNEL_ID)
            .setSmallIcon(com.luoscreations.chat.socialtest.R.drawable.luo_icon)
            .setContentTitle("Luo Chat")
            .setContentText("You have new activity")
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .build();
        manager.notify(notificationId++, notification);
        if (notificationId > 1100) notificationId = 1000;
    }

    static boolean permittedDownload(Uri uri) {
        if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
        if (uri.getUserInfo() != null || uri.getPort() != -1 && uri.getPort() != 443) return false;
        String host = uri.getHost();
        if (host == null) return false;
        return host.equalsIgnoreCase("byjixqwpjvsgmqilmzbm.supabase.co")
            || host.equalsIgnoreCase("luo-chat-luokai25.vercel.app");
    }

    void enqueueDownload(String url, String requestedName) {
        Uri uri;
        try { uri = Uri.parse(url); }
        catch (Exception e) { return; }
        if (!permittedDownload(uri)) return;
        try {
            String fallback = URLUtil.guessFileName(url, null, null);
            String name = cleanName(requestedName.isEmpty() ? fallback : requestedName);
            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setTitle("Luo Chat · " + name);
            request.setDescription("Saved from Luo Chat");
            request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= 29) {
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            } else {
                // Pre-Android 10 stays in this app's files, avoiding legacy storage permission.
                request.setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, name);
            }
            DownloadManager manager = (DownloadManager) activity.getSystemService(Activity.DOWNLOAD_SERVICE);
            if (manager == null) throw new IllegalStateException("Download service unavailable");
            manager.enqueue(request);
            Toast.makeText(activity, "Download started", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(activity, "Could not download this file. Try Share or Open.", Toast.LENGTH_LONG).show();
        }
    }

    private static String cleanName(String input) {
        String sanitized = input.replaceAll("[^a-zA-Z0-9._ -]", "_").trim();
        sanitized = sanitized.replaceAll("^\\.+", "");
        if (sanitized.length() > 90) sanitized = sanitized.substring(0, 90);
        return sanitized.isEmpty() || sanitized.equals(".") ? "luo-chat-download" : sanitized;
    }
}

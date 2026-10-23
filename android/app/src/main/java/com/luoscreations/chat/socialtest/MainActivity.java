package com.luoscreations.chat.socialtest;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.view.Gravity;
import android.webkit.WebView;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.RenderProcessGoneDetail;
import android.widget.Toast;

import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONObject;

/**
 * Luo Chat Social Test APK: deliberately embeds reviewed GitHub-built assets.
 *
 * WebViewAssetLoader serves HTML/JS/CSS/assets under the official HTTPS origin,
 * allowing existing Supabase Edge Function origin checks to work without
 * relaxing CORS. All non-/api first-party files come ONLY from the APK, never
 * a mixed remote build. Internet is used only for existing authenticated APIs,
 * media, and explicitly opened third-party services.
 *
 * Does NOT bypass Play Protect or issue privileged Supabase credentials.
 */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://luo-chat-luokai25.vercel.app";
    private static final String HOST = "luo-chat-luokai25.vercel.app";
    private static final int FILE_CHOOSER_CODE = 6101;
    private static final int MEDIA_PERMISSION_CODE = 6102;

    private WebView web;
    private WebViewAssetLoader assets;
    private LuoNativeFeatures nativeFeatures;
    private FrameLayout root;
    private View fullscreenVideo;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private boolean webReady = false;
    private String incomingSharedText;
    private ValueCallback<Uri[]> pendingFiles;
    private PermissionRequest pendingMediaPermission;
    private String[] pendingMediaResources;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(10, 9, 12));
        getWindow().setNavigationBarColor(Color.rgb(10, 9, 12));

        assets = new WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .setHttpAllowed(false)
            .addPathHandler("/", new PackagedAssets())
            .build();

        // Service Worker fetches must use the same immutable packaged assets.
        // Without this they can accidentally load an older Vercel web bundle.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(
                new ServiceWorkerClientCompat() {
                    @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                        return intercept(request.getUrl());
                    }
                }
            );
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(8, 8, 9));
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setGeolocationEnabled(false);
        settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true);
        android.webkit.CookieManager.getInstance().setAcceptCookie(true);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        nativeFeatures = new LuoNativeFeatures(this, web);
        web.setDownloadListener((url,agent,disposition,mime,length) -> {
            if (url == null) return;
            if (LuoNativeFeatures.permittedDownload(Uri.parse(url)))
                nativeFeatures.enqueueDownload(url, android.webkit.URLUtil.guessFileName(url, disposition, mime));
            else if (url.startsWith("https://")) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
                catch (ActivityNotFoundException ignored) { showMessage("No application can open that download."); }
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return intercept(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isFirstParty(uri)) return false;
                if (!request.isForMainFrame()) return false;
                if ("https".equalsIgnoreCase(uri.getScheme()) || "mailto".equalsIgnoreCase(uri.getScheme())
                    || "tel".equalsIgnoreCase(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException ex) {
                        Toast.makeText(MainActivity.this, "No application can open this link.", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // A crashed Android System WebView must not terminate Luo Chat's
                // entire Activity. No passwords, tokens or page contents are logged.
                if (web == view) web = null;
                view.destroy();
                renderSafeRecoveryScreen();
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (url.startsWith(ORIGIN + "/")) {
                    webReady = true;
                    deliverIncomingShare();
                }
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                Toast.makeText(MainActivity.this, "Secure connection failed. Nothing was sent.", Toast.LENGTH_LONG).show();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                        FileChooserParams params) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null);
                pendingFiles = callback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, FILE_CHOOSER_CODE);
                    return true;
                } catch (ActivityNotFoundException ex) {
                    pendingFiles = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "Install a file picker to select media.", Toast.LENGTH_LONG).show();
                    return true;
                }
            }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenVideo != null) { callback.onCustomViewHidden(); return; }
                fullscreenVideo = view;
                fullscreenCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
                root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
            @Override public void onHideCustomView() { hideFullscreenVideo(); }
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> askForMediaPermission(request));
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (pendingMediaPermission == request) {
                        pendingMediaPermission = null;
                        pendingMediaResources = null;
                    }
                });
            }
        });
        root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        handleIncomingShare(getIntent());
        web.loadUrl(ORIGIN + "/");
    }

    private static boolean isFirstParty(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
            && HOST.equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private WebResourceResponse intercept(Uri uri) {
        if (!isFirstParty(uri)) return null;
        // The website's same-origin telemetry API is backed by Vercel Functions,
        // not bundled assets. Those requests may continue to reach the website.
        if (uri.getPath() != null && uri.getPath().startsWith("/api/")) return null;
        return assets.shouldInterceptRequest(uri);
    }

    private final class PackagedAssets implements WebViewAssetLoader.PathHandler {
        @Override public WebResourceResponse handle(String rawPath) {
            String name = rawPath == null ? "" : rawPath;
            if (name.isEmpty() || name.equals("/")) name = "index.html";
            // Never allow a missing asset to fall back to an unrelated production
            // bundle. Disallow path traversal even after URI normalization.
            if (name.startsWith("/") || name.contains("..") || name.contains("\\")
                || name.indexOf('\0') >= 0) return unavailable();
            try {
                InputStream stream = getAssets().open(name);
                WebResourceResponse response = new WebResourceResponse(mime(name), "UTF-8", stream);
                response.setResponseHeaders(java.util.Collections.singletonMap("Cache-Control", "no-store"));
                return response;
            } catch (IOException ex) {
                return unavailable();
            }
        }
    }

    private static WebResourceResponse unavailable() {
        return new WebResourceResponse(
            "text/plain", "UTF-8", 404, "Not Found",
            java.util.Collections.singletonMap("Cache-Control", "no-store"),
            new ByteArrayInputStream("Packaged test asset missing".getBytes(java.nio.charset.StandardCharsets.UTF_8))
        );
    }

    private static String mime(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".gif")) return "image/gif";
        if (p.endsWith(".mp4")) return "video/mp4";
        if (p.endsWith(".webm")) return "video/webm";
        if (p.endsWith(".ogg")) return "audio/ogg";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private void askForMediaPermission(PermissionRequest request) {
        if (!ORIGIN.equals(request.getOrigin().toString())) {
            request.deny();
            return;
        }
        List<String> resources = new ArrayList<>();
        List<String> android = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                resources.add(resource);
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
                    android.add(Manifest.permission.RECORD_AUDIO);
            } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                resources.add(resource);
                if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
                    android.add(Manifest.permission.CAMERA);
            } else {
                request.deny();
                return;
            }
        }
        if (resources.isEmpty()) { request.deny(); return; }
        if (pendingMediaPermission != null && pendingMediaPermission != request) pendingMediaPermission.deny();
        if (android.isEmpty()) {
            request.grant(resources.toArray(new String[0]));
        } else {
            pendingMediaPermission = request;
            pendingMediaResources = resources.toArray(new String[0]);
            requestPermissions(android.toArray(new String[0]), MEDIA_PERMISSION_CODE);
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(requestCode, permissions, grants);
        if (requestCode == LuoNativeFeatures.NOTIFICATION_PERMISSION_CODE) {
            if (nativeFeatures != null) nativeFeatures.permissionResult();
            return;
        }
        if (requestCode != MEDIA_PERMISSION_CODE) return;
        PermissionRequest previous = pendingMediaPermission;
        String[] resources = pendingMediaResources;
        pendingMediaPermission = null;
        pendingMediaResources = null;
        if (previous == null || resources == null) return;
        boolean permitted = grants.length > 0;
        for (int decision : grants) if (decision != PackageManager.PERMISSION_GRANTED) permitted = false;
        if (permitted) previous.grant(resources);
        else previous.deny();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_CODE && pendingFiles != null) {
            ValueCallback<Uri[]> callback = pendingFiles;
            pendingFiles = null;
            callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
        }
    }

    private void renderSafeRecoveryScreen() {
        if (root == null) {
            root = new FrameLayout(this);
            setContentView(root);
        }
        root.removeAllViews();
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(28, 28, 28, 28);
        layout.setBackgroundColor(Color.rgb(10, 9, 12));
        TextView title = new TextView(this);
        title.setText("Luo Chat needs to reopen");
        title.setTextColor(Color.rgb(244, 211, 155));
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        TextView explanation = new TextView(this);
        explanation.setText("Android stopped the chat display. Your messages are stored on the server. Reopen Luo Chat to restore the app.");
        explanation.setTextColor(Color.rgb(213, 202, 184));
        explanation.setTextSize(15);
        explanation.setGravity(Gravity.CENTER);
        explanation.setPadding(0, 20, 0, 26);
        Button retry = new Button(this);
        retry.setAllCaps(false);
        retry.setText("Reopen Luo Chat");
        retry.setOnClickListener(v -> recreate());
        layout.addView(title);
        layout.addView(explanation);
        layout.addView(retry);
        root.addView(layout, new FrameLayout.LayoutParams(-1, -1));
    }

    private void showMessage(String text) {
        Toast.makeText(this, text, Toast.LENGTH_LONG).show();
    }

    private void hideFullscreenVideo() {
        if (fullscreenVideo == null) return;
        root.removeView(fullscreenVideo);
        fullscreenVideo = null;
        root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
    }

    private void handleIncomingShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        if (!"text/plain".equals(intent.getType())) return;
        String shared = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (shared == null || shared.isEmpty()) return;
        incomingSharedText = shared.length() > 3000 ? shared.substring(0, 3000) : shared;
        deliverIncomingShare();
    }

    private void deliverIncomingShare() {
        if (!webReady || web == null || incomingSharedText == null) return;
        String safe = JSONObject.quote(incomingSharedText);
        incomingSharedText = null;
        web.evaluateJavascript("window.__luoIncomingShare=" + safe + ";window.dispatchEvent(new CustomEvent('luo-android-share',{detail:{text:window.__luoIncomingShare}}));", null);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingShare(intent);
    }

    @Override protected void onResume() {
        super.onResume();
        if (nativeFeatures != null) nativeFeatures.setForeground(true);
    }

    @Override protected void onPause() {
        if (nativeFeatures != null) nativeFeatures.setForeground(false);
        super.onPause();
    }

    @Override public void onBackPressed() {
        if (fullscreenVideo != null) { hideFullscreenVideo(); return; }
        if (web == null) { super.onBackPressed(); return; }
        // Web SPA tabs do not add history entries. Ask the authenticated UI
        // to close its modal / room before Android leaves the app.
        web.evaluateJavascript("window.luoAndroidGoBack ? window.luoAndroidGoBack() : 'exit'", result -> {
            if (result != null && result.contains("handled")) return;
            if (web != null && web.canGoBack()) web.goBack();
            else MainActivity.super.onBackPressed();
        });
    }

    @Override protected void onDestroy() {
        if (fullscreenVideo != null) hideFullscreenVideo();
        if (pendingFiles != null) {
            pendingFiles.onReceiveValue(null);
            pendingFiles = null;
        }
        if (pendingMediaPermission != null) {
            pendingMediaPermission.deny();
            pendingMediaPermission = null;
        }
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}

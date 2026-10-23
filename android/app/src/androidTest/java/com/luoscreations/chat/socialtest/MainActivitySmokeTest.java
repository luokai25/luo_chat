package com.luoscreations.chat.socialtest;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class MainActivitySmokeTest {
    private static WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView)view;
        if (view instanceof ViewGroup) {
            ViewGroup group=(ViewGroup)view;
            for (int i=0;i<group.getChildCount();i++) {
                WebView result=findWeb(group.getChildAt(i));
                if (result != null) return result;
            }
        }
        return null;
    }

    @Test public void packagedRealLuoChatLoginLoadsInsideAndroid() throws Exception {
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<WebView> ref=new AtomicReference<>();
            scenario.onActivity(activity -> {
                View content=activity.findViewById(android.R.id.content);
                ref.set(findWeb(content));
            });
            assertNotNull("Android activity must contain the actual Luo Chat WebView",ref.get());
            WebView web=ref.get();
            String script="(function(){"
                    +"var f=document.getElementById('email');"
                    +"return JSON.stringify({ready:!!document.getElementById('signin'),"
                    +"username:!!f&&f.type==='text',"
                    +"google:!!document.getElementById('googleSignIn'),"
                    +"auth:!!document.getElementById('auth'),"
                    +"packaged:!!document.querySelector('.app')})"
                    +"})()";
            JSONObject state=null;
            String lastResponse="(not evaluated)";
            for(int attempt=0;attempt<35;attempt++){
                CountDownLatch completed=new CountDownLatch(1);
                AtomicReference<String> value=new AtomicReference<>("");
                scenario.onActivity(activity -> web.evaluateJavascript(script,answer -> {
                    value.set(answer);completed.countDown();
                }));
                assertTrue("WebView JavaScript never replied",completed.await(5,TimeUnit.SECONDS));
                lastResponse=String.valueOf(value.get());
                try {
                    String rendered=new JSONArray("["+lastResponse+"]").getString(0);
                    state=new JSONObject(rendered);
                    if(state.optBoolean("ready"))break;
                }catch(Exception ignored){}
                Thread.sleep(400);
            }
            AtomicReference<String> currentUrl=new AtomicReference<>("(unknown)");
            scenario.onActivity(activity -> currentUrl.set(web.getUrl()));
            assertNotNull("No Luo Chat document. WebView URL="+currentUrl.get()+", response="+lastResponse,state);
            assertTrue("Real login controls never loaded in the packaged app",state.optBoolean("ready"));
            assertTrue("Username input was replaced with old email form",state.optBoolean("username"));
            assertTrue("The signup/login screen is missing",state.optBoolean("auth"));
            assertTrue("Main Luo Chat app did not render",state.optBoolean("packaged"));
            assertFalse("Removed Google OAuth button was unexpectedly restored",state.optBoolean("google"));
        }
    }

    @Test public void AndroidReleaseRequestsOnlyMinimalPermissions() throws Exception {
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<PackageInfo> info=new AtomicReference<>();
            scenario.onActivity(activity -> {
                try {
                    info.set(activity.getPackageManager().getPackageInfo(
                        activity.getPackageName(),PackageManager.GET_PERMISSIONS));
                }catch(PackageManager.NameNotFoundException e){throw new AssertionError(e);}
            });
            assertNotNull(info.get());
            String[] requested=info.get().requestedPermissions;
            assertNotNull(requested);
            assertTrue(Arrays.asList(requested).contains("android.permission.INTERNET"));
            for(String denied:new String[]{
                "android.permission.READ_SMS",
                "android.permission.READ_CONTACTS",
                "android.permission.ACCESS_FINE_LOCATION",
                "android.permission.MANAGE_EXTERNAL_STORAGE",
                "android.permission.WRITE_SETTINGS",
                "android.permission.QUERY_ALL_PACKAGES"
            }){
                assertFalse("Unexpected sensitive permission: "+denied,
                    Arrays.asList(requested).contains(denied));
            }
        }
    }
}

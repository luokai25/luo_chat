# Luo Chat for Android — 1.0.0

This Android app opens the live Luo Chat production web experience at:

https://luo-chat-luokai25.vercel.app/

It uses the existing production website and backend; it does not bundle a separate copy of the web app or bypass server-side authentication and authorization.

## Included

- Android launcher app with Luo Chat black-and-gold branding.
- JavaScript, DOM storage, secure HTTPS-only web content and cookie support.
- Android file picker integration for photo/video/document upload flows.
- Runtime camera and microphone permission handling for supported in-app calls.
- Android back navigation and visible page-load progress.

## Build

From this directory, with JDK 17, Android SDK Platform 35, and Gradle 8.9 installed:

```sh
gradle --no-daemon assembleDebug
```

The installable APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Distribution and signing

The initial GitHub release workflow publishes an installable debug-signed APK for the first version. It is suitable for direct installation/testing, but it is **not Play Store-ready**. Before distributing updates that must install over this version, configure a private, persistent release keystore in GitHub Actions secrets and switch the release workflow to that key. Never commit a release keystore or its passwords to this repository.

The app requires internet access because it uses the live Luo Chat service. A successful APK build does not by itself certify live account registration, agent checkout, PayPal webhook delivery, subscription activation, calls, or media uploads end to end.

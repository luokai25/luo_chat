# Device access — Luo Chat 14.3.1

Settings → Device access explains camera, microphone, notifications and selected-file access. The same implementation is used by the website and installed PWA. It requests no permissions on startup. Camera and microphone requests require a click after an explanation; notification access is requested by the existing Enable button. Declining any permission does not block text chat.

Chat menu → Camera: allow camera, take a photo, review, Add to message, then Send. Camera frames are local until the normal attachment send. The camera stops after capture, cancel, signout, page hide or app backgrounding.

Chat menu → Voice note: allow microphone, Start recording, Stop recording, review, Add to message, then Send. Recording supports browser-provided WebM/Opus, MP4 or Ogg and is capped at 120 seconds / 20 MB. Unsupported browsers can attach existing audio. Closing, signing out or backgrounding discards an unfinished capture. A permission result arriving after cancellation is stopped and ignored; adding media is bound to the original account and conversation.

Device access displays browser-reported states when supported, refreshes on return, and includes Chrome/Android and iPhone recovery instructions. Status query failures show an unknown/prompt state rather than asserting access is granted. The app cannot override a denied permission, guarantee a particular OS prompt, or revoke an OS grant programmatically. In an installed PWA, the browser/OS still controls grants.

Photos and files use the existing native chooser; the app receives selected files, not access to the entire gallery. No contacts, location or full-device storage permission is requested. Location remains blocked by hosting policy. Camera and microphone are allowed only for the app's own origin (`camera=(self), microphone=(self)`). No third-party origin is granted media access.

Notifications retain their existing limit: alerts while Luo Chat is running in a hidden page. This release does not implement closed-app background push. Google Safe Browsing clearance, real-device prompt/capture acceptance and hosted two-account attachment acceptance are separate open checks. This is a web/PWA change, not a native Android APK permission manifest.

Mobile notifications prefer ServiceWorkerRegistration.showNotification; desktop falls back to the constructor if there is no registration. A late notification is closed if its account/session changes during delivery. Signing out closes known notifications for that account. Notification clicks focus/open Luo Chat without embedding message content in a navigation URL.

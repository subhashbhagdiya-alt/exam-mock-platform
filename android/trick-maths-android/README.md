# Trick Maths — Android build

This is a branded Android WebView wrapper for the live Trick Maths learning app: https://trick-table-maths.floot.app/

- Package: app.trickmaths.mobile
- Minimum Android: 8.0 (API 26)
- Compile SDK: 35; target SDK: 34
- No Google Play / Apple developer account, Floot native-build credits, signing secret, or external API key needed for a personal debug APK.

The APK loads the live website. A network connection is required to fetch content that has not been cached by the website/WebView. The app includes a branded loading screen, safe external-link handling, SSL error rejection, native back navigation and an offline retry page. It does not claim a full offline bundle.

Build from this folder with Android SDK installed:

```bash
gradle --no-daemon assembleDebug
```

APK path: app/build/outputs/apk/debug/app-debug.apk

The debug APK is automatically signed with the Android debug certificate and is suitable for sideloading/testing, not Play Store release.

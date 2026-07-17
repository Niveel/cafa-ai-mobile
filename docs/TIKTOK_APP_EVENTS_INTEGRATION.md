# TikTok App Events (Android)

## Configuration

- TikTok App ID: `7650349998273527815`
- Android package: `com.shopwit.cafaai`
- SDK: `com.github.tiktok:tiktok-business-android-sdk:1.7.0`
- Expo config plugin: `plugins/with-tiktok-business-sdk.js`
- Native bridge: `modules/tiktok-events`
- TypeScript service: `services/tiktokEvents.ts`

The config plugin adds the TikTok App ID to `AndroidManifest.xml` and ensures JitPack is available. The local Expo module owns the SDK, lifecycle, and Install Referrer dependencies and contributes the required consumer ProGuard rules.

## Consent and data boundary

TikTok network tracking starts only after the user opts in. The choice is stored locally and can be changed under **Settings > Data controls > TikTok ad measurement**. Disabling the setting clears queued TikTok events and destroys the native SDK instance.

The integration sends only these events:

- `Registration`
- `Login`
- `Subscribe` with subscription tier metadata and the checkout session ID for deduplication

It does not send chats, prompts, generated media, names, email addresses, phone numbers, or payment details. TikTok automatic in-app-purchase tracking is disabled to avoid duplicate purchase reporting.

## Build and verification

This native integration does not run in Expo Go and cannot be delivered through an OTA-only update. Create a new native build:

```sh
eas build --profile development --platform android
```

For a local Android build, use Android Studio's JDK 21 (or another Expo-supported JDK) and configure `ANDROID_HOME`. The machine-wide JDK 25 is not compatible with this project's current Gradle version.

After installing the build:

1. Accept the TikTok measurement prompt.
2. Complete a test registration, login, or subscription.
3. Confirm the corresponding event in TikTok Events Manager test events.
4. Disable TikTok ad measurement under Data controls and confirm no new events arrive.

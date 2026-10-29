# VGMF Foundation app

React Native (Expo) app for the Vaidya Gogate Memorial Foundation.

- **Android** native project: Kotlin + Java (`android/` after `npx expo prebuild`)
- **iOS** native project: Swift + Objective-C (`ios/` after prebuild on macOS)
- **Content:** loaded from the website `GET /api/mobile/feed`
- **Admin:** Admin → Mobile app → **Publish to app** writes that feed. Phones refresh on launch / pull-to-refresh. Ordinary CMS publishing does **not** need a Play Store or App Store release.
- **Sign-in:** email OTP only (ZeptoMail / Zoho). WhatsApp OTP is not used.

```bash
cd mobile
npm install
npx expo prebuild
# Android APK
cd android && ./gradlew assembleRelease
```

Default API origin is `https://vaidyagogate.org` (`app.json` → `expo.extra.apiUrl`). Override with `EXPO_PUBLIC_API_URL` when developing against a preview host.

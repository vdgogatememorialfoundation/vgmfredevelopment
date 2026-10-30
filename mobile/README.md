# VGMF Expo (React Native) apps

Native Android and iOS clients for the Vaidya Gogate Memorial Foundation website. This is **not** a WebView wrapper. Screens render with React Native views and load the published feed plus mobile APIs from the existing Next.js backend.

## Flavors

Set `EXPO_PUBLIC_FLAVOR` to `customer`, `admin`, `staff` or `support`. All four share this codebase and different tab sets.

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Next.js origin that serves `/api/mobile/*` | `https://vgmfredevelopment.vercel.app` (`vaidyagogate.org` is still Wix) |
| `EXPO_PUBLIC_FLAVOR` | App role | `customer` |

Copy `.env.example` if you add a local file. Do **not** put Razorpay, ZeptoMail, Shiprocket or other server secrets in the app.

Admin must use **Publish to app** (or Save settings / Save slideshow) so phones receive the logo, flyers and catalogue.

## Develop

```bash
cd mobile
npm install
npx tsc --noEmit
npx expo start
```

Then press `a` for Android or `i` for iOS. `npx expo start --web` is optional and is not the store product.

## Android

```bash
cd mobile
npx expo run:android
```

EAS preview APK (requires an Expo account):

```bash
npx eas-cli build -p android --profile preview-customer
```

Repeat with `preview-admin`, `preview-staff`, `preview-support`.

## iOS

iOS compilation needs macOS and Xcode:

```bash
cd mobile
npx expo run:ios
```

This Linux environment cannot produce an IPA.

## Production

1. Publish the live site from Admin so `/api/mobile/feed` contains branding and content.
2. Set store signing keys in Expo / Play Console / App Store Connect (not stored in this repo).
3. Build with EAS `production` (Android AAB) and an iOS production profile on a Mac.
4. Submit through Play Console and App Store Connect.

## Website-only features

The browser CMS (localStorage) cannot be edited from the phone. Card checkout, shipping-rate calls, password/SMS login, wishlist, addresses, POS and the ~92 admin edit pages stay on the website. See `IMPLEMENTATION.md`.

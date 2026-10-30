# VGMF Flutter (Android)

Four native Android apps share one Dart codebase: Customer, Admin, Staff and Support. The UI is Flutter (home, events, shop, clinics, tickets, certificates, account). It is not a website WebView.

Live name, logo, slideshow and content come from `/api/mobile/feed` after Admin publishes — no Play Store release is required for those updates.

```bash
python3 tool/gen_brand.py
flutter pub get
./tool/build_apks.sh
```

Installers are copied to `public/apps/vgmf-{customer,admin,staff,support}.apk`.

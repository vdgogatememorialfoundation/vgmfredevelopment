# VGMF mobile apps

Android is **Flutter**. iOS is **Swift**. There are four apps:

| App | Package / bundle | Opens |
| --- | --- | --- |
| VGMF | `org.vaidyagogate.customer` | `/` |
| VGMF Admin | `org.vaidyagogate.admin` | `/admin` |
| VGMF Staff | `org.vaidyagogate.staff` | `/staff` |
| VGMF Support | `org.vaidyagogate.support` | `/account/tickets` |

Name and logo are loaded from `/api/mobile/feed` after Admin → Mobile app → Publish. That does not need a Play Store or App Store release.

Gmail blocks `.apk` attachments. Share the website download links instead of emailing the files.

## Android (Flutter)

```bash
cd native/flutter
flutter pub get
./tool/build_apks.sh
```

APKs are copied to `public/apps/vgmf-{customer,admin,staff,support}.apk`.

Run one flavor on a device:

```bash
flutter run --flavor customer --dart-define=FLAVOR=customer
```

## iOS (Swift)

Open `native/ios/VGMF.xcodeproj` in Xcode on a Mac. Select **VGMF**, **VGMFAdmin**, **VGMFStaff** or **VGMFSupport**, set your signing team, and Archive for TestFlight.

If you use [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
cd native/ios && xcodegen generate
```

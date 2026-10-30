# VGMF Flutter (Android)

Four product flavors share one Dart codebase. Live name and logo come from `/api/mobile/feed`.

```bash
flutter pub get
flutter build apk --release --flavor customer --dart-define=FLAVOR=customer
./tool/build_apks.sh
```

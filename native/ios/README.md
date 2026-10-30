# VGMF Swift (iOS)

Open `VGMF.xcodeproj` in Xcode. Shared native UIKit sources live in `Shared/`. Each target has its own Info.plist (`VGMF_FLAVOR`).

This is a native iOS app (tabs, lists, sign-in, tickets, certificates). It is not a website wrapper. Live name, logo and content load from `https://vaidyagogate.org/api/mobile/feed` after Admin publishes — no App Store release is required for those updates.

Build each scheme (VGMF, VGMF Admin, VGMF Staff, VGMF Support) on a Mac with Xcode.

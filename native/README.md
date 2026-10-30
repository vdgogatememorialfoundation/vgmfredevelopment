# Archived native shells

The **active** VGMF mobile application is the Expo (React Native + TypeScript) project in `/mobile`.

This folder keeps earlier Flutter and Swift trees as a recoverable backup. Do not treat them as the product, and do not ship them as a WebView of the website.

| App flavour | Expo package | Notes |
| --- | --- | --- |
| VGMF | `org.vaidyagogate.app` (customer flavour) | Home, events, shop, clinics, account |
| VGMF Admin | same codebase, `EXPO_PUBLIC_FLAVOR=admin` | Read-only published snapshot |
| VGMF Staff | `EXPO_PUBLIC_FLAVOR=staff` | Notices and own-email tickets |
| VGMF Support | `EXPO_PUBLIC_FLAVOR=support` | Tickets and certificate lookup |

Name and logo come from `GET /api/mobile/feed` after **Admin → Mobile app → Publish**.

Build and run from `mobile/IMPLEMENTATION.md`.

# VGMF Expo application — audit, matrix and delivery

The Next.js website in this repository is the source of truth. This Expo (React Native) app is a **native** customer, admin, staff and support client. It is not a WebView wrapper and it is not Flutter.

Last updated: 30 October 2026, 9:15 PM IST (Asia/Calcutta).

Active application: `mobile/` (Expo SDK 54, React Native 0.81.5, Expo Router 6, `main: expo-router/entry`).
Archived backups (not shipped): `native/flutter`, `native/ios`, `native/android-apps`.

## Stage 1 — Audit (completed)

The public site, account area and portals were inspected from `src/app/(store)`, `src/app/(portal)`, `src/app/api` and `src/lib`.

### Architecture of the website

- Next.js App Router. Public chrome in `(store)`, staff/admin/doctor chrome in `(portal)`.
- **There is no shared SQL/NoSQL database.** Most admin CMS, accounts, cart, web orders and web tickets live in **browser `localStorage`**.
- Server JSON files under `/tmp` plus `public/app-feed.json` back: published mobile feed, mobile OTP/sessions/orders/tickets, notices, certificates.
- Payments, shipping and notify APIs are **provider proxies**. Credentials are sent from the admin browser, not stored as mobile secrets.

### Roles

`customer` | `admin` | `coadmin` | `staff` | `doctor` (`src/lib/roles.ts`).

Four installed app flavors: Customer, Admin, Staff, Support (`src/lib/mobile-config.ts`). Mobile OTP sessions have **no server-side role**. The admin/staff/support apps are different tab sets over the same published feed and the signed-in email’s mobile-API inbox. They are not the website CMS.

### Mobile-capable backend (reuse)

| Endpoint | Use in the app |
|---|---|
| `GET /api/mobile/feed` | Published name, logo, modules, events, articles, books, clinics, videos, notices, announcements, flyers, gallery, about, policies, FAQs, **appearance** |
| `GET /api/mobile/config` | Public theme + layout tokens only (version, colors, type scale, home sections, labels, app names/logos). ETag / `If-None-Match`. No secrets. |
| `POST /api/mobile/otp` | Email OTP send / verify / session / logout |
| `GET/POST /api/mobile/tickets` | Support tickets. GET requires Bearer and lists only that email. POST is public (contact) or uses the session email when signed in. |
| `GET/POST /api/mobile/orders` | Unpaid publication requests. **GET and POST both require Bearer.** POST prices come from the published catalogue. Status is always `Recorded` / `unpaid`. |
| `GET /api/certificates/verify` | Certificate lookup (public; the app does not send the session token) |
| `GET /api/notices` | Live notice board (CORS enabled for the app) |
| `GET /api/notices/[id]/file` | Public notice attachment download |

Web customer sessions (`vgmf_session` in localStorage) are **not** the same as mobile Bearer tokens.

## Stage 2 — Feature matrix

Status: **native** = implemented in Expo against a real API or the published feed. **website-only** = requires the browser CMS/localStorage and is documented, not silently dropped. **external** = Foundation already sends users to another site.

| Feature | Website route | Role | Backend | Mobile screens | Nav | Notes | Status |
|---|---|---|---|---|---|---|---|
| Home + slideshow | `/` | public | feed `flyers`, `announcements`, `flags` | `(tabs)/index` | Tab Home | Native **square** carousel (`contain`, prev/next). Flyer hrefs open native routes or `Linking`. | native |
| Events list/detail | `/events`, `/events/[slug]` | public | feed `events` | `(tabs)/events`, `event/[id]` | Tab Events | Register opens `registrationUrl` | native |
| Articles | `/articles`, `/articles/[slug]` | public | feed `articles` | `articles`, `article/[id]` | Explore | | native |
| Shop + bag | `/shop`, `/shop/[slug]`, `/cart` | signed-in | feed `books`; `POST /api/mobile/orders` | `(tabs)/shop`, `book/[id]`, `cart` | Tab Shop | Records an **unpaid** mobile-API request after email sign-in. Prices from the published catalogue. Out-of-stock items cannot be added. **No Razorpay on device.** | native |
| Checkout / shipping rates / COD / store credit | `/checkout` | customer | localStorage + `/api/shipping` with admin creds | — | — | Courier credentials live in the admin browser. | website-only |
| Clinics | `/clinics`, `/clinics/[slug]` | public | feed `clinics` | `(tabs)/clinics`, `clinic/[id]` | Tab Clinics | Call / maps via native links | native |
| Gallery | `/gallery` | public | feed `gallery` | `gallery` | Explore | | native |
| Videos | `/videos` | public | feed `videos` | `videos` | Explore | Opens YouTube/source | native |
| Notices | `/notices` | public | feed + `GET /api/notices` | `(tabs)/index` Notice board | Home only | No separate notices screen or tab. Attachments via `/api/notices/:id/file`. | native |
| Announcements | `/announcements` | public | feed | `announcements` | Explore | | native |
| About | `/about` and subpages | public | feed `about` | `about` | Explore | Foundation/history/trustees/legacy are sections in the published about snapshot | native |
| Policies | `/privacy` `/terms` `/shipping-policy` `/refund-policy` `/return-policy` `/cancellation-policy` | public | feed `policies` | `policy/[id]` | Account / About | | native |
| Contact | `/contact` | public | ticket API | `contact` | Explore | Sends a mobile-API support ticket | native |
| Certificate verify | `/certificate-verification` | public | `GET /api/certificates/verify` | `certificates` | Explore / Support tab | | native |
| Email OTP account | `/login` (subset) | customer | `POST /api/mobile/otp` | `(tabs)/account` | Tab Account | Email OTP only. Website password+SMS login stays on the site. Expired tokens are dropped on launch. | native |
| Orders list | `/account/orders` | customer | `GET /api/mobile/orders` | account | Account | Mobile-API unpaid requests only, not `vgmf_orders` | native |
| Support tickets | `/account/tickets`, `/support` | customer | tickets API | `support`, account | Explore / Support | Mobile-API tickets for the signed-in email only | native |
| FAQ | `/account/faq` | public | feed `faqs` | `faq` | Account | | native |
| Profile / addresses / wishlist / cards / loyalty / subscriptions / receipts / payments history | `/account/*` | customer | localStorage | — | — | No server user profile store | website-only |
| Event registrations | `/account/registrations` | customer | `seminar.vaidyagogate.org` | event detail button | | External seminar site | external |
| Application tracker | `/application-status` | demo local | `vgmf_applications` | — | — | Demo localStorage tracker | website-only |
| Custom CMS pages | `/p/[slug]` | public | `vgmf_cms_pages` | — | — | Not in the published feed | website-only |
| Live chat / i18n | site chrome | public | local | — | — | Website widgets | website-only |
| Admin CMS (pages, products, POS, shipping APIs, roles, reports, …) | `/admin/*` (~92 pages) | admin/staff/doctor | **localStorage CMS** | flavor **Desk** is a native read-only snapshot of the published feed plus tickets/orders for the signed-in inbox | Admin/Staff tabs | Creating/editing CMS records cannot be done from a phone without a real database. | website-only (edit); native (read snapshot) |
| Doctor portal | `/doctor` | doctor | localStorage | Staff/admin clinic list from feed | | Clinic content is in the feed | native (read) |
| APK downloads | `/app` | public/staff | static `/apps/*.apk` | — | — | Hosted files may still be previous Flutter builds until Expo APKs are published | website-only |

## Discrepancy report (verified and fixed 30 Oct 2026)

These were confirmed in code and, where noted, by HTTP checks. They were not inferred from route files existing.

| Defect | Evidence | Fix |
|---|---|---|
| `GET /api/mobile/orders?email=` and `GET /api/mobile/tickets?email=` returned another user’s records without a Bearer token | Routes used `session?.email ?? searchParams.email` | GET now requires a valid session and lists only that email |
| Order POST trusted client `price`/`status` and could be created for any email | `addOrder` stored client price; POST used `body.email` | Catalogue lookup; status always `Recorded`/`unpaid`; POST requires Bearer and uses the session email |
| Logout only cleared SecureStore | Account `saveSession(null)` | `POST /api/mobile/otp` `action=logout` revokes the server token |
| OTP used `Math.random()`, no attempt cap, sessions never expired | `mobile-store.ts` | `randomInt`, timing-safe compare, 5 attempts, 10-minute OTP, 30-day session expiry |
| Duplicate order POSTs could create two rows | No idempotency | Same email+items within 2 minutes returns the existing record |
| Ticket POST had no rate limit; signed-in users could set another email | Open create | 3 tickets / email / 10 minutes; session email wins when signed in |
| 401 from a public endpoint could sign the user out | `parse()` always cleared SecureStore | Public feed/notices/certificates do not send Bearer and do not clear the session |
| Expired tokens stayed in SecureStore | Account loaded inbox until the next 401 | `checkSession()` on launch |
| Bag copy implied website payment; guest POST created unpaid rows for arbitrary emails | Cart success string; unauthenticated POST | Sign-in required; labelled unpaid mobile-API request |
| Out-of-stock books could still be bagged | Book detail always showed Add | Hidden when `out_of_stock` or `active === false` |
| Flyer `href` was pushed into Expo Router even for `https://` URLs | Home carousel `router.push(item.href)` | Native route map or `Linking.openURL` |
| Admin flavor looked like a CMS | Counts only | Explicit read-only published-snapshot copy |
| Website and `native/` still described Flutter/Swift as the live apps | MobileAppDesk, `/app`, `native/README.md` | Copy now names Expo as the active app; Flutter/Swift kept as archived source |
| Homepage slideshow was a wide 168px rectangle that cropped flyer art | Home carousel `height: 168` | Square 1:1 frame with `resizeMode: "contain"` and centered prev/next |
| Notices had a tab and a stack page | `(tabs)/notices`, `app/notices`, Explore chip | Notice board on Home only; `/notices` redirects home; staff tab is Clinics |
| Phone Home showed `Exception:` plus a Wix `400 Error: Bad Request` HTML page | Installed Flutter APK fetches `https://vaidyagogate.org/api/mobile/feed`; that host is still Wix | Expo loads `https://vgmfredevelopment.vercel.app` and never renders HTML error pages |
| Empty email publish could wipe OTP mail secrets | `saveMobileEmailCreds` wrote `{}` | Secrets are merged and ignored when the payload has no token |

HTTP checks on the local Next server (no production writes): unauthenticated order list/create → 401; unauthenticated ticket list → 401; client price / unknown id → 400; logout → 200.

## Storage inventory (do not migrate without approval)

| Data | Where it lives today | Website | Mobile | Durable on Vercel? |
|---|---|---|---|---|
| CMS (pages, products, events, flyers, settings, roles) | Browser `localStorage` on the admin machine | Yes | Published snapshot only after **Publish to app** | No, until published to `public/app-feed.json` / `/tmp` |
| Website customer accounts, cart, website orders, website tickets | Browser `localStorage` | Yes | **No** — different store | No |
| Published feed, logos, flyers | Memory + `/tmp/vgmf-mobile-snapshot.json` + `public/app-feed.json` + `/uploads` | Hydrate | Feed GET | Feed JSON in `public/` can survive a deploy; `/tmp` does not |
| Mobile OTP, sessions, mobile tickets, mobile orders | Memory + `/tmp/vgmf-mobile-*.json` | No | Yes | **No** on serverless. Lost on cold start |
| Mobile email provider creds | `/tmp/vgmf-mobile-email.json` | Copied at publish when secrets are present | OTP send | **No** |
| Notices, certificates | `/tmp` JSON (+ seed) | Yes | Yes | **No** on serverless |
| Razorpay / courier keys | Admin browser or host env `RAZORPAY_*` | Website checkout | Never shipped | Host env only |

`/tmp` is also used by: `vgmf-mobile-otp.json`, `vgmf-mobile-tickets.json`, `vgmf-mobile-orders.json`, `vgmf-mobile-sessions.json`, `vgmf-mobile-snapshot.json`, `vgmf-mobile-email.json`, `vgmf-certificates.json`, notices JSON.

### Migration design (not implemented)

Target: one authoritative store (Postgres or similar) for accounts, CMS, orders, tickets, payments, notices and certificates, used by both the website and the app.

Cannot be auto-migrated from the server: almost all CMS and website customer records exist only in **individual browsers**. Safe collection would be an admin “export/upload my browser CMS” that POSTs a snapshot the operator can review, plus a customer “move my website account” after email proof — never a silent scrape of other people’s localStorage.

Until that store exists and is approved: keep the two stores labelled in the app, do not merge IDs, do not mark mobile requests paid.

## Payments and orders

- Mobile `POST /api/mobile/orders` records an **unpaid** publication request for the **signed-in** email. It cannot set `Paid`.
- Line prices are taken from the published book catalogue, not from the bag payload.
- Website `/checkout` and `/pay/[orderId]` operate on `vgmf_orders` in localStorage and Razorpay on the server. Those IDs are not mobile-API IDs.
- Razorpay, Shiprocket and admin API keys are not in the Expo bundle (`mobile/` has no `RAZORPAY`, courier or admin secrets).

## Navigation

**Customer:** Home · Events · Shop · Clinics · Account, plus stack screens for detail/explore.

**Admin:** Desk · Events · Shop · Tickets · Account (read-only published snapshot).

**Staff:** Home · Events · Clinics · Tickets · Account.

**Support:** Home · Tickets · Certificates · Account.

Four Expo apps share `mobile/`. `EXPO_PUBLIC_FLAVOR` selects the name and store IDs:

| Flavor | Display name | Android package | iOS bundle |
|---|---|---|---|
| customer | VGMF | `org.vaidyagogate.customer` | `org.vaidyagogate.customer` |
| admin | VGMF Admin | `org.vaidyagogate.admin` | `org.vaidyagogate.admin` |
| staff | VGMF Staff | `org.vaidyagogate.staff` | `org.vaidyagogate.staff` |
| support | VGMF Support | `org.vaidyagogate.support` | `org.vaidyagogate.support` |

EAS: `eas build --profile preview-customer|preview-admin|preview-staff|preview-support --platform android`. Flutter in `native/flutter` is an archived backup only.

## Remote theme and layout (Category 1)

Phones apply a **bundled default light theme**, then the last cached published appearance, then `GET /api/mobile/config` and the `appearance` object on `GET /api/mobile/feed`. Invalid payloads are rejected (`sanitizeAppearance`). Drafts live only in the admin browser (`vgmf_mobile_appearance_draft`). **Publish to app** copies the draft to `vgmf_mobile_appearance_published` and writes it into `public/app-feed.json` through the existing publish path.

Admin: **Settings → App appearance** (`/admin/settings/appearance`). Save draft does not change the live app. Restore defaults affects the draft only until Publish. Staff need the Mobile app module.

Carousel aspect is fixed at **1:1**. Notices stay on Home. Wishlist, website checkout and CMS editing stay website-only.

### Update categories

| Category | What | How it reaches phones | Needs Play/App Store? |
|---|---|---|---|
| 1. Remote config & content | Colors, section order/visibility, labels, logos, flyers, catalogue | `GET /api/mobile/config` and `/api/mobile/feed` after Admin **Publish** | No |
| 2. Compatible JS/assets (OTA) | Screen layout JS that matches the current native runtime | Expo EAS Update — **not configured in this repo** (no EAS project ID in `app.json`, `expo-updates` not installed). Do not invent a fake update URL. After `eas init` and a **new binary** that includes `expo-updates`, use preview/production channels. Rollback: `eas update:rollback` or publish the previous update. | No, once OTA is in a shipped binary |
| 3. Native / incompatible | New native modules, permissions, SDK bumps, package IDs | New Android/iOS build (`eas build` / Gradle) and store submission where required | **Yes** |

This UI redesign is JavaScript. Installed APKs that were built **before** this branch do not contain it and cannot receive it via OTA until Category 2 is configured **and** those devices install a binary that includes `expo-updates`. Sideload a new Expo APK from `/apps/*.apk` after this branch is built.

Appearance cache: `SecureStore` key `vgmf-appearance`. If storage is full, the in-memory theme still applies for the session.

## Device capabilities used

- SecureStore for the session token (revoked on sign-out; validated on launch).
- Linking for `tel:`, `mailto:`, maps, YouTube, event registration, external flyer hrefs.
- Pull-to-refresh and explicit Retry on feed failure.
- Not requested: camera, location permission, push, biometrics.

## Stage 5 — Testing

| Check | Result (30 Oct 2026, 8:42 PM IST) |
|---|---|
| `cd mobile && npm install` | Passed with `legacy-peer-deps=true` (Expo optional `react-dom` peer) |
| `npx tsc --noEmit` in `mobile/` | Passed |
| Website `npx tsc --noEmit` | Passed |
| ESLint on this delivery’s TS files | Passed (`MobileAppDesk` still has a pre-existing set-state-in-effect lint) |
| `npx expo install --check` | Dependencies up to date (SDK 54) |
| `npx expo config --type public --json` | SDK 54, platforms ios/android/web, package `org.vaidyagogate.app` |
| `npx expo export --platform android` | Hermes bundle written (`entry-*.hbc`, 1166 modules) |
| `./gradlew :app:assembleCustomerRelease` (and admin/staff/support) | Passed; 56 MB Expo APKs copied to `public/apps/vgmf-*.apk`. **Not installed on a device in this agent.** |
| Expo Router screens for mapped native features | Present; cart/account/tickets/orders call real APIs with split-store labels |
| `GET`/`POST` orders without Bearer | 401 |
| `GET` tickets without Bearer | 401 |
| OTP `action=session` without token | 401 |
| Certificate verify without number | 400 |
| `GET /api/mobile/config` on local Next | 200 JSON with theme tokens only; `If-None-Match` → 304; no mail/payment secrets |
| Draft vs publish | Save draft writes `vgmf_mobile_appearance_draft` only; Publish writes published key + feed |
| Android emulator / physical device | None attached (`adb devices` empty) |
| iOS simulator / IPA | Cannot compile on Linux |
| Live OTP / paid checkout against production | Not executed |
| Card payment | Intentionally website-only |

## Stage 6 — Builds

```bash
cd mobile
npm install
npx tsc --noEmit
npx expo install --check
npm start                 # Expo dev
npx expo run:android      # debug APK via the existing android/ project
npx expo run:ios          # requires macOS / Xcode
eas build --profile preview-customer --platform android
eas build --profile preview-admin --platform android
eas build --profile preview-staff --platform android
eas build --profile preview-support --platform android
```

API base: `extra.apiUrl` / `EXPO_PUBLIC_API_URL` (default `https://staging.vaidyagogate.org`). Flavor: `EXPO_PUBLIC_FLAVOR=customer|admin|staff|support` (`mobile/app.config.ts`).

`https://vaidyagogate.org` is still the previous Wix website. The Next.js feed is on the Mumbai VPS at `https://staging.vaidyagogate.org/api/mobile/feed` (demo: `https://demo.vaidyagogate.org`). Expo tries the configured origin, then staging, then demo, then the public domain. HTML error pages are never shown in the UI.

Store signing, Play/App Store listings and push certificates are **not** in this repo. Admin must still **Publish to app** from the website so phones receive logo and content.

## Install on an Android phone

Do **not** install from `vaidyagogate.org` (still Wix). Uninstall the Flutter app first (Home showed `Exception:` and **Bag 0**).

Open these links **on the phone** (Chrome). Allow installs from the browser if Android asks.

| App | Download |
|---|---|
| VGMF (customer) | https://staging.vaidyagogate.org/apps/vgmf-customer.apk |
| VGMF Admin | https://staging.vaidyagogate.org/apps/vgmf-admin.apk |
| VGMF Staff | https://staging.vaidyagogate.org/apps/vgmf-staff.apk |
| VGMF Support | https://staging.vaidyagogate.org/apps/vgmf-support.apk |

Until this branch is on the Vercel production host, the same files are on the PR branch:

https://github.com/vdgogatememorialfoundation/vgmfredevelopment/raw/cursor/expo-native-app-9792/public/apps/vgmf-customer.apk

Gmail blocks `.apk` attachments. Share the link, never the file.

These APKs are Expo release builds (`org.vaidyagogate.customer|admin|staff|support`), signed with the debug keystore for sideload. They are not Play Store releases.

## Blockers (explicit)

1. No shared database — website CMS cannot be edited from the phone.
2. Web orders/tickets/accounts are a different store from `/tmp` mobile JSON.
3. `/tmp` state is ephemeral on serverless hosts (OTP, sessions, mobile tickets/orders, notices, mail creds).
4. Card payments stay on the website so Razorpay secrets never enter the app bundle.
5. iOS IPA cannot be compiled on this Linux agent.
6. Event signup is the external seminar site, as on the website.
7. Phones only receive a new logo after **Save settings** or **Publish to app**.
8. `POST /api/mobile/publish` and notice writes are callable without a staff login because the CMS lives in the admin browser. A durable publish key needs an approved design so it does not lock the operator out.
9. Mobile OTP sessions have no admin/staff role, so the support/admin flavors cannot list every ticket — only the signed-in email.
10. `vaidyagogate.org` is still Wix. Install Expo APKs from the Next.js `/apps/*.apk` links, not from the Wix site.
11. Sideloaded APKs use the debug signing key. Play/App Store listing still needs a release keystore.
12. Expo OTA (`expo-updates`) is **not** enabled: there is no EAS project ID and no fake update URL. Theme/content still update without a store release (Category 1).
13. Native wishlist is not implemented — website account wishlist stays in browser localStorage.

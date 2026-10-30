# VGMF Expo application — audit, matrix and delivery

The Next.js website in this repository is the source of truth. This Expo (React Native) app is a **native** customer, admin, staff and support client. It is not a WebView wrapper.

Last updated: 30 October 2026, 8:15 PM IST (Asia/Calcutta).

## Stage 1 — Audit (completed)

The public site, account area and portals were inspected from `src/app/(store)`, `src/app/(portal)`, `src/app/api` and `src/lib`.

### Architecture of the website

- Next.js App Router. Public chrome in `(store)`, staff/admin/doctor chrome in `(portal)`.
- **There is no shared SQL/NoSQL database.** Most admin CMS, accounts, cart, web orders and web tickets live in **browser `localStorage`**.
- Server JSON files under `/tmp` plus `public/app-feed.json` back: published mobile feed, mobile OTP/sessions/orders/tickets, notices, certificates.
- Payments, shipping and notify APIs are **provider proxies**. Credentials are sent from the admin browser, not stored as mobile secrets.

### Roles

`customer` | `admin` | `coadmin` | `staff` | `doctor` (`src/lib/roles.ts`).

Four installed app flavors: Customer, Admin, Staff, Support (`src/lib/mobile-config.ts`).

### Mobile-capable backend (reuse)

| Endpoint | Use in the app |
|---|---|
| `GET /api/mobile/feed` | Published name, logo, modules, events, articles, books, clinics, videos, notices, announcements, flyers, gallery, about, policies, FAQs |
| `POST /api/mobile/otp` | Email OTP send / verify / session |
| `GET/POST /api/mobile/tickets` | Support tickets for the signed-in email |
| `GET/POST /api/mobile/orders` | Publication orders (no card capture on device) |
| `GET /api/certificates/verify` | Certificate lookup |
| `GET /api/notices` | Live notice board (CORS enabled for the app) |
| `GET /api/notices/[id]/file` | Notice attachment download |

Web customer sessions (`vgmf_session` in localStorage) are **not** the same as mobile Bearer tokens.

## Stage 2 — Feature matrix

Status: **native** = implemented in Expo against a real API or the published feed. **website-only** = requires the browser CMS/localStorage and is documented, not silently dropped. **external** = Foundation already sends users to another site.

| Feature | Website route | Role | Backend | Mobile screens | Nav | Notes | Status |
|---|---|---|---|---|---|---|---|
| Home + slideshow | `/` | public | feed `flyers`, `announcements`, `flags` | `(tabs)/index` | Tab Home | Native carousel with prev/next + explore | native |
| Events list/detail | `/events`, `/events/[slug]` | public | feed `events` | `(tabs)/events`, `event/[id]` | Tab Events | Register opens `registrationUrl` | native |
| Articles | `/articles`, `/articles/[slug]` | public | feed `articles` | `articles`, `article/[id]` | Explore | | native |
| Shop + bag | `/shop`, `/shop/[slug]`, `/cart` | public / signed-in | feed `books`; `POST /api/mobile/orders` | `(tabs)/shop`, `book/[id]`, `cart` | Tab Shop | Order is recorded on the mobile API. **No Razorpay on device** (keys must not ship in the app). Pay on the website `/pay/[orderId]` if online payment is configured. | native |
| Checkout / shipping rates / COD / store credit | `/checkout` | customer | localStorage + `/api/shipping` with admin creds | — | — | Courier credentials live in the admin browser. Device checkout would expose them or invent a paid success. | website-only |
| Clinics | `/clinics`, `/clinics/[slug]` | public | feed `clinics` | `(tabs)/clinics`, `clinic/[id]` | Tab Clinics | Call / maps via native links | native |
| Gallery | `/gallery` | public | feed `gallery` | `gallery` | Explore | | native |
| Videos | `/videos` | public | feed `videos` | `videos` | Explore | Opens YouTube/source | native |
| Notices | `/notices` | public | feed + `GET /api/notices` | `notices` | Explore | Attachment via `/api/notices/:id/file` | native |
| Announcements | `/announcements` | public | feed | `announcements` | Explore | | native |
| About | `/about` and subpages | public | feed `about` | `about` | Explore | Foundation/history/trustees/legacy are sections in the published about snapshot | native |
| Policies | `/privacy` `/terms` `/shipping-policy` `/refund-policy` `/return-policy` `/cancellation-policy` | public | feed `policies` | `policy/[id]` | Account / About | | native |
| Contact | `/contact` | public | ticket API | `contact` | Explore | Sends a support ticket | native |
| Certificate verify | `/certificate-verification` | public | `GET /api/certificates/verify` | `certificates` | Explore / Support tab | | native |
| Email OTP account | `/login` (subset) | customer | `POST /api/mobile/otp` | `(tabs)/account` | Tab Account | Email OTP only (same as published mobile contract). Website password+SMS login stays on the site because accounts are localStorage. | native |
| Orders list | `/account/orders` | customer | `GET /api/mobile/orders` | account | Account | Mobile-API orders, not `vgmf_orders` | native |
| Support tickets | `/account/tickets`, `/support` | customer | tickets API | `support`, account | Explore / Support | | native |
| FAQ | `/account/faq` | public | feed `faqs` | `faq` | Account | | native |
| Profile / addresses / wishlist / cards / loyalty / subscriptions / receipts / payments history | `/account/*` | customer | localStorage | — | — | No server user profile store | website-only |
| Event registrations | `/account/registrations` | customer | `seminar.vaidyagogate.org` | event detail button | | External seminar site | external |
| Application tracker | `/application-status` | demo local | `vgmf_applications` | — | — | Demo localStorage tracker | website-only |
| Custom CMS pages | `/p/[slug]` | public | `vgmf_cms_pages` | — | — | Not in the published feed | website-only |
| Live chat / i18n | site chrome | public | local | — | — | Website widgets | website-only |
| Admin CMS (pages, products, POS, shipping APIs, roles, reports, …) | `/admin/*` (~92 pages) | admin/staff/doctor | **localStorage CMS** | flavor **Desk** is a native read-only snapshot of the published feed plus tickets/orders for the signed-in inbox | Admin/Staff tabs | Creating/editing CMS records cannot be done from a phone without a real database. Those desks stay on the website. | website-only (edit); native (read snapshot) |
| Doctor portal | `/doctor` | doctor | localStorage | Staff/admin clinic list from feed | | Clinic content is in the feed | native (read) |
| APK downloads | `/app` | public/staff | static `/apps/*.apk` | — | — | Distribution page on the website | website-only |

## Navigation

**Customer:** Home · Events · Shop · Clinics · Account, plus stack screens for detail/explore.

**Admin:** Desk · Events · Shop · Tickets · Account.

**Staff:** Home · Events · Notices · Tickets · Account.

**Support:** Home · Tickets · Certificates · Account.

## Design system

Ink `#0B1F3A`, burgundy `#8F2D2D`, gold `#B8953A`, paper `#F7F3EA`, cream `#FFFDF8`, border `#E4D8C4`. Native cards, bottom tabs, keyboard-aware forms, empty/error/retry states. Light theme only (the website is light).

## Device capabilities used

- SecureStore for the session token.
- Linking for `tel:`, `mailto:`, maps, YouTube, event registration.
- Pull-to-refresh.
- Not requested: camera, location permission, push, biometrics (website does not require them for the mobile contract).

## Stage 5 — Testing

| Check | Result |
|---|---|
| `cd mobile && npm install && npx tsc --noEmit` | Passed |
| Expo Router screens for every mapped native feature | Present under `mobile/app` |
| Website mobile slideshow arrows | Visible on all breakpoints (`HeroSection`) |
| Website logo on phones / other browsers | Server layout seeds published brand; `/api/mobile/brand` plus file persist to `/uploads/` |
| Android emulator / physical device | Not available in this Linux agent |
| iOS simulator / IPA | Cannot compile on Linux |
| Live OTP / ticket / order against production | Not executed (would create real records) |
| Card payment | Intentionally website-only |

## Stage 6 — Builds

```bash
cd mobile
npm install
npx tsc --noEmit
npm start                 # Expo dev
npx expo run:android      # debug APK via the existing android/ project
npx expo run:ios          # requires macOS / Xcode
```

API base: `extra.apiUrl` / `EXPO_PUBLIC_API_URL` (default `https://vaidyagogate.org`). Flavor: `EXPO_PUBLIC_FLAVOR=customer|admin|staff|support`.

Store signing, Play/App Store listings and push certificates are **not** in this repo. Admin must still **Publish to app** from the website so phones receive logo and content.

## Blockers (explicit)

1. No shared database — website CMS cannot be edited from the phone.
2. Web orders/tickets/accounts are a different store from `/tmp` mobile JSON.
3. `/tmp` state is ephemeral on serverless hosts.
4. Card payments stay on the website so Razorpay secrets never enter the app bundle.
5. iOS IPA cannot be compiled on this Linux agent.
6. Event signup is the external seminar site, as on the website.
7. Phones only receive a new logo after **Save settings** or **Publish to app**. Until that succeeds, other browsers still show the VGMF badge.

Old `mobile/App.tsx` / `index.js` were a single-file prototype and are removed; `package.json` `main` is `expo-router/entry`.

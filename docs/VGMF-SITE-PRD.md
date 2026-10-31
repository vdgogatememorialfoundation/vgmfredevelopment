# VGMF Site Product Requirements Document

**Product:** Vaidya Gogate Memorial Foundation (VGMF) platform  
**Document type:** Full site PRD  
**Owner:** Gogate family / Foundation trustees  
**Status:** Living specification of the current product  
**Revision:** 1.1 — 31 October 2026 (Asia/Calcutta)  
**Audience:** Trustees, editors, engineers, mobile, and operations

This document describes the whole VGMF platform as built: public website, customer account, admin CMS, commerce, events, support, mobile apps, sister portals, and hosting. It is the product contract for what the site and Android app must continue to do.

---

## 1. Product vision

VGMF is a memorial and knowledge foundation in Pune. The platform preserves the work of Vaidya R. B. Gogate and Dr. Anagha Gogate, publishes Ayurveda scholarship, sells Foundation publications, lists clinics and events, verifies certificates, and gives the family a staff-operated CMS.

**One-line purpose:** A bilingual-ready Foundation site and Android app that publishes authentic content, sells books, and runs events without exposing secrets or mixing unrelated sections.

**Tagline in product:** Preserving Ayurveda. Advancing Knowledge. Serving Society.

**Primary brand:** Burgundy `#8F2D2D`, ink `#0B1F3A`, gold `#B8953A`, paper `#F7F3EA` / `#FFFDF8`.

---

## 2. Users

| Role | Goal | Surface |
| --- | --- | --- |
| Visitor | Read About, events, articles, gallery, videos, clinics | Public site, Android app |
| Customer | Buy publications, track orders, register for events, verify certificates | Shop, account, checkout, app |
| Editor / Admin | Publish pages, media, events, catalogue, notices | `/admin` |
| Staff / co-admin | Limited CMS and ticket work | `/staff`, staff Android flavor |
| Support agent | Tickets, certificate lookups | `/admin/support`, support flavor |
| Doctor (sister portals) | Seminar / autism / fellowship dashboards | External portals |

---

## 3. Binding UX rules

These are product rules, not optional styling.

1. **Anagha Gogate and Vaidya R. B. Gogate portraits** are permanent **small left squares** (80×80 on web and Android). Biography starts immediately on the right. Never stack photo above text on any viewport.
2. **Shipped square files** `/about/anagha-square.jpg` and `/about/rb-square.jpg` are the default portraits. Tall legacy files stay only for old URLs. Ignore `data:` and `blob:` images in public render.
3. **Dropdowns** exist only when a nav item has **unique children** that are not the parent and not a sibling top-level item.
   - About Us → Foundation, Legacy, Dr. Anagha, Awards, Books & Research, History, Trustees.
   - Contact → Support.
   - Events, Shop, Gallery, Videos, Articles, Clinics, Certificates are **plain links**.
4. **No cross-links:** Gallery must not list Videos. Videos must not list Gallery. Events must not list Announcements. Shop must not list Books as a child (the shop *is* publications).
5. **Admin image upload** must offer crop. Only the cropped file is stored and shown.
6. **No secrets in git.** Passwords stay in environment / `sshpass -e`.
7. **Journals are not a product surface.** Articles are the library. Shop is publications, not a separate Books nav item.

---

## 4. Information architecture

### 4.1 Public header

| Item | Route | Menu |
| --- | --- | --- |
| About Us | `/about` | 7 child pages |
| Events | `/events` | none |
| Gallery | `/gallery` | none |
| Videos | `/videos` | none |
| Articles | `/articles` | none |
| Shop | `/shop` | none |
| Clinics | `/clinics` | none |
| Contact | `/contact` | Support |
| Certificates | `/certificate-verification` | none |

### 4.2 About Us children

| Page | Route |
| --- | --- |
| About the Foundation | `/about/foundation` |
| Legacy of Vaidya R. B. Gogate | `/about/legacy-of-vaidya-rb-gogate` |
| Dr. Anagha Gogate | `/about/dr-anagha-gogate` |
| Awards & Accolades | `/about/awards` |
| Books & Research | `/about/books-and-research` |
| Our History | `/about/history` |
| Trustees & Team | `/about/trustees` |

Portrait lock applies on About, Legacy, Anagha, and the home About directory.

### 4.3 Customer account

`/account`, `/account/registrations`, `/account/applications`, `/account/notifications`, `/account/orders`, `/account/subscriptions`, `/account/payments`, `/account/receipts`, `/account/tickets`, `/account/wishlist`, `/account/cards`, `/account/addresses`, `/account/profile`, `/account/loyalty`, `/account/faq`.

Auth is email OTP. Login lives at `/login`.

### 4.4 Commerce

`/shop`, `/shop/[slug]`, `/cart`, `/checkout`, `/pay/[orderId]`, `/orders`. Historical `/books` and `/books/[slug]` remain aliases into publications.

### 4.5 Policies

Privacy, Terms, Shipping, Returns, Refund, Cancellation.

### 4.6 Other public pages

`/announcements`, `/notices`, `/support`, `/app` (mobile download), `/p/[slug]` (CMS pages), `/application-status`.

---

## 5. Public site requirements

### 5.1 Home

- Hero / slideshow from Admin flyers and banners.
- About directory with both portraits as left squares.
- Modules for events, publications, articles, videos, gallery, notices, support, as visibility flags allow.
- Language switcher: English, Hindi, Marathi, Kannada, Tamil, Malayalam, Gujarati, Telugu, Bengali, Punjabi, Odia, Assamese, Urdu. Default English (`en-IN`).
- Sister portal links when enabled: Seminar, Autism, Fellowship.

### 5.2 Events

- Upcoming and past events from CMS.
- Detail: banner, city, venue, dates, mode, type, fee, registration URL, map.
- Events **do not** include Announcements.

### 5.3 Shop / publications

- Catalogue of Foundation books.
- Product page: cover, gallery, author, price, original price, stock, pages, add to cart.
- Currency INR. Shipping ₹49, free over ₹499. GST 5%. Returns 7 days. Order prefix `VGMF`.
- Payment: Razorpay on the website. Shipping: Shiprocket.
- Shop **does not** expose a Books dropdown.

### 5.4 Articles, gallery, videos, clinics

- Articles: title, author, date, reading time, cover, body. Optional per-locale translation.
- Gallery: photographs only.
- Videos: YouTube or hosted source plus poster.
- Clinics: name, city, specialization, doctor, address, timings, phone, email, map, appointment URL.

### 5.5 Certificates

- Public lookup at `/certificate-verification` and `/certificate-verification/[number]`.
- Android app mirrors the same API.

### 5.6 Support and contact

- Contact shows Foundation address, email `info@vaidyagogate.org`, phone.
- Support tickets persist against email and appear in the customer account.

### 5.7 Notices and announcements

- Notices are a live board (with optional file attachments).
- Announcements are a dated list. They are **not** children of Events.

---

## 6. Admin CMS requirements

Admin lives at `/admin` (staff at `/staff`). Groups:

**Overview** — Dashboard.

**Notices** — Notice board.

**Commerce** — Orders, in-store POS, shipments, inventory, products, serviceability, courier performance, payments.

**Accounts** — Staff & co-admin, customers, roles.

**Website & CMS** — Homepage, pages, site/portal switches, About Us, announcements, slideshow & posters, banners, media library, articles, gallery, videos, clinics, policies.

**Events** — All events, create, schedule, speakers.

**Payments** — Transactions, gateway, successful / failed / pending, refunds, reconciliation.

**Support** — Tickets, live chat, contact enquiries.

**Communication** — Email & WhatsApp, notification log.

**Reports** — Downloads, analytics.

**Settings** — General & maintenance, Razorpay, Zoho CPaaS / ZeptoMail, WhatsApp (Meta & Zoho), MSG91 SMS, templates, shipping APIs, orders/returns/refunds, delivery zones, timelines, registration, events, certificate verification, sister portals, media storage (optional Cloudflare R2 SigV4), mobile app, app appearance, domains & DNS, security.

**Admin media rule:** pick file → crop (or use full image) → upload cropped file. Previews are 80×80 cover.

About CMS key: `vgmf_about` in local storage, `ABOUT_REVISION = 3`. Empty or tall shipped paths coalesce to the square portraits.

---

## 7. Mobile applications

Primary Android client is the **Expo 54** app in `mobile/` (`org.vaidyagogate.app`, version **1.1.0**). Flutter under `native/flutter` is secondary.

### 7.1 Flavors

| Flavor | Package suffix | Tabs |
| --- | --- | --- |
| Customer | (default) | Home, Events, Shop, Clinics, Account |
| Admin | `.admin` | Desk, Events, Shop, Tickets, Account |
| Staff | `.staff` | Home, Events, Clinics, Tickets, Account |
| Support | `.support` | Home, Tickets, Certificates, Account |

Admin flavor is **read-only** against the published snapshot. Editing stays on the website.

### 7.2 Customer screens (1.1 UI)

Home masthead with greeting, search, icon grid, flyer carousel (1:1 as published), events, publications, articles, videos, gallery, notices, about, support.  
Events with Upcoming / Past / All.  
Shop with category chips and bag badge.  
Clinics as photo + text rows.  
Account: email OTP, orders, tickets, policy links.  
About: 80px left portraits.  
Plus cart (unpaid request; card pay on website), search, FAQ, certificates, contact, policies, gallery, videos, articles, event/clinic/book detail.

### 7.3 Remote appearance

Admin **App appearance** publishes colors, type scale, radius, spacing, product columns, home section titles, and labels. The app caches the last good appearance and refreshes on foreground.

Feed origin: staging `https://staging.vaidyagogate.org` in `app.json` extra.apiUrl (overridable).

### 7.4 UX bar

- 48–50px tap targets.
- Dark-content Android status bar on paper `#F7F3EA`, navigation bar `#FFFDF8`.
- Outline tab icons when inactive, filled when active.
- Empty states explain “publish then pull to refresh”.
- No card checkout inside the app.

---

## 8. Sister portals

| Portal | URL | Use |
| --- | --- | --- |
| Seminar | https://seminar.vaidyagogate.org | Doctor tickets / track |
| Autism | https://autism.vaidyagogate.org | Dashboard |
| Fellowship | https://fellowship.vaidyagogate.org | Dashboard |

Switched from Admin → Site & portal switches / Sister portals.

---

## 9. Platform and hosting

- **Web:** Next.js 16 App Router, standalone output.
- **Environments:** production `vaidyagogate.org`; staging `:3005`; demo `:3012` on VPS `89.116.32.1`.
- **Process manager:** `pm2` apps `vgmf-staging`, `vgmf-demo`.
- **Deploy recipe:** `next build` → assemble standalone + `.next/static` + `public` excluding `public/uploads|slides|apps|apk|app-feed` → rsync into `/VGMF-PLATFORM/apps/{staging,demo}` with the same excludes → `pm2 restart … --update-env`.
- **Media:** local uploads by default; optional Cloudflare R2 via SigV4.
- **i18n:** 13 Indian locales; EN + MR biography fields for the Legacy page.

---

## 10. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Security | No secrets in git. Admin session stays on the server. OTP, not passwords, for customers. |
| Accessibility | Portrait + biography readable without stacking. Hover menus only on fine pointers; chevron tap on touch. 48px controls on Android. |
| Performance | Public About must render shipped defaults even if CMS storage is empty. Skip `data:`/`blob:` images. |
| Reliability | App feed is a published snapshot. Pull-to-refresh after Admin publish. |
| Privacy | Policies published and reachable from account and Android. |
| i18n | Header/footer language control; article translations when authors add them. |
| Observability | Admin analytics and notification log. |

---

## 11. Acceptance criteria (current product)

- [x] About portraits are 80px left squares on desktop and mobile web.
- [x] About dropdown lists only unique About children.
- [x] Events and Shop are plain header links.
- [x] Gallery and Videos do not cross-link.
- [x] Admin upload crop stores only the cropped file.
- [x] Android 1.1 uses the Foundation paper/burgundy system, icon explore grid, event filters, bag badge, and 80px About portraits.
- [x] Site PRD is published as `docs/VGMF-SITE-PRD.md`.

---

## 12. Out of scope

- In-app Razorpay checkout (website only).
- Flutter as the primary Android client.
- Invented journal or magazine section.
- Putting Announcements under Events or Books under Shop.
- Committing credentials, APKs, or upload binaries to git.

---

## 13. Open product decisions

1. When to ship a signed Play Store build of `1.1.0`.
2. Whether customer bag later deep-links into website checkout.
3. Whether sister portals share the same login as the Foundation site.
4. Whether About CMS should move from browser local storage to server persistence (revision already exists).

---

## 14. Source map

| Concern | Location |
| --- | --- |
| Site name, shop, portals | `src/lib/constants.ts` |
| Header menus | `src/lib/nav-menus.ts` |
| About content + portraits | `src/lib/about.ts`, `src/components/about/*` |
| Admin nav | `src/app/(portal)/admin/_config/navigation.ts` |
| Locales | `src/lib/i18n/locales.ts` |
| Expo app | `mobile/` |
| This PRD | `docs/VGMF-SITE-PRD.md` |

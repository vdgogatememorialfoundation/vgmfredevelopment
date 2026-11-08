export type AdminNavItem = {
  label: string
  href: string
}

export type AdminNavGroup = {
  label: string
  items: AdminNavItem[]
}

export const adminNavigation: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin" },
    ],
  },

  {
    label: "Notices",
    items: [
      { label: "Notice board", href: "/admin/notices" },
    ],
  },

  {
    label: "Commerce",
    items: [
      { label: "Orders", href: "/admin/commerce/orders" },
      { label: "In-store POS", href: "/admin/commerce/pos" },
      { label: "Store pickup orders", href: "/admin/commerce/pickup" },
      { label: "Picker scanner", href: "/admin/commerce/picker" },
      { label: "Packer scanner", href: "/admin/commerce/packer" },
      { label: "Pick & pack (all)", href: "/admin/commerce/picking" },
      { label: "Shipment Management", href: "/admin/commerce/shipments" },
      { label: "Quick shipment", href: "/admin/commerce/quick-shipment" },
      { label: "Inventory Management", href: "/admin/commerce/inventory" },
      { label: "Product Management", href: "/admin/commerce/products" },
      { label: "Serviceability", href: "/admin/commerce/serviceability" },
      { label: "Courier performance", href: "/admin/delivery-partners/performance" },
      { label: "Payments", href: "/admin/commerce/payments" },
    ],
  },

  {
    label: "Accounts",
    items: [
      { label: "Staff & co-admin", href: "/admin/accounts/staff" },
      { label: "Customers", href: "/admin/accounts/customers" },
      { label: "Roles & Permissions", href: "/admin/accounts/roles" },
    ],
  },

  {
    label: "Website & CMS",
    items: [
      { label: "Homepage", href: "/admin/website/homepage" },
      { label: "Pages", href: "/admin/website/pages" },
      { label: "Site & portal switches", href: "/admin/website/visibility" },
      { label: "Colours & site text", href: "/admin/website/text" },
      { label: "Festival themes", href: "/admin/website/festivals" },
      { label: "Disclaimers, reels, signup & birthdays", href: "/admin/website/extras" },
      { label: "About Us", href: "/admin/website/about" },
      { label: "Reviews", href: "/admin/website/reviews" },
      { label: "Announcements", href: "/admin/website/announcements" },
      { label: "Slideshow & posters", href: "/admin/website/flyers" },
      { label: "Banners", href: "/admin/website/banners" },
      { label: "Competition awards", href: "/admin/website/awards" },
      { label: "Special thanks", href: "/admin/website/thanks" },
      { label: "Media Library", href: "/admin/website/media" },
      { label: "Gallery", href: "/admin/website/gallery" },
      { label: "Videos", href: "/admin/website/videos" },
      { label: "Seminar videos", href: "/admin/website/seminar-videos" },
      { label: "Clinics", href: "/admin/website/clinics" },
      { label: "Policies", href: "/admin/website/policies" },
    ],
  },

  {
    label: "Articles",
    items: [
      { label: "All articles", href: "/admin/articles" },
      { label: "Create article", href: "/admin/articles/new" },
    ],
  },

  {
    label: "Article approvals",
    items: [
      { label: "Waiting for approval", href: "/admin/articles/approvals" },
    ],
  },

  {
    label: "Events",
    items: [
      { label: "All Events", href: "/admin/events" },
      { label: "Schedule", href: "/admin/events/schedule" },
      { label: "Speakers", href: "/admin/events/speakers" },
    ],
  },

  {
    label: "Certificates",
    items: [
      { label: "All certificates", href: "/admin/certificates" },
      { label: "Verification", href: "/admin/certificates/verification" },
    ],
  },

  {
    label: "Shipping & couriers",
    items: [
      { label: "Shipment orders", href: "/admin/shipments/orders" },
    ],
  },

  {
    label: "Payments",
    items: [
      { label: "Transactions", href: "/admin/payments" },
      { label: "Successful", href: "/admin/payments/successful" },
      { label: "Failed", href: "/admin/payments/failed" },
      { label: "Pending", href: "/admin/payments/pending" },
      { label: "Refunds", href: "/admin/payments/refunds" },
      { label: "Reconciliation", href: "/admin/payments/reconciliation" },
    ],
  },

  {
    label: "Support",
    items: [
      { label: "Tickets & enquiries", href: "/admin/support" },
      { label: "Live chat", href: "/admin/support/chat" },
      { label: "WhatsApp inbox", href: "/admin/support/whatsapp" },
    ],
  },

  {
    label: "Communication",
    items: [
      { label: "Email & WhatsApp", href: "/admin/email" },
      { label: "Notification log", href: "/admin/settings/notifications" },
    ],
  },

  {
    label: "Reports",
    items: [
      { label: "Downloads", href: "/admin/reports" },
      { label: "Analytics", href: "/admin/analytics" },
      { label: "User activity", href: "/admin/analytics/users" },
      { label: "Customer activity", href: "/admin/analytics/customers" },
    ],
  },

  {
    label: "Settings",
    items: [
      { label: "General & maintenance", href: "/admin/settings" },
      { label: "Payments & Razorpay", href: "/admin/settings/payments" },
      { label: "Email: Zoho CPaaS & ZeptoMail", href: "/admin/settings/email" },
      { label: "WhatsApp: Meta & Zoho CPaaS", href: "/admin/settings/whatsapp" },
      { label: "SMS: MSG91", href: "/admin/settings/sms" },
      { label: "Email, SMS & WhatsApp templates", href: "/admin/settings/templates" },
      { label: "Shipping APIs", href: "/admin/settings/shipping-apis" },
      { label: "Orders, returns & refunds", href: "/admin/settings/orders" },
      { label: "Delivery zones", href: "/admin/settings/shipping" },
      { label: "Processing Timelines", href: "/admin/settings/timelines" },
      { label: "Registration", href: "/admin/settings/registration" },
      { label: "Countries", href: "/admin/settings/countries" },
      { label: "Events", href: "/admin/settings/events" },
      { label: "Sister portals", href: "/admin/settings/portals" },
      { label: "Media storage", href: "/admin/settings/media" },
      { label: "Mobile app", href: "/admin/settings/mobile" },
      { label: "App appearance", href: "/admin/settings/appearance" },
      { label: "Domains & DNS", href: "/admin/settings/domains" },
      { label: "Security", href: "/admin/settings/security" },
    ],
  },

  {
    label: "Portals",
    items: [
      { label: "Support portal", href: "/support" },
      { label: "Staff portal", href: "/staff" },
      { label: "Doctor portal", href: "/doctor" },
      { label: "Public website", href: "/" },
    ],
  },
]

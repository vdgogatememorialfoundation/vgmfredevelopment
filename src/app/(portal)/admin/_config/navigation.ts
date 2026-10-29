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
    label: "Commerce",
    items: [
      { label: "Orders", href: "/admin/commerce/orders" },
      { label: "In-store POS", href: "/admin/commerce/pos" },
      { label: "Shipment Management", href: "/admin/commerce/shipments" },
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
      { label: "Staff Accounts", href: "/admin/accounts/staff" },
      { label: "Doctor Accounts", href: "/admin/accounts/doctors" },
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
      { label: "About Us", href: "/admin/website/about" },
      { label: "Announcements", href: "/admin/website/announcements" },
      { label: "Notice Board", href: "/admin/website/notices" },
      { label: "Slideshow & posters", href: "/admin/website/flyers" },
      { label: "Banners", href: "/admin/website/banners" },
      { label: "Media Library", href: "/admin/website/media" },
      { label: "Articles", href: "/admin/articles" },
      { label: "Gallery", href: "/admin/website/gallery" },
      { label: "Videos", href: "/admin/website/videos" },
      { label: "Clinics", href: "/admin/website/clinics" },
      { label: "Policies", href: "/admin/website/policies" },
    ],
  },

  {
    label: "Events",
    items: [
      { label: "All Events", href: "/admin/events" },
      { label: "Create Event", href: "/admin/events/create" },
      { label: "Schedule", href: "/admin/events/schedule" },
      { label: "Speakers", href: "/admin/events/speakers" },
    ],
  },

  {
    label: "Payments",
    items: [
      { label: "Transactions", href: "/admin/payments" },
      { label: "Gateway", href: "/admin/payments/gateway" },
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
      { label: "Support Tickets", href: "/admin/support/tickets" },
      { label: "Contact Enquiries", href: "/admin/support/contact" },
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
    ],
  },

  {
    label: "Settings",
    items: [
      { label: "General & maintenance", href: "/admin/settings" },
      { label: "Payments & Razorpay", href: "/admin/settings/payments" },
      { label: "Email: ZeptoMail & Zoho", href: "/admin/settings/email" },
      { label: "WhatsApp: Meta & Zoho CPaaS", href: "/admin/settings/whatsapp" },
      { label: "Shipping APIs", href: "/admin/settings/shipping-apis" },
      { label: "Orders, returns & refunds", href: "/admin/settings/orders" },
      { label: "Delivery zones", href: "/admin/settings/shipping" },
      { label: "Processing Timelines", href: "/admin/settings/timelines" },
      { label: "Notifications", href: "/admin/settings/notifications" },
      { label: "Registration", href: "/admin/settings/registration" },
      { label: "Events", href: "/admin/settings/events" },
      { label: "Certificate API keys", href: "/admin/settings/api-keys" },
      { label: "Security", href: "/admin/settings/security" },
    ],
  },
]

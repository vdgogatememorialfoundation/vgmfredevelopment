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
      { label: "Shipment Management", href: "/admin/commerce/shipments" },
      { label: "Inventory Management", href: "/admin/commerce/inventory" },
      { label: "Product Management", href: "/admin/commerce/products" },
      { label: "Sellers", href: "/admin/commerce/sellers" },
      { label: "Payments", href: "/admin/commerce/payments" },
    ],
  },

  {
    label: "Accounts",
    items: [
      { label: "All Accounts", href: "/admin/accounts" },
      { label: "Administrators", href: "/admin/accounts/admins" },
      { label: "Staff Accounts", href: "/admin/accounts/staff" },
      { label: "Customers", href: "/admin/accounts/customers" },
      { label: "Seller Accounts", href: "/admin/accounts/sellers" },
      { label: "Delivery Partners", href: "/admin/accounts/delivery-partners" },
      { label: "Roles & Permissions", href: "/admin/accounts/roles" },
    ],
  },

  {
    label: "Website & CMS",
    items: [
      { label: "Homepage Sections", href: "/admin/website/homepage" },
      { label: "Banners & Slideshow", href: "/admin/website/banners" },
      { label: "Announcements", href: "/admin/website/announcements" },
      { label: "Notice Board", href: "/admin/website/notices" },
      { label: "Flyers", href: "/admin/website/flyers" },
      { label: "Media Library", href: "/admin/website/media" },
      { label: "Articles", href: "/admin/articles" },
      { label: "Videos", href: "/admin/website/videos" },
      { label: "Gallery", href: "/admin/website/gallery" },
      { label: "Clinics", href: "/admin/website/clinics" },
      { label: "Testimonials", href: "/admin/website/testimonials" },
      { label: "Partners", href: "/admin/website/partners" },
      { label: "FAQs", href: "/admin/website/faqs" },
    ],
  },

  {
    label: "Events",
    items: [
      { label: "All Events", href: "/admin/events" },
      { label: "Create Event", href: "/admin/events/create" },
      { label: "Registrations", href: "/admin/events/registrations" },
      { label: "Applications", href: "/admin/events/applications" },
      { label: "Speakers", href: "/admin/events/speakers" },
      { label: "Schedule", href: "/admin/events/schedule" },
      { label: "Payments", href: "/admin/events/payments" },
      { label: "Tickets", href: "/admin/events/tickets" },
      { label: "Attendance", href: "/admin/events/attendance" },
      { label: "Certificates", href: "/admin/events/certificates" },
    ],
  },

  {
    label: "Certificates",
    items: [
      { label: "Certificates", href: "/admin/certificates" },
      { label: "Issue Certificate", href: "/admin/certificates/issue" },
      { label: "Reissue", href: "/admin/certificates/reissue" },
      { label: "Verification", href: "/admin/certificates/verification" },
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
      { label: "Donations", href: "/admin/payments/donations" },
      { label: "Reconciliation", href: "/admin/payments/reconciliation" },
    ],
  },

  {
    label: "Support",
    items: [
      { label: "Support Tickets", href: "/admin/support/tickets" },
      { label: "Contact Enquiries", href: "/admin/support/contact" },
      { label: "Newsletter Subscribers", href: "/admin/support/subscribers" },
    ],
  },

  {
    label: "Delivery Partners",
    items: [
      { label: "Partners", href: "/admin/delivery-partners" },
      { label: "Onboarding", href: "/admin/delivery-partners/onboarding" },
      { label: "APIs", href: "/admin/delivery-partners/apis" },
      { label: "Shipments", href: "/admin/delivery-partners/shipments" },
      { label: "Assignments", href: "/admin/delivery-partners/assignments" },
      { label: "Performance", href: "/admin/delivery-partners/performance" },
    ],
  },

  {
    label: "Communication",
    items: [
      { label: "Email Campaigns", href: "/admin/email" },
    ],
  },

  {
    label: "Settings",
    items: [
      { label: "General", href: "/admin/settings" },
      { label: "Registration", href: "/admin/settings/registration" },
      { label: "Events", href: "/admin/settings/events" },
      { label: "Orders", href: "/admin/settings/orders" },
      { label: "Shipping", href: "/admin/settings/shipping" },
      { label: "Processing Timelines", href: "/admin/settings/timelines" },
      { label: "Payments", href: "/admin/settings/payments" },
      { label: "Email", href: "/admin/settings/email" },
      { label: "WhatsApp", href: "/admin/settings/whatsapp" },
      { label: "API Keys", href: "/admin/settings/api-keys" },
      { label: "Notifications", href: "/admin/settings/notifications" },
      { label: "Security", href: "/admin/settings/security" },
    ],
  },
]

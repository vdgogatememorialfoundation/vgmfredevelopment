export const siteConfig = {
  name: "Vaidya Gogate Memorial Foundation",
  shortName: "VGMF",
  tagline: "Preserving Ayurveda. Advancing Knowledge. Serving Society.",
  url: "https://vaidyagogate.org",
  email: "info@vaidyagogate.org",
  phone: "+91 20 1234 5678",
  whatsapp: "+91 98765 43210",
  address: "Vaidya Gogate Memorial Foundation, Pune, Maharashtra, India",
  social: {
    facebook: "#",
    instagram: "#",
    linkedin: "#",
    youtube: "#",
    twitter: "#",
  },
};

export const seminarSiteUrl = "https://seminar.vaidyagogate.org";
export const fellowshipSiteUrl = "https://fellowship.vaidyagogate.org";

export const storeConfig = {
  currency: "INR",
  shippingFee: 49,
  freeShippingThreshold: 499,
  gstRate: 0.05,
  returnDays: 7,
  returnPickupCharges: 50,
  pickupHoldingDays: 3,
  cancellationWindowDays: 1,
  defaultDeliveryDays: 4,
  orderPreparationDays: 1,
  sellerName: "Vaidya Gogate Memorial Foundation Publications",
  paymentGateway: "Razorpay",
  shippingGateway: "Shiprocket",
  courierName: "Ekart Logistics",
  courierPrefix: "EK",
  orderPrefix: "VGMF",
};

export const navigation = [
  { name: "About Us", href: "/about" },
  { name: "Events", href: "/events" },
  { name: "Videos", href: "/videos" },
  { name: "Articles", href: "/articles" },
  { name: "Shop", href: "/shop" },
  { name: "Clinics", href: "/clinics" },
  { name: "Certificate Verification", href: "/certificate-verification" },
  { name: "Contact", href: "/contact" },
] as const;

export const accountNavigation = [
  { name: "My Orders", href: "/account/orders", icon: "orders" },
  { name: "Subscriptions", href: "/account/subscriptions", icon: "subs" },
  { name: "My Payments", href: "/account/payments", icon: "payments" },
  { name: "Payment Receipts", href: "/account/receipts", icon: "receipts" },
  { name: "Support Tickets", href: "/account/tickets", icon: "tickets" },
  { name: "My Wishlist", href: "/account/wishlist", icon: "wishlist" },
  { name: "My Saved Cards", href: "/account/cards", icon: "cards" },
  { name: "Addresses", href: "/account/addresses", icon: "addresses" },
  { name: "Edit Profile", href: "/account/profile", icon: "profile" },
  { name: "Loyalty Points", href: "/account/loyalty", icon: "loyalty" },
  { name: "FAQ", href: "/account/faq", icon: "faq" },
] as const;
export type MegaMenuLink = {
  name: string;
  href: string;
  description: string;
  icon: string;
};

export type MainNavItem =
  | { name: string; href: string; children?: undefined }
  | { name: string; href: string; children: MegaMenuLink[] };

export const mainNavigation: MainNavItem[] = [
  {
    name: "About",
    href: "/about",
    children: [
      { name: "The Foundation", href: "/about/foundation", description: "Mission, vision and what we do", icon: "Landmark" },
      { name: "Legacy of Vaidya R. B. Gogate", href: "/about/legacy-of-vaidya-rb-gogate", description: "Life, scholarship and influence", icon: "Award" },
      { name: "Our History", href: "/about/history", description: "How the Foundation began", icon: "Milestone" },
      { name: "Trustees & Team", href: "/about/trustees", description: "People who guide our work", icon: "Users" },
    ],
  },
  {
    name: "Programmes",
    href: "/programmes",
    children: [
      { name: "All Programmes", href: "/programmes", description: "Education, research, care & outreach", icon: "Sparkles" },
      { name: "Events & Seminars", href: "/events", description: "Seminars, workshops and webinars", icon: "CalendarDays" },
      { name: "Clinics", href: "/clinics", description: "Consultation and Panchakarma care", icon: "Stethoscope" },
      { name: "Certificate Verification", href: "/certificate-verification", description: "Verify a VGMF certificate", icon: "BadgeCheck" },
    ],
  },
  {
    name: "Knowledge",
    href: "/articles",
    children: [
      { name: "Articles", href: "/articles", description: "Essays, research and perspectives", icon: "Newspaper" },
      { name: "Videos", href: "/videos", description: "Lectures, keynotes and films", icon: "PlayCircle" },
      { name: "Gallery", href: "/gallery", description: "Moments from our programmes", icon: "Images" },
      { name: "Notices & Updates", href: "/notices", description: "Deadlines and announcements", icon: "Bell" },
    ],
  },
  { name: "Shop", href: "/shop" },
  { name: "FAQ", href: "/faq" },
  { name: "Contact", href: "/contact" },
];

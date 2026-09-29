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
import { siteConfig } from "@/lib/constants";

export interface Banner {
  id: string;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  image?: string;
  placement: "home-slider" | "home-display" | "shop-top" | "promo-strip";
  theme?: "saffron" | "turmeric" | "leaf" | "lotus" | "peacock";
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  startDate?: string;
  endDate?: string;
}

export const DEFAULT_BANNERS: Banner[] = [
  {
    id: "banner-seminar",
    placement: "home-slider",
    theme: "saffron",
    eyebrow: "National Ayurveda Seminar 2026",
    title: "Classical wisdom, modern clinical practice",
    subtitle: "Three days of lectures, case discussions and hands-on sessions with India's leading Vaidyas.",
    ctaLabel: "View events",
    ctaHref: "/events",
    secondaryLabel: "Download flyer",
    secondaryHref: "/announcements",
  },
  {
    id: "banner-shop",
    placement: "home-slider",
    theme: "leaf",
    eyebrow: "Foundation Publications",
    title: "The writings of Vaidya R. B. Gogate",
    subtitle: "Clinical references and scholarly works, delivered to your door.",
    ctaLabel: "Visit the shop",
    ctaHref: "/shop",
  },
  {
    id: "banner-clinics",
    placement: "home-slider",
    theme: "peacock",
    eyebrow: "Arogya — community care",
    title: "Find an Ayurveda clinic near you",
    subtitle: "Consult experienced physicians trained in the Gogate tradition.",
    ctaLabel: "Find a clinic",
    ctaHref: "/clinics",
  },
  {
    id: "banner-donate",
    placement: "home-slider",
    theme: "lotus",
    eyebrow: "Seva — support our mission",
    title: "Fund scholarships, research and free health camps",
    subtitle: "Every contribution is eligible for 80G tax benefits.",
    ctaLabel: "Donate now",
    ctaHref: "/donate",
  },
  {
    id: "banner-display",
    placement: "home-display",
    theme: "turmeric",
    eyebrow: "Admissions open",
    title: "Vaidya Gogate Fellowship 2026-27",
    subtitle: "A year-long mentored programme in classical Ayurveda practice. Applications close soon.",
    ctaLabel: "Track application",
    ctaHref: "/application-status",
    secondaryLabel: "Programmes",
    secondaryHref: "/programmes",
  },
  {
    id: "banner-shop-top",
    placement: "shop-top",
    theme: "saffron",
    eyebrow: "Free delivery",
    title: "Free shipping on orders above ₹999",
    subtitle: "Books are packed with care and dispatched within 2 working days.",
    ctaLabel: "Shipping policy",
    ctaHref: "/shipping-policy",
  },
];

export interface HomepageSettings {
  showSlider: boolean;
  sliderInterval: number;
  showDisplayBanner: boolean;
  showFlyers: boolean;
  showAnnouncements: boolean;
  showEvents: boolean;
  showDoshas: boolean;
  showHerbs: boolean;
  showBooks: boolean;
  showArticles: boolean;
  showClinics: boolean;
  showTestimonials: boolean;
  showPartners: boolean;
  showFaq: boolean;
  showShloka: boolean;
}

export interface GeneralSettings {
  siteName: string;
  tagline: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

export interface RegistrationSettings {
  allowSelfSignup: boolean;
  requireLoginForShop: boolean;
  requireLoginForEvents: boolean;
  registrationNote: string;
}

export const DEFAULT_HOMEPAGE: HomepageSettings = {
  showSlider: true,
  sliderInterval: 6,
  showDisplayBanner: true,
  showFlyers: true,
  showAnnouncements: true,
  showEvents: true,
  showDoshas: true,
  showHerbs: true,
  showBooks: true,
  showArticles: true,
  showClinics: true,
  showTestimonials: true,
  showPartners: true,
  showFaq: true,
  showShloka: true,
};

export const DEFAULT_GENERAL: GeneralSettings = {
  siteName: siteConfig.name,
  tagline: siteConfig.tagline,
  email: siteConfig.email,
  phone: siteConfig.phone,
  whatsapp: siteConfig.whatsapp,
  address: siteConfig.address,
  maintenanceMode: false,
  maintenanceMessage: "We are updating the website. Please check back shortly.",
};

export const DEFAULT_REGISTRATION: RegistrationSettings = {
  allowSelfSignup: false,
  requireLoginForShop: true,
  requireLoginForEvents: true,
  registrationNote: "Accounts are created by the Foundation office. Contact us if you need access.",
};

export const DEFAULT_SETTINGS: Record<string, object> = {
  homepage: DEFAULT_HOMEPAGE,
  general: DEFAULT_GENERAL,
  registration: DEFAULT_REGISTRATION,
};

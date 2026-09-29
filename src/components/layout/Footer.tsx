import Link from "next/link";
import { ArrowUpRight, HeartHandshake, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Logo from "@/components/graphics/Logo";
import Diya from "@/components/graphics/Diya";
import Lotus from "@/components/graphics/Lotus";
import Mandala from "@/components/graphics/Mandala";
import Toran from "@/components/graphics/Toran";
import SocialIcons from "@/components/common/SocialIcons";
import NewsletterForm from "@/components/layout/NewsletterForm";
import { fellowshipSiteUrl, seminarSiteUrl, siteConfig } from "@/lib/constants";

const columns = [
  {
    title: "Foundation",
    links: [
      { name: "About us", href: "/about" },
      { name: "Legacy of Vaidya Gogate", href: "/about/legacy-of-vaidya-rb-gogate" },
      { name: "Our history", href: "/about/history" },
      { name: "Trustees & team", href: "/about/trustees" },
      { name: "Support us", href: "/donate" },
    ],
  },
  {
    title: "Programmes",
    links: [
      { name: "All programmes", href: "/programmes" },
      { name: "Events & seminars", href: "/events" },
      { name: "Clinics", href: "/clinics" },
      { name: "Certificate verification", href: "/certificate-verification" },
      { name: "Application status", href: "/application-status" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Articles", href: "/articles" },
      { name: "Videos", href: "/videos" },
      { name: "Publications shop", href: "/shop" },
      { name: "Gallery", href: "/gallery" },
      { name: "FAQ", href: "/faq" },
    ],
  },
];

const legalLinks = [
  { name: "Privacy", href: "/privacy" },
  { name: "Terms", href: "/terms" },
  { name: "Refund", href: "/refund-policy" },
  { name: "Shipping", href: "/shipping-policy" },
];

const portalLinks = [
  { name: "Admin", href: "/admin" },
  { name: "Staff", href: "/staff" },
  { name: "Seller portal", href: "/seller" },
];

export default function Footer() {
  const whatsapp = siteConfig.whatsapp.replace(/\D/g, "");

  return (
    <footer className="relative overflow-hidden bg-warm-cream text-text-primary">
      <Toran className="relative z-10" />
      <div className="pointer-events-none absolute inset-0 bg-rangoli opacity-60" />
      <Mandala className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] text-gold/30 animate-spin-slow" />
      <Lotus className="pointer-events-none absolute -bottom-6 -left-10 h-40 w-56 opacity-40" />

      {/* CTA band */}
      <div className="container relative pt-10">
        <div className="relative overflow-hidden rounded-3xl bg-saffron p-8 text-white shadow-[0_30px_60px_-30px_rgb(194_65_12/0.6)] sm:p-10 lg:p-12">
          <Mandala className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 text-white/20 animate-spin-slow" />
          <Diya className="pointer-events-none absolute right-6 top-6 hidden h-14 w-14 sm:block" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-light">
                Stay connected
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">
                Seminars, publications and research — straight to your inbox.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">
                A short monthly letter from the Foundation. No spam, unsubscribe anytime.
              </p>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </div>

      <div className="container relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <Logo />
              <div>
                <p className="font-display text-xl font-semibold leading-tight">Vaidya Gogate</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-burgundy">
                  Memorial Foundation
                </p>
              </div>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-7 text-text-muted">{siteConfig.tagline}</p>
            <p className="mt-3 font-sanskrit text-lg text-burgundy">सर्वे भवन्तु सुखिनः</p>

            <ul className="mt-6 space-y-3 text-sm text-text-muted">
              <li className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 shrink-0 text-burgundy" />
                {siteConfig.address}
              </li>
              <li>
                <a href={`mailto:${siteConfig.email}`} className="flex items-center gap-3 transition hover:text-burgundy">
                  <Mail size={16} className="shrink-0 text-burgundy" />
                  {siteConfig.email}
                </a>
              </li>
              <li>
                <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 transition hover:text-burgundy">
                  <Phone size={16} className="shrink-0 text-burgundy" />
                  {siteConfig.phone}
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 transition hover:text-burgundy"
                >
                  <MessageCircle size={16} className="shrink-0 text-sage" />
                  WhatsApp {siteConfig.whatsapp}
                </a>
              </li>
            </ul>

            <SocialIcons className="mt-6" />
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={`Footer ${column.title}`}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-burgundy">
                {column.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-sm text-text-muted transition hover:text-burgundy"
                    >
                      <span className="h-px w-0 bg-gold transition-all duration-300 group-hover:w-3" />
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {[
            { href: seminarSiteUrl, label: "VGMF Seminar website" },
            { href: fellowshipSiteUrl, label: "VGMF Fellowship programme" },
          ].map((portal) => (
            <a
              key={portal.href}
              href={portal.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-2xl border border-border bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-burgundy/40"
            >
              <span>
                <span className="block text-xs uppercase tracking-[0.16em] text-sage">Official portal</span>
                <span className="mt-1 block font-semibold">{portal.label}</span>
              </span>
              <ArrowUpRight size={18} className="text-text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-burgundy" />
            </a>
          ))}
        </div>
      </div>

      <div className="relative border-t border-border bg-gold-light/60">
        <div className="container flex flex-col items-center justify-between gap-4 py-6 text-xs text-text-muted lg:flex-row">
          <p className="flex items-center gap-1.5">
            © {new Date().getFullYear()} {siteConfig.name}. Made with
            <HeartHandshake size={13} className="text-lotus" />
            in Pune.
          </p>
          <nav aria-label="Footer legal links" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-burgundy">
                {link.name}
              </Link>
            ))}
          </nav>
          <nav aria-label="Portal links" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {portalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="font-medium text-burgundy/80 transition hover:text-burgundy">
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

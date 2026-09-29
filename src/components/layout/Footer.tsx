import Link from "next/link";
import { ArrowUpRight, HeartHandshake, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Logo from "@/components/graphics/Logo";
import Mandala from "@/components/graphics/Mandala";
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
    <footer className="relative overflow-hidden bg-navy text-white">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <Mandala className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] text-gold/10 animate-spin-slow" />

      {/* CTA band */}
      <div className="container relative pt-16">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-burgundy to-burgundy-dark p-8 shadow-2xl sm:p-10 lg:p-12">
          <Mandala className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 text-white/10" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Stay connected
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">
                Seminars, publications and research — straight to your inbox.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
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
              <Logo light />
              <div>
                <p className="font-display text-xl font-semibold leading-tight">Vaidya Gogate</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                  Memorial Foundation
                </p>
              </div>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/65">{siteConfig.tagline}</p>

            <ul className="mt-6 space-y-3 text-sm text-white/75">
              <li className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 shrink-0 text-gold" />
                {siteConfig.address}
              </li>
              <li>
                <a href={`mailto:${siteConfig.email}`} className="flex items-center gap-3 transition hover:text-gold">
                  <Mail size={16} className="shrink-0 text-gold" />
                  {siteConfig.email}
                </a>
              </li>
              <li>
                <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 transition hover:text-gold">
                  <Phone size={16} className="shrink-0 text-gold" />
                  {siteConfig.phone}
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 transition hover:text-gold"
                >
                  <MessageCircle size={16} className="shrink-0 text-gold" />
                  WhatsApp {siteConfig.whatsapp}
                </a>
              </li>
            </ul>

            <SocialIcons className="mt-6" />
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={`Footer ${column.title}`}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {column.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-sm text-white/70 transition hover:text-white"
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
          <a
            href={seminarSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glass group flex items-center justify-between rounded-2xl px-5 py-4 transition hover:border-gold/50"
          >
            <span>
              <span className="block text-xs uppercase tracking-[0.16em] text-gold">Official portal</span>
              <span className="mt-1 block font-semibold">VGMF Seminar website</span>
            </span>
            <ArrowUpRight size={18} className="text-white/60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold" />
          </a>
          <a
            href={fellowshipSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glass group flex items-center justify-between rounded-2xl px-5 py-4 transition hover:border-gold/50"
          >
            <span>
              <span className="block text-xs uppercase tracking-[0.16em] text-gold">Official portal</span>
              <span className="mt-1 block font-semibold">VGMF Fellowship programme</span>
            </span>
            <ArrowUpRight size={18} className="text-white/60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold" />
          </a>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-4 py-6 text-xs text-white/50 lg:flex-row">
          <p className="flex items-center gap-1.5">
            © {new Date().getFullYear()} {siteConfig.name}. Made with
            <HeartHandshake size={13} className="text-gold" />
            in Pune.
          </p>
          <nav aria-label="Footer legal links" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {link.name}
              </Link>
            ))}
          </nav>
          <nav aria-label="Portal links" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {portalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="font-medium text-gold/80 transition hover:text-gold">
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import SiteLogo from "@/components/common/SiteLogo";

const quickLinks = [
  { name: "About", href: "/about" },
  { name: "Events", href: "/events" },
  { name: "Videos", href: "/videos" },
  { name: "Articles", href: "/articles" },
  { name: "Shop", href: "/shop" },
  { name: "Clinics", href: "/clinics" },
  { name: "Contact", href: "/contact" },
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
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-warm-cream text-text-primary">
      <div className="container py-10">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <SiteLogo size={40} />
            <div>
              <p className="font-semibold leading-tight">Vaidya Gogate</p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                Memorial Foundation
              </p>
            </div>
          </div>

          {/* Quick links */}
          <nav aria-label="Footer quick links" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-text-muted transition hover:text-burgundy"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Contact */}
          <div className="flex flex-col items-center gap-1 text-sm text-text-muted md:items-end">
            <a href="mailto:info@vaidyagogate.org" className="transition hover:text-burgundy">
              info@vaidyagogate.org
            </a>
            <span>+91 20 1234 5678</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-text-muted md:flex-row">
          <p>
            © {new Date().getFullYear()} Vaidya Gogate Memorial Foundation.
            All rights reserved.
          </p>

          <nav aria-label="Footer legal links" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-burgundy"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <nav aria-label="Portal links" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {portalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-medium text-burgundy transition hover:text-burgundy"
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
import Link from "next/link";

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
  { name: "Seller portal", href: "/seller" },
];

export default function Footer() {
  return (
    <footer className="bg-text-primary text-white">
      <div className="container py-10">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-burgundy/40 bg-burgundy/10">
              <span className="text-[9px] font-bold text-burgundy">VGMF</span>
            </div>
            <div>
              <p className="font-semibold leading-tight">Vaidya Gogate</p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">
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
                className="text-sm text-white/60 transition hover:text-white"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Contact */}
          <div className="flex flex-col items-center gap-1 text-sm text-white/60 md:items-end">
            <a href="mailto:info@vaidyagogate.org" className="transition hover:text-white">
              info@vaidyagogate.org
            </a>
            <span>+91 20 1234 5678</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/40 md:flex-row">
          <p>
            © {new Date().getFullYear()} Vaidya Gogate Memorial Foundation.
            All rights reserved.
          </p>

          <nav aria-label="Footer legal links" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-white/80"
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
                className="font-medium text-burgundy transition hover:text-white"
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
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
    <footer className="border-t border-border bg-white text-text-primary">
      <div className="container py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-3">
              <SiteLogo size={40} />
              <div>
                <p className="font-semibold leading-tight">Vaidya Gogate</p>
                <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                  Memorial Foundation
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-text-muted">
              Ayurveda education, publications and clinical care.
            </p>
          </div>

          <nav aria-label="Footer quick links">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Explore</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-text-primary transition hover:text-burgundy">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Contact</p>
            <div className="mt-3 grid gap-2 text-sm text-text-primary">
              <a href="mailto:info@vaidyagogate.org" className="transition hover:text-burgundy">
                info@vaidyagogate.org
              </a>
              <span>+91 20 1234 5678</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-text-muted sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Vaidya Gogate Memorial Foundation. All rights reserved.</p>
          <nav aria-label="Footer legal links" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-burgundy">
                {link.name}
              </Link>
            ))}
            {portalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="font-medium text-burgundy transition hover:text-burgundy-dark">
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

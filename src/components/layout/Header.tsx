"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  BadgeCheck,
  ChevronDown,
  CircleHelp,
  Clock,
  CreditCard,
  Heart,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Package,
  Phone,
  Receipt,
  Search,
  ShoppingBag,
  Ticket,
  User,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import SearchDialog from "@/components/common/SearchDialog";
import DynamicIcon from "@/components/common/DynamicIcon";
import SocialIcons from "@/components/common/SocialIcons";
import Logo from "@/components/graphics/Logo";
import { useCart } from "@/lib/use-cart";
import { accountNavigation, mainNavigation, siteConfig } from "@/lib/constants";
import { classNames } from "@/lib/utils";

const accountIcons: Record<string, LucideIcon> = {
  orders: Package,
  subs: Clock,
  payments: Wallet,
  receipts: Receipt,
  tickets: Ticket,
  wishlist: Heart,
  cards: CreditCard,
  addresses: MapPin,
  profile: User,
  loyalty: Award,
  faq: CircleHelp,
  certificate: BadgeCheck,
  dashboard: LayoutDashboard,
  logout: LogOut,
};

function AccountIcon({ name }: { name: string }) {
  const Icon = accountIcons[name] ?? User;
  return <Icon size={17} strokeWidth={1.8} />;
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, signOut } = useAuth();
  const { count } = useCart();
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMobileMenuOpen(false);
      setAccountMenuOpen(false);
      setOpenDropdown(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setOpenDropdown(null);
        setMobileMenuOpen(false);
      }
    }
    function handleScroll() {
      setScrolled(window.scrollY > 24);
    }
    handleScroll();
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileMenuOpen]);

  const handleSignOut = () => {
    signOut();
    setAccountMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "";

  const isActive = (href: string, children?: { href: string }[]) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    Boolean(children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)));

  return (
    <>
      <header className="sticky top-0 z-50">
        {/* Utility bar */}
        <div
          className={classNames(
            "overflow-hidden bg-gold-light text-text-primary transition-all duration-300",
            scrolled ? "max-h-0" : "max-h-12"
          )}
        >
          <div className="container flex items-center justify-between gap-4 py-2 text-xs">
            <div className="hidden items-center gap-5 sm:flex">
              <a
                href={`mailto:${siteConfig.email}`}
                className="flex items-center gap-1.5 text-text-muted transition hover:text-burgundy"
              >
                <Mail size={13} />
                {siteConfig.email}
              </a>
              <a
                href={`tel:${siteConfig.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-1.5 text-text-muted transition hover:text-burgundy"
              >
                <Phone size={13} />
                {siteConfig.phone}
              </a>
              <span className="hidden items-center gap-1.5 text-text-muted/80 lg:flex">
                <MapPin size={13} />
                Pune, Maharashtra
              </span>
            </div>

            <div className="ml-auto flex items-center gap-4">
              <Link
                href="/certificate-verification"
                className="hidden items-center gap-1.5 text-text-muted transition hover:text-burgundy md:flex"
              >
                <BadgeCheck size={13} />
                Verify Certificate
              </Link>
              {isAuthenticated ? (
                <span className="hidden font-mono text-text-muted md:inline">
                  {user?.accountId}
                </span>
              ) : (
                <Link href="/login" className="text-text-muted transition hover:text-burgundy">
                  Sign in · Create account
                </Link>
              )}
              <SocialIcons
                className="hidden gap-1 lg:flex"
                itemClassName="h-6 w-6 border-transparent [&_svg]:h-3 [&_svg]:w-3"
              />
            </div>
          </div>
        </div>

        <div className="bg-toran-stripe h-1" aria-hidden="true" />

        {/* Main bar */}
        <div
          className={classNames(
            "border-b transition-all duration-300",
            scrolled
              ? "border-border/80 bg-white/90 shadow-[0_10px_30px_-18px_rgb(154_52_18/0.35)] backdrop-blur-xl"
              : "border-border bg-white"
          )}
        >
          <div className="container">
            <div
              className={classNames(
                "flex items-center justify-between gap-4 transition-all duration-300",
                scrolled ? "h-[68px]" : "h-[80px]"
              )}
            >
              <Link
                href="/"
                className="group flex min-w-0 items-center gap-3"
                aria-label="Vaidya Gogate Memorial Foundation — Home"
              >
                <Logo className="transition duration-500 group-hover:rotate-[20deg]" />
                <div className="min-w-0">
                  <div className="truncate font-display text-[18px] font-semibold leading-tight text-text-primary sm:text-[20px]">
                    Vaidya Gogate
                  </div>
                  <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-gold sm:text-[11px] sm:tracking-[0.22em]">
                    Memorial Foundation
                  </div>
                </div>
              </Link>

              {/* Desktop navigation */}
              <nav aria-label="Main navigation" className="hidden items-center gap-1 xl:flex">
                {mainNavigation.map((item) => {
                  const active = isActive(item.href, item.children);
                  if (!item.children) {
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={classNames(
                          "relative rounded-full px-3.5 py-2 text-sm font-medium transition",
                          active ? "text-burgundy" : "text-text-primary hover:bg-warm-cream hover:text-burgundy"
                        )}
                      >
                        {item.name}
                        {active && (
                          <span className="absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-gold" />
                        )}
                      </Link>
                    );
                  }

                  const open = openDropdown === item.name;
                  return (
                    <div
                      key={item.name}
                      className="relative"
                      onMouseEnter={() => setOpenDropdown(item.name)}
                      onMouseLeave={() => setOpenDropdown(null)}
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-haspopup="true"
                        onClick={() => setOpenDropdown(open ? null : item.name)}
                        className={classNames(
                          "relative flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition",
                          active || open ? "text-burgundy" : "text-text-primary hover:bg-warm-cream hover:text-burgundy"
                        )}
                      >
                        {item.name}
                        <ChevronDown
                          size={14}
                          className={classNames("transition duration-300", open && "rotate-180")}
                        />
                        {active && (
                          <span className="absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-gold" />
                        )}
                      </button>

                      <div
                        className={classNames(
                          "absolute left-1/2 top-full w-[520px] -translate-x-1/2 pt-3 transition duration-300",
                          open ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"
                        )}
                      >
                        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_30px_60px_-20px_rgb(154_52_18/0.3)]">
                          <div className="grid grid-cols-2 gap-1 p-3">
                            {item.children.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className="group/item flex items-start gap-3 rounded-xl p-3 transition hover:bg-warm-cream"
                              >
                                <span className="icon-tile h-10 w-10 group-hover/item:bg-burgundy group-hover/item:text-white">
                                  <DynamicIcon name={child.icon} size={18} />
                                </span>
                                <span>
                                  <span className="block text-sm font-semibold text-text-primary group-hover/item:text-burgundy">
                                    {child.name}
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-5 text-text-muted">
                                    {child.description}
                                  </span>
                                </span>
                              </Link>
                            ))}
                          </div>
                          <Link
                            href={item.href}
                            className="flex items-center justify-between bg-gold-light px-5 py-3 text-xs font-semibold text-burgundy transition hover:bg-burgundy hover:text-white"
                          >
                            Explore {item.name.toLowerCase()}
                            <span aria-hidden="true">→</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search the site"
                  className="hidden h-10 items-center gap-2 rounded-full border border-border px-3 text-sm text-text-muted transition hover:border-burgundy hover:text-burgundy md:flex"
                >
                  <Search size={16} />
                  <span className="hidden 2xl:inline">Search</span>
                  <kbd className="hidden rounded-md border border-border bg-warm-cream px-1.5 py-0.5 font-sans text-[10px] font-semibold 2xl:inline">
                    Ctrl K
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-primary md:hidden"
                >
                  <Search size={18} />
                </button>

                <Link
                  href="/cart"
                  aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-primary transition hover:border-burgundy hover:bg-burgundy/5 hover:text-burgundy"
                >
                  <ShoppingBag size={18} />
                  {count > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy ring-2 ring-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>

                {isAuthenticated && user ? (
                  <div className="relative hidden lg:block" ref={accountMenuRef}>
                    <button
                      type="button"
                      onClick={() => setAccountMenuOpen((open) => !open)}
                      aria-expanded={accountMenuOpen}
                      aria-haspopup="menu"
                      className="flex items-center gap-2 rounded-full border border-border py-1.5 pl-1.5 pr-3 transition hover:border-burgundy"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-burgundy to-gold text-xs font-bold text-white">
                        {initials}
                      </span>
                      <span className="max-w-[100px] truncate text-sm font-medium text-text-primary">
                        {user.firstName}
                      </span>
                      <ChevronDown size={14} className="text-text-muted" />
                    </button>

                    {accountMenuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-border bg-white shadow-2xl animate-[fade-up_0.25s_ease_both]"
                      >
                        <div className="bg-saffron px-5 py-4 text-white">
                          <p className="font-semibold">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="mt-0.5 text-xs text-white/70">{user.email}</p>
                          <p className="mt-1 font-mono text-xs tracking-[0.08em] text-gold-light">
                            {user.accountId}
                          </p>
                        </div>

                        <nav aria-label="Account menu" className="max-h-80 overflow-y-auto py-2">
                          {accountNavigation.map((item) => {
                            const active = pathname === item.href;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                role="menuitem"
                                className={classNames(
                                  "flex items-center gap-3 px-5 py-2.5 text-sm transition",
                                  active
                                    ? "font-semibold text-burgundy"
                                    : "text-text-primary hover:bg-warm-cream hover:text-burgundy"
                                )}
                              >
                                <AccountIcon name={item.icon} />
                                {item.name}
                              </Link>
                            );
                          })}

                          {user.role === "admin" && (
                            <ConsoleLink href="/admin" pathname={pathname} label="Admin console" icon="dashboard" />
                          )}
                          {user.role === "staff" && (
                            <ConsoleLink href="/staff" pathname={pathname} label="Staff console" icon="dashboard" />
                          )}
                          {user.role === "seller" && (
                            <ConsoleLink href="/seller" pathname={pathname} label="Seller portal" icon="orders" />
                          )}
                        </nav>

                        <div className="border-t border-border p-2">
                          <button
                            type="button"
                            onClick={handleSignOut}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            <AccountIcon name="logout" />
                            Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href="/login"
                    aria-label="Login or create account"
                    className="hidden h-10 w-10 items-center justify-center rounded-full border border-border text-text-primary transition hover:border-burgundy hover:bg-burgundy/5 hover:text-burgundy lg:flex"
                  >
                    <User size={18} />
                  </Link>
                )}

                <Link href="/donate" className="btn-gold hidden px-5 py-2.5 text-sm lg:inline-flex">
                  <HeartHandshake size={16} />
                  Support Us
                </Link>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-primary xl:hidden"
                  aria-label="Open menu"
                  aria-expanded={mobileMenuOpen}
                >
                  <Menu size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={classNames(
          "fixed inset-0 z-[65] xl:hidden",
          mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileMenuOpen}
      >
        <div
          className={classNames(
            "absolute inset-0 bg-[#3b1f0e]/30 backdrop-blur-sm transition-opacity duration-300",
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside
          className={classNames(
            "absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          )}
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <Logo className="h-9 w-9" />
              <span className="font-display text-lg font-semibold">Menu</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <Link
              href="/"
              className={classNames(
                "block rounded-xl px-3 py-3 text-[15px] font-medium",
                pathname === "/" ? "bg-burgundy/5 text-burgundy" : "text-text-primary"
              )}
            >
              Home
            </Link>
            {mainNavigation.map((item) => {
              if (!item.children) {
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={classNames(
                      "block rounded-xl px-3 py-3 text-[15px] font-medium",
                      isActive(item.href) ? "bg-burgundy/5 text-burgundy" : "text-text-primary"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              }
              const open = mobileSection === item.name;
              return (
                <div key={item.name}>
                  <button
                    type="button"
                    onClick={() => setMobileSection(open ? null : item.name)}
                    aria-expanded={open}
                    className={classNames(
                      "flex w-full items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium",
                      isActive(item.href, item.children) ? "text-burgundy" : "text-text-primary"
                    )}
                  >
                    {item.name}
                    <ChevronDown size={16} className={classNames("transition", open && "rotate-180")} />
                  </button>
                  <div
                    className={classNames(
                      "grid transition-all duration-300",
                      open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="mb-2 ml-3 space-y-1 border-l-2 border-gold/40 pl-3">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-text-primary hover:bg-warm-cream"
                          >
                            <DynamicIcon name={child.icon} size={16} className="text-burgundy" />
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="space-y-3 border-t border-border p-5">
            <Link href="/donate" className="btn-gold w-full">
              <HeartHandshake size={16} />
              Support Us
            </Link>
            <Link href={isAuthenticated ? "/account" : "/login"} className="btn-outline w-full">
              {isAuthenticated ? "My Account" : "Sign In / Create Account"}
            </Link>
          </div>
        </aside>
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function ConsoleLink({
  href,
  pathname,
  label,
  icon,
}: {
  href: string;
  pathname: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={classNames(
        "flex items-center gap-3 border-t border-dashed border-border px-5 py-2.5 text-sm transition",
        pathname === href
          ? "font-semibold text-burgundy"
          : "text-text-primary hover:bg-warm-cream hover:text-burgundy"
      )}
    >
      <AccountIcon name={icon} />
      {label}
    </Link>
  );
}

"use client";

import Link from "next/link";
import SiteLogo from "@/components/common/SiteLogo";
import ShlokaBar from "@/components/layout/ShlokaBar";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { leaveAfterSignOut } from "@/lib/auth";
import { useCart } from "@/lib/use-cart";
import { classNames } from "@/lib/utils";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { navMessageKey } from "@/lib/i18n/messages";
import { getLiveCmsPages } from "@/lib/cms-pages";
import {
  getSiteVisibility,
  visibleAccountNav,
  visiblePublicNav,
} from "@/lib/site-visibility";
import {
  cleanChrome,
  headerShell,
  headerStyleOf,
  isExternal,
} from "@/lib/site-chrome";
import type { SiteChromeLink } from "@/types";
import { subscribeCms } from "@/lib/cms";
import { useSiteSettings } from "@/lib/use-cms";
import { PartnerPortalBadges } from "@/components/account/PartnerPortalBadges";
import { DeliverTo } from "@/components/layout/DeliverTo";
import { navDropdown, navHasMenu } from "@/lib/nav-menus";

function canHover() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

function CartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function AnchoredMenu({
  open,
  getAnchor,
  align = "left",
  children,
}: {
  open: boolean;
  getAnchor: () => HTMLElement | null;
  align?: "left" | "right";
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const readAnchor = useRef(getAnchor);
  readAnchor.current = getAnchor;

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = readAnchor.current();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = align === "right" ? 288 : 256;
      const left =
        align === "right"
          ? Math.max(8, rect.right - width)
          : Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPos({ top: rect.bottom + 8, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  if (!open || !pos || typeof document === "undefined") return null;
  return createPortal(
    <div
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 200 }}
    >
      {children}
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [desktopMenu, setDesktopMenu] = useState("");
  const [mobileOpen, setMobileOpen] = useState("");
  const closeTimer = useRef<number>(0);
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();
  const { count } = useCart();
  const { t } = useI18n();
  const settings = useSiteSettings();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useSyncExternalStore(
    subscribeCms,
    () =>
      `${window.localStorage.getItem("vgmf_site_visibility") ?? ""}|${window.localStorage.getItem("vgmf_cms_pages") ?? ""}|${window.localStorage.getItem("vgmf_settings") ?? ""}`,
    () => "",
  );
  const visibility = getSiteVisibility();
  const navItems = visiblePublicNav(visibility);
  const accountItems = visibleAccountNav(visibility);
  const chrome = cleanChrome(settings?.chrome);
  const shell = headerShell[headerStyleOf(chrome)];
  const extraPages = getLiveCmsPages().filter((page) => page.showInNav);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMobileMenuOpen(false);
      setAccountMenuOpen(false);
      setDesktopMenu("");
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileOpen("");
      return;
    }
    const current = window.location.pathname;
    const match = visiblePublicNav(getSiteVisibility()).find(
      (item) => current === item.href || current.startsWith(`${item.href}/`),
    );
    setMobileOpen(match && navHasMenu(match.href) ? match.href : "");
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("[data-account-menu]") ||
        target?.closest("[data-nav-menu]")
      )
        return;
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
      if (
        desktopNavRef.current &&
        !desktopNavRef.current.contains(event.target as Node)
      ) {
        setDesktopMenu("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    signOut();
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    leaveAfterSignOut("/login");
  };

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <>
      <ShlokaBar />
      {chrome.headerText ? (
        <div className="border-b border-gold/30 bg-paper px-4 py-1.5 text-center text-xs font-medium text-ink sm:text-sm">
          {chrome.headerTextHref ? (
            <ChromeLink
              link={{ label: chrome.headerText, href: chrome.headerTextHref }}
              className="hover:text-burgundy"
            />
          ) : (
            chrome.headerText
          )}
        </div>
      ) : null}
      <div
        className={classNames(
          shell.outer,
          chrome.headerSticky ? "sticky top-0 z-40" : "relative z-30",
        )}
      >
        <header
          className={classNames("relative z-30 overflow-visible", shell.header)}
        >
          <div className="container">
            <div className="flex h-[78px] items-center justify-between gap-4">
              {/* Logo */}
              <Link
                href="/"
                className="flex min-w-0 flex-1 items-center gap-2 overflow-visible sm:gap-3 lg:flex-none"
                aria-label="Vaidya Gogate Memorial Foundation — Home"
              >
                <SiteLogo size={48} />
                <span
                  className="hidden h-10 w-px bg-gold/50 sm:block"
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="truncate font-serif text-[14px] font-semibold leading-tight text-ink sm:text-base">
                    {settings?.siteName
                      ?.replace(/Memorial Foundation/i, "")
                      .trim() || "Vaidya Gogate"}
                  </div>
                  <div className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-gold sm:text-[11px]">
                    Memorial Foundation
                  </div>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <nav
                ref={desktopNavRef}
                aria-label="Main navigation"
                className="hidden items-center lg:flex lg:gap-3 xl:gap-6"
              >
                {navItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const children = navDropdown(item.href);
                  const opened = desktopMenu === item.href;
                  const openThis = () => {
                    window.clearTimeout(closeTimer.current);
                    setDesktopMenu(item.href);
                  };
                  const closeSoon = () => {
                    window.clearTimeout(closeTimer.current);
                    closeTimer.current = window.setTimeout(
                      () => setDesktopMenu(""),
                      180,
                    );
                  };
                  return (
                    <div
                      key={item.href}
                      className="relative"
                      ref={(node) => {
                        itemRefs.current[item.href] = node;
                      }}
                      onMouseEnter={() => {
                        if (canHover() && children.length) openThis();
                      }}
                      onMouseLeave={() => {
                        if (canHover()) closeSoon();
                      }}
                    >
                      <div className="inline-flex items-center gap-0.5">
                        <Link
                          href={item.href}
                          className={classNames(
                            "relative whitespace-nowrap text-[12px] font-medium tracking-wide transition xl:text-[13px]",
                            isActive
                              ? "text-burgundy"
                              : "text-text-primary hover:text-burgundy",
                          )}
                        >
                          {t(navMessageKey[item.href] ?? "nav.about")}
                        </Link>
                        {children.length ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              window.clearTimeout(closeTimer.current);
                              setDesktopMenu(opened ? "" : item.href);
                            }}
                            aria-expanded={opened}
                            aria-haspopup="true"
                            aria-label={`${t(navMessageKey[item.href] ?? "nav.about")} menu`}
                            className={classNames(
                              "inline-flex h-7 w-6 items-center justify-center text-[10px] transition",
                              isActive
                                ? "text-burgundy"
                                : "text-text-primary hover:text-burgundy",
                            )}
                          >
                            {opened ? "▴" : "▾"}
                          </button>
                        ) : null}
                      </div>
                      {opened && children.length ? (
                        <AnchoredMenu
                          open
                          getAnchor={() => itemRefs.current[item.href] ?? null}
                          align="left"
                        >
                          <div
                            data-nav-menu
                            className="min-w-56 overflow-hidden rounded-2xl border border-border bg-white py-2 shadow-xl"
                          >
                            {children.map((page) => {
                              const active = pathname === page.href;
                              return (
                                <Link
                                  key={page.href}
                                  href={page.href}
                                  onClick={() => setDesktopMenu("")}
                                  className={classNames(
                                    "block px-4 py-2.5 text-sm transition",
                                    active
                                      ? "bg-warm-cream font-semibold text-burgundy"
                                      : "text-text-primary hover:bg-warm-cream hover:text-burgundy",
                                  )}
                                >
                                  {t(page.key)}
                                </Link>
                              );
                            })}
                          </div>
                        </AnchoredMenu>
                      ) : null}
                    </div>
                  );
                })}
                {extraPages.map((page) => {
                  const href = `/p/${page.slug}`;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={page.id}
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={classNames(
                        "relative whitespace-nowrap text-[12px] font-medium tracking-wide transition xl:text-[13px]",
                        isActive
                          ? "text-burgundy after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:bg-gold"
                          : "text-text-primary hover:text-burgundy",
                      )}
                    >
                      {page.title}
                    </Link>
                  );
                })}
                {chrome.navLinks?.map((link) => (
                  <ChromeLink
                    key={`${link.label}-${link.href}`}
                    link={link}
                    className="relative whitespace-nowrap text-[12px] font-medium tracking-wide text-text-primary transition hover:text-burgundy xl:text-[13px]"
                  />
                ))}
              </nav>

              {/* Actions */}
              <div className="hidden items-center gap-3 lg:flex">
                <Link
                  href="/cart"
                  aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
                  className="relative flex h-10 w-10 items-center justify-center text-ink transition hover:text-burgundy"
                >
                  <CartIcon />
                  {count > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-burgundy px-1 text-[11px] font-bold tabular-nums text-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>

                {isAuthenticated && user ? (
                  <div className="relative" ref={accountMenuRef}>
                    <button
                      type="button"
                      onClick={() => setAccountMenuOpen((open) => !open)}
                      aria-expanded={accountMenuOpen}
                      aria-haspopup="menu"
                      aria-label="Account"
                      className="flex h-10 items-center gap-1.5 text-ink transition hover:text-burgundy"
                    >
                      <UserIcon />
                      <span className="max-w-[90px] truncate text-sm font-medium">
                        {user.firstName || initials}
                      </span>
                    </button>

                    {accountMenuOpen && (
                      <AnchoredMenu
                        open
                        getAnchor={() => accountMenuRef.current}
                        align="right"
                      >
                        <div
                          role="menu"
                          data-account-menu
                          className="w-72 overflow-hidden rounded-2xl border border-border bg-white shadow-xl"
                        >
                          <div className="border-b border-border bg-warm-cream px-5 py-4">
                            <p className="font-semibold text-text-primary">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="mt-0.5 text-xs text-text-muted">
                              {user.email}
                            </p>
                            <p className="mt-1 text-xs font-mono tracking-[0.08em] text-burgundy">
                              {user.accountId}
                            </p>
                            <PartnerPortalBadges
                              user={user}
                              className="mt-2"
                              onOpen={() => setAccountMenuOpen(false)}
                            />
                          </div>

                          <nav
                            aria-label="Account menu"
                            className="max-h-80 overflow-y-auto py-2"
                          >
                            {accountItems.map((item) => {
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
                                      : "text-text-primary hover:bg-warm-cream hover:text-burgundy",
                                  )}
                                >
                                  <AccountIcon name={item.icon} />
                                  {item.name}
                                </Link>
                              );
                            })}

                            {user.role === "admin" && (
                              <ConsoleLink
                                href="/admin"
                                pathname={pathname}
                                label="Admin console"
                                icon="dashboard"
                              />
                            )}
                            {user.role === "staff" && (
                              <ConsoleLink
                                href="/staff"
                                pathname={pathname}
                                label="Staff console"
                                icon="dashboard"
                              />
                            )}
                            {user.role === "doctor" && (
                              <ConsoleLink
                                href="/doctor"
                                pathname={pathname}
                                label="Doctor console"
                                icon="dashboard"
                              />
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
                      </AnchoredMenu>
                    )}
                  </div>
                ) : (
                  <Link
                    href="/login"
                    aria-label="Account — sign in or create an account"
                    className="flex h-10 w-10 items-center justify-center text-ink transition hover:text-burgundy"
                  >
                    <UserIcon />
                  </Link>
                )}
              </div>

              {/* Mobile */}
              <div className="flex shrink-0 items-center gap-2 lg:hidden">
                <Link
                  href="/cart"
                  aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
                  className="relative flex h-10 w-10 items-center justify-center text-ink"
                >
                  <CartIcon />
                  {count > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-burgundy px-1 text-[11px] font-bold tabular-nums text-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>

                <Link href={isAuthenticated ? "/account" : "/login"} className="flex h-10 w-10 items-center justify-center text-ink" aria-label={isAuthenticated ? "My account" : "Account"}>
                  <UserIcon />
                </Link>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-primary"
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
                </button>
              </div>
            </div>
            <div className="-mt-3 flex min-w-0 pb-1.5">
              <DeliverTo />
            </div>
          </div>

          {mobileMenuOpen && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="fixed inset-0 z-[80] lg:hidden"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Site menu"
                >
                  <button
                    type="button"
                    className="absolute inset-0 bg-ink/40"
                    aria-label="Close menu"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <div className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <SiteLogo size={40} />
                        <p className="font-serif text-lg font-semibold text-ink">
                          Menu
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border"
                        aria-label="Close menu"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                    <nav
                      aria-label="Mobile navigation"
                      className="flex-1 overflow-y-auto px-2 py-2"
                    >
                      {navItems.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);
                        const children = navDropdown(item.href);
                        const opened = mobileOpen === item.href;
                        return (
                          <div
                            key={item.href}
                            className="border-b border-border"
                          >
                            <div className="flex items-center">
                              <Link
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={classNames(
                                  "flex-1 px-3 py-3.5 text-left text-sm font-semibold",
                                  isActive
                                    ? "text-burgundy"
                                    : "text-text-primary",
                                )}
                              >
                                {t(navMessageKey[item.href] ?? "nav.about")}
                              </Link>
                              {children.length ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMobileOpen(opened ? "" : item.href)
                                  }
                                  aria-expanded={opened}
                                  aria-label={`${t(navMessageKey[item.href] ?? "nav.about")} menu`}
                                  className="flex h-11 w-11 items-center justify-center text-sm text-text-muted"
                                >
                                  {opened ? "▴" : "▾"}
                                </button>
                              ) : null}
                            </div>
                            {opened && children.length ? (
                              <div className="mb-2 ml-3 space-y-0.5 border-l border-border pb-2 pl-3">
                                {children.map((page) => (
                                  <Link
                                    key={page.href}
                                    href={page.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={classNames(
                                      "block py-2 text-sm",
                                      pathname === page.href
                                        ? "font-semibold text-burgundy"
                                        : "text-text-muted hover:text-burgundy",
                                    )}
                                  >
                                    {t(page.key)}
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {extraPages.map((page) => (
                        <Link
                          key={page.id}
                          href={`/p/${page.slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="block border-b border-border px-3 py-3.5 text-sm font-medium text-text-primary hover:text-burgundy"
                        >
                          {page.title}
                        </Link>
                      ))}
                      {chrome.navLinks?.map((link) => (
                        <ChromeLink
                          key={`${link.label}-${link.href}`}
                          link={link}
                          onClick={() => setMobileMenuOpen(false)}
                          className="block border-b border-border px-3 py-3.5 text-sm font-semibold text-text-primary"
                        />
                      ))}
                    </nav>
                    <div className="flex flex-col gap-3 border-t border-border p-4">
                      {isAuthenticated ? (
                        <>
                          <Link
                            href="/account"
                            onClick={() => setMobileMenuOpen(false)}
                            className="text-sm font-semibold text-burgundy"
                          >
                            {t("header.myAccount")}
                          </Link>
                          <button
                            type="button"
                            onClick={handleSignOut}
                            className="text-left text-sm font-semibold text-red-700"
                          >
                            Logout
                          </button>
                        </>
                      ) : (
                        <Link
                          href="/login"
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-sm font-semibold text-burgundy"
                        >
                          {t("common.signIn")}
                        </Link>
                      )}
                      <Link
                        href="/events"
                        onClick={() => setMobileMenuOpen(false)}
                        className="btn-outline"
                      >
                        {t("header.exploreEvents")}
                      </Link>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
        </header>
      </div>
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
          : "text-text-primary hover:bg-warm-cream hover:text-burgundy",
      )}
    >
      <AccountIcon name={icon} />
      {label}
    </Link>
  );
}

function AccountIcon({ name }: { name: string }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  switch (name) {
    case "events":
      return (
        <svg {...common}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
      );
    case "subs":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case "orders":
      return (
        <svg {...common}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "payments":
    case "receipts":
      return (
        <svg {...common}>
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <rect width="8" height="6" x="6" y="9" rx="1" />
        </svg>
      );
    case "tracking":
      return (
        <svg {...common}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "tickets":
      return (
        <svg {...common}>
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
          <path d="M13 5v2" />
          <path d="M13 17v2" />
          <path d="M13 11v2" />
        </svg>
      );
    case "wishlist":
      return (
        <svg {...common}>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
        </svg>
      );
    case "cards":
      return (
        <svg {...common}>
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "addresses":
      return (
        <svg {...common}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M12 22V10" />
          <path d="m12 10 5 3" />
          <path d="m12 10-5 3" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" />
        </svg>
      );
    case "loyalty":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.7 1.7 0 0 0 3.4 0" />
        </svg>
      );
    case "faq":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "certificate":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="6" />
          <path d="M15.5 14 17 22l-5-3-5 3 1.5-8" />
        </svg>
      );
    case "videos":
      return (
        <svg {...common}>
          <rect width="18" height="14" x="3" y="5" rx="2" />
          <path d="m10 9 5 3-5 3z" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
function ChromeLink({
  link,
  className,
  onClick,
}: {
  link: SiteChromeLink;
  className?: string;
  onClick?: () => void;
}) {
  if (isExternal(link.href) || link.newTab || !link.href.startsWith("/")) {
    return (
      <a
        href={link.href}
        className={className}
        onClick={onClick}
        target={link.newTab || isExternal(link.href) ? "_blank" : undefined}
        rel="noopener noreferrer"
      >
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className} onClick={onClick}>
      {link.label}
    </Link>
  );
}

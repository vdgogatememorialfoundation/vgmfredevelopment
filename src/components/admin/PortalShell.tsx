"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export type PortalNavItem = {
  label: string;
  href?: string;
  onSelect?: () => void;
  active?: boolean;
};

export type PortalNavGroup = { label?: string; items: PortalNavItem[] };

/** Device-width portal frame: fixed left sidebar on desktop, slide-in left drawer on phones and tablets. */
export function PortalShell({
  eyebrow = "Foundation",
  title,
  subtitle,
  groups,
  nav,
  actions,
  footer,
  children,
  contentClassName = "p-4 sm:p-5 lg:p-8",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  groups?: PortalNavGroup[];
  nav?: (close: () => void) => ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = nav ? (
    nav(close)
  ) : (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {(groups ?? []).map((group, index) => (
        <div key={(group.label ?? "") + index} className="mb-6">
          {group.label && (
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.label}</div>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const className = [
                "block w-full rounded-lg px-3 py-2 text-left text-sm transition",
                item.active ? "bg-burgundy/10 font-semibold text-burgundy" : "text-gray-700 hover:bg-slate-50 hover:text-burgundy",
              ].join(" ");
              return item.href ? (
                <Link key={item.label + item.href} href={item.href} prefetch onClick={close} className={className}>
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  className={className}
                  onClick={() => {
                    item.onSelect?.();
                    close();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="border-b border-slate-200 px-6 py-5">
      <div className="text-xs font-semibold uppercase tracking-widest text-burgundy">{eyebrow}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{title}</div>
      {subtitle && <div className="mt-1 text-xs text-gray-500">{subtitle}</div>}
    </div>
  );

  const bottom = (
    <div className="border-t border-slate-200 p-4">
      {footer ?? (
        <Link href="/" onClick={close} className="block rounded-lg border border-slate-200 px-3 py-2 text-center text-sm hover:bg-gray-50">
          ← Back to website
        </Link>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-clip bg-white text-gray-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col">
            {brand}
            {menu}
            {bottom}
          </div>
        </aside>

        <div
          className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
          aria-hidden
          onClick={close}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-xs flex-col bg-white shadow-xl transition-transform duration-200 lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
          aria-hidden={!open}
          aria-label="Portal menu"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">{brand}</div>
            <button type="button" onClick={close} className="m-3 rounded-lg border border-slate-200 px-2.5 py-1 text-lg leading-none text-slate-600" aria-label="Close menu">
              ×
            </button>
          </div>
          {menu}
          {bottom}
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-5 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
                  onClick={() => setOpen(true)}
                  aria-label="Open menu"
                  aria-expanded={open}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-400">{eyebrow}</div>
                  <div className="truncate font-semibold">{title}</div>
                </div>
              </div>
              {actions && <div className="flex flex-wrap items-center justify-end gap-2 text-sm sm:gap-3">{actions}</div>}
            </div>
          </header>
          <div className={`min-w-0 max-lg:overflow-x-auto ${contentClassName}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}

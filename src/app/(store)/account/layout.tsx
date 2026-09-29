"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthContext";
import { accountNavigation } from "@/lib/constants";
import { classNames } from "@/lib/utils";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth message="Sign in to access your account dashboard.">
      <AccountShell>{children}</AccountShell>
    </RequireAuth>
  );
}

function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <div className="border-t border-border bg-background">
      <div className="container py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-border bg-white p-6">
              {user && (
                <div className="flex items-center gap-4 border-b border-border pb-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-burgundy text-base font-bold text-white">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {user.email}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] tracking-[0.08em] text-burgundy">
                      {user.accountId}
                    </p>
                  </div>
                </div>
              )}

              <nav aria-label="Account sidebar" className="mt-4 space-y-1">
                {accountNavigation.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={classNames(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                        active
                          ? "bg-burgundy/5 font-semibold text-burgundy"
                          : "text-text-primary hover:bg-warm-cream hover:text-burgundy"
                      )}
                    >
                      <span className="text-text-muted">
                        <AccountIcon name={item.icon} />
                      </span>
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="lg:col-span-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function AccountIcon({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
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
    case "cancelled":
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
    case "dashboard":
      return (
        <svg {...common}>
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
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
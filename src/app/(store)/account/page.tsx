"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { getAllApplications } from "@/lib/applications";

interface Stat {
  label: string;
  value: number | string;
  href: string;
}

export default function AccountDashboardPage() {
  const { user } = useAuth();
  const [applicationCount, setApplicationCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      const apps = getAllApplications().filter(
        (app) =>
          app.email.toLowerCase() === user.email.toLowerCase() ||
          app.name
            .toLowerCase()
            .includes(`${user.firstName} ${user.lastName}`.toLowerCase())
      );
      setApplicationCount(apps.length);
    }, 0);
    return () => clearTimeout(timer);
  }, [user]);

  if (!user) return null;

  const stats: Stat[] = [
    { label: "Event Registrations", value: applicationCount, href: "/account/registrations" },
    { label: "Orders", value: 2, href: "/account/orders" },
    { label: "Loyalty Points", value: 120, href: "/account/loyalty" },
    { label: "Support Tickets", value: 0, href: "/account/tickets" },
  ];

  const quickLinks = [
    { title: "My Event Registrations", description: "Track Application IDs and status for events you registered for.", href: "/account/registrations", icon: "events" },
    { title: "My Orders", description: "Track book orders, shipments and deliveries.", href: "/account/orders", icon: "orders" },
    { title: "My Payments & Receipts", description: "View payment history and download receipts.", href: "/account/payments", icon: "payments" },
    { title: "View Application Status", description: "Check the live status of your event applications.", href: "/account/applications", icon: "tracking" },
    { title: "Support Tickets", description: "Raise and track support requests with the Foundation.", href: "/account/tickets", icon: "tickets" },
    { title: "Edit Profile", description: "Update your details, contact information and preferences.", href: "/account/profile", icon: "profile" },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-burgundy">
          My Account
        </p>
        <h1 className="heading-3 mt-2">
          Welcome back, {user.firstName}
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Manage your registrations, subscriptions, orders, payments and
          profile from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="card p-5 transition hover:border-burgundy/40"
          >
            <p className="text-sm text-text-muted">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-burgundy">
              {stat.value}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-text-muted transition group-hover:text-burgundy">
              View
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="heading-3 mb-5">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="card flex items-start gap-4 p-5 transition hover:border-burgundy/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-burgundy/5 text-burgundy">
                <QuickIcon name={link.icon} />
              </span>
              <span>
                <span className="font-semibold text-text-primary">
                  {link.title}
                </span>
                <span className="mt-1 block text-sm text-text-muted">
                  {link.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickIcon({ name }: { name: string }) {
  const common = {
    width: 19,
    height: 19,
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
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
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
    case "profile":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" />
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
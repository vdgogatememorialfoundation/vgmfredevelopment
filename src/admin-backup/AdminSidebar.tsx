"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const sections = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: "▦" },
    ],
  },

  {
    title: "Accounts",
    items: [
      { label: "Staff Accounts", href: "/admin/accounts/staff", icon: "◉" },
      { label: "Customers", href: "/admin/accounts/customers", icon: "◎" },
      { label: "Sellers", href: "/admin/accounts/sellers", icon: "◇" },
      {
        label: "Delivery Partners",
        href: "/admin/accounts/delivery-partners",
        icon: "◆",
      },
      {
        label: "Roles & Permissions",
        href: "/admin/roles",
        icon: "⌘",
      },
    ],
  },

  {
    title: "Customer Service",
    items: [
      {
        label: "Support Tickets",
        href: "/admin/support",
        icon: "?",
      },
      {
        label: "Contact Enquiries",
        href: "/admin/website/contact",
        icon: "✉",
      },
    ],
  },

  {
    title: "Website & CMS",
    items: [
      {
        label: "Site Editor",
        href: "/admin/website",
        icon: "⌘",
      },
      {
        label: "Announcements",
        href: "/admin/website/announcements",
        icon: "!",
      },
      {
        label: "Notice Board",
        href: "/admin/website/notices",
        icon: "☷",
      },
      {
        label: "Flyers",
        href: "/admin/website/flyers",
        icon: "▧",
      },
      {
        label: "Banners",
        href: "/admin/website/banners",
        icon: "▤",
      },
      {
        label: "Media Library",
        href: "/admin/website/media",
        icon: "▨",
      },
      {
        label: "Articles",
        href: "/admin/articles",
        icon: "Aa",
      },
    ],
  },

  {
    title: "Events",
    items: [
      {
        label: "All Events",
        href: "/admin/events",
        icon: "◫",
      },
      {
        label: "Create Event",
        href: "/admin/events/create",
        icon: "+",
      },
      {
        label: "Registrations",
        href: "/admin/events/registrations",
        icon: "☷",
      },
      {
        label: "Speakers",
        href: "/admin/events/speakers",
        icon: "◉",
      },
      {
        label: "Tickets & Attendance",
        href: "/admin/events/tickets",
        icon: "▣",
      },
      {
        label: "Certificates",
        href: "/admin/certificates",
        icon: "▤",
      },
    ],
  },

  {
    title: "Commerce",
    items: [
      {
        label: "Seller Onboarding",
        href: "/admin/sellers/onboarding",
        icon: "+",
      },
      {
        label: "Seller Management",
        href: "/admin/sellers",
        icon: "◇",
      },
      {
        label: "Orders",
        href: "/admin/shipments/orders",
        icon: "□",
      },
      {
        label: "Create Order",
        href: "/admin/shipments/orders/create",
        icon: "+",
      },
      {
        label: "Create Shipment",
        href: "/admin/shipments/create",
        icon: "+",
      },
      {
        label: "Shipments",
        href: "/admin/shipments",
        icon: "▱",
      },
      {
        label: "Delivery Partners",
        href: "/admin/delivery-partners",
        icon: "◆",
      },
      {
        label: "Payments",
        href: "/admin/payments",
        icon: "₹",
      },
    ],
  },

  {
    title: "System",
    items: [
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "⚙",
      },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
      >
        ☰
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white transition-transform duration-200 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-full flex-col">

          <div className="flex h-20 items-center border-b border-slate-100 px-6">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#651C1C] text-[10px] font-bold text-white">
              VGMF
            </div>

            <div className="ml-3">
              <p className="font-bold text-slate-900">
                VGMF
              </p>

              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                Administration
              </p>
            </div>

            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto text-xl text-slate-500 lg:hidden"
            >
              ×
            </button>

          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-5">

            {sections.map((section) => (

              <div
                key={section.title}
                className="mb-6"
              >

                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {section.title}
                </p>

                <div className="space-y-1">

                  {section.items.map((item) => {

                    const active =
                      pathname === item.href ||
                      (
                        item.href !== "/admin" &&
                        pathname.startsWith(item.href)
                      );

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          active
                            ? "bg-[#F5F0E8] text-[#651C1C]"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >

                        <span className="flex w-5 justify-center text-xs">
                          {item.icon}
                        </span>

                        <span>
                          {item.label}
                        </span>

                      </Link>
                    );

                  })}

                </div>

              </div>

            ))}

          </nav>

          <div className="border-t border-slate-100 p-4">

            <Link
              href="/"
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              ← Back to website
            </Link>

          </div>

        </div>
      </aside>
    </>
  );
}

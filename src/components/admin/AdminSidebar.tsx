"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  {
    title: "Overview",
    items: [
      ["Dashboard", "/admin"],
    ],
  },

  {
    title: "Commerce",
    items: [
      ["Orders", "/admin/shipments/orders"],
      ["Shipments", "/admin/shipments"],
      ["Products", "/admin/products"],
      ["Sellers", "/admin/sellers"],
    ],
  },

  {
    title: "Accounts",
    items: [
      ["Staff Accounts", "/admin/accounts/staff"],
      ["Customers", "/admin/accounts/customers"],
      ["Seller Accounts", "/admin/accounts/sellers"],
      ["Delivery Partners", "/admin/accounts/delivery-partners"],
      ["Roles & Permissions", "/admin/accounts/roles"],
    ],
  },

  {
    title: "Website & CMS",
    items: [
      ["Homepage", "/admin/website/homepage"],
      ["Announcements", "/admin/website/announcements"],
      ["Notice Board", "/admin/website/notices"],
      ["Flyers", "/admin/website/flyers"],
      ["Banners", "/admin/website/banners"],
      ["Media Library", "/admin/website/media"],
      ["Articles", "/admin/articles"],
      ["Videos", "/admin/website/videos"],
    ],
  },

  {
    title: "Events",
    items: [
      ["All Events", "/admin/events"],
      ["Create Event", "/admin/events/create"],
      ["Registrations", "/admin/events/registrations"],
      ["Applications", "/admin/events/applications"],
      ["Speakers", "/admin/events/speakers"],
      ["Schedule", "/admin/events/schedule"],
      ["Payments", "/admin/events/payments"],
      ["Tickets", "/admin/events/tickets"],
      ["Attendance", "/admin/events/attendance"],
      ["Certificates", "/admin/events/certificates"],
    ],
  },

  {
    title: "Certificates",
    items: [
      ["Certificates", "/admin/certificates"],
      ["Issue Certificate", "/admin/certificates/issue"],
      ["Reissue", "/admin/certificates/reissue"],
      ["Verification", "/admin/certificates/verification"],
    ],
  },

  {
    title: "Payments",
    items: [
      ["Transactions", "/admin/payments"],
      ["Gateway", "/admin/payments/gateway"],
      ["Successful", "/admin/payments/successful"],
      ["Failed", "/admin/payments/failed"],
      ["Pending", "/admin/payments/pending"],
      ["Refunds", "/admin/payments/refunds"],
      ["Reconciliation", "/admin/payments/reconciliation"],
    ],
  },

  {
    title: "Support",
    items: [
      ["Support Tickets", "/admin/support/tickets"],
      ["Contact Enquiries", "/admin/support/contact"],
    ],
  },

  {
    title: "Delivery Partners",
    items: [
      ["Partners", "/admin/delivery-partners"],
      ["Onboarding", "/admin/delivery-partners/onboarding"],
      ["APIs", "/admin/delivery-partners/apis"],
      ["Shipments", "/admin/delivery-partners/shipments"],
      ["Assignments", "/admin/delivery-partners/assignments"],
      ["Performance", "/admin/delivery-partners/performance"],
    ],
  },

  {
    title: "Communication",
    items: [
      ["Email", "/admin/email"],
    ],
  },

  {
    title: "Settings",
    items: [
      ["General", "/admin/settings"],
      ["Registration", "/admin/settings/registration"],
      ["Events", "/admin/settings/events"],
      ["Orders", "/admin/settings/orders"],
      ["Shipping", "/admin/settings/shipping"],
      ["Processing Timelines", "/admin/settings/timelines"],
      ["Payments", "/admin/settings/payments"],
      ["Email", "/admin/settings/email"],
      ["WhatsApp", "/admin/settings/whatsapp"],
      ["API Keys", "/admin/settings/api-keys"],
      ["Notifications", "/admin/settings/notifications"],
      ["Security", "/admin/settings/security"],
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 overflow-y-auto border-r border-slate-200 bg-white lg:block">

      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-6">

        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#651C1C]">
          VGMF
        </p>

        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Admin Console
        </h1>

        <p className="mt-1 text-[11px] text-slate-400">
          Vaidya Gogate Memorial Foundation
        </p>

      </div>

      <nav className="space-y-6 px-3 py-5">

        {groups.map((group) => (
          <div key={group.title}>

            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {group.title}
            </p>

            <div className="space-y-1">

              {group.items.map(([label, href]) => {

                const active =
                  href === "/admin"
                    ? pathname === "/admin"
                    : pathname === href ||
                      pathname.startsWith(href + "/");

                return (
                  <Link
                    key={href}
                    href={href}
                    className={
                      active
                        ? "block rounded-xl bg-[#651C1C] px-3 py-2.5 text-sm font-bold text-white"
                        : "block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-[#F8F1EA] hover:text-[#651C1C]"
                    }
                  >
                    {label}
                  </Link>
                );

              })}

            </div>

          </div>
        ))}

        <div className="border-t border-slate-200 pt-4">

          <Link
            href="/"
            className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            ← Back to website
          </Link>

        </div>

      </nav>

    </aside>
  );
}

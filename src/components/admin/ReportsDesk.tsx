"use client";

import { displayName, getAccounts, getTickets } from "@/lib/admin-store";
import { getLiveArticles, getLiveClinics, getLiveEvents } from "@/lib/cms";
import { downloadCsv, downloadExcel, printPdf } from "@/lib/export-file";
import { getOrders } from "@/lib/store";

type Report = {
  id: string;
  title: string;
  description: string;
  file: string;
  headers: string[];
  rows: () => (string | number)[][];
};

function reports(): Report[] {
  const accounts = getAccounts();
  const orders = getOrders();
  return [
    {
      id: "orders",
      title: "Orders",
      description: "Shop and POS orders with payment and fulfilment status.",
      file: "vgmf-orders",
      headers: ["Order ID", "Date", "Customer", "Status", "Payment", "Total", "Channel"],
      rows: () =>
        orders.map((order) => [
          order.id,
          order.date,
          order.deliveryAddress?.fullName || order.userId,
          order.status,
          order.paymentStatus,
          order.total,
          order.channel ?? "online",
        ]),
    },
    {
      id: "doctors",
      title: "Doctor accounts",
      description: "Doctor logins, contact details and account status.",
      file: "vgmf-doctor-accounts",
      headers: ["Account ID", "Name", "Email", "Phone", "Status", "Created"],
      rows: () =>
        accounts
          .filter((account) => account.role === "doctor")
          .map((account) => [
            account.accountId ?? "",
            displayName(account),
            account.email,
            account.phone,
            account.status ?? "active",
            account.createdAt ?? "",
          ]),
    },
    {
      id: "staff",
      title: "Staff accounts",
      description: "Staff logins, roles and status.",
      file: "vgmf-staff-accounts",
      headers: ["Account ID", "Name", "Email", "Phone", "Role", "Status"],
      rows: () =>
        accounts
          .filter((account) => account.role === "staff")
          .map((account) => [
            account.accountId ?? "",
            displayName(account),
            account.email,
            account.phone,
            account.staffRoleId ?? "",
            account.status ?? "active",
          ]),
    },
    {
      id: "customers",
      title: "Customer accounts",
      description: "Registered shop customers.",
      file: "vgmf-customers",
      headers: ["Account ID", "Name", "Email", "Phone", "Status", "Store credit"],
      rows: () =>
        accounts
          .filter((account) => !account.role || account.role === "customer")
          .map((account) => [
            account.accountId ?? "",
            displayName(account),
            account.email,
            account.phone,
            account.status ?? "active",
            account.storeCredit ?? 0,
          ]),
    },
    {
      id: "articles",
      title: "Articles",
      description: "Published articles on the website.",
      file: "vgmf-articles",
      headers: ["Title", "Slug", "Author", "Category", "Date", "Featured"],
      rows: () =>
        getLiveArticles().map((article) => [
          article.title,
          article.slug,
          article.author ?? "",
          article.category,
          article.date,
          article.featured ? "Yes" : "No",
        ]),
    },
    {
      id: "events",
      title: "Events",
      description: "Events, dates, fees and registration links.",
      file: "vgmf-events",
      headers: ["Name", "Type", "Start", "End", "City", "Fee", "Registration"],
      rows: () =>
        getLiveEvents().map((event) => [
          event.name,
          event.eventType,
          event.tbd?.dates ? "TBD" : event.startDate,
          event.endDate,
          event.tbd?.venue ? "TBD" : event.city ?? "",
          event.tbd?.fee ? "TBD" : event.fee,
          event.tbd?.registration ? "TBD" : event.registrationUrl ?? "",
        ]),
    },
    {
      id: "clinics",
      title: "Clinics",
      description: "Clinic pages and consulting doctors.",
      file: "vgmf-clinics",
      headers: ["Name", "Doctor", "City", "Phone", "Timings"],
      rows: () =>
        getLiveClinics().map((clinic) => [clinic.name, clinic.doctor, clinic.city, clinic.phone, clinic.timings]),
    },
    {
      id: "tickets",
      title: "Support tickets",
      description: "Contact and support desk tickets.",
      file: "vgmf-support-tickets",
      headers: ["ID", "Subject", "Status", "Email"],
      rows: () => getTickets().map((ticket) => [ticket.id, ticket.subject, ticket.status, ticket.email ?? ""]),
    },
  ];
}

export function ReportsDesk() {
  const items = reports();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Download Excel, CSV or a printable PDF of orders, accounts, articles and other Foundation records.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            <p className="mt-2 text-xs text-slate-400">{item.rows().length} rows</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-burgundy px-3 py-1.5 text-sm font-semibold text-white"
                onClick={() => downloadExcel(item.file, item.title, item.headers, item.rows())}
              >
                Excel
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700"
                onClick={() => downloadCsv(item.file, item.headers, item.rows())}
              >
                CSV
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700"
                onClick={() => printPdf(item.title, item.headers, item.rows())}
              >
                PDF
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

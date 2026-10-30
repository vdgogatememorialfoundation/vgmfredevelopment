"use client";

import { displayName, getAccounts, getShipments, getTickets } from "@/lib/admin-store";
import { getAllApplications } from "@/lib/applications";
import { getEventRecords, getIssuedCertificates, getLiveArticles, getLiveClinics, getLiveEvents } from "@/lib/cms";
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

function reports(): { group: string; items: Report[] }[] {
  const accounts = getAccounts();
  const orders = getOrders();
  const shipments = getShipments();
  const tickets = getTickets();
  const applications = getAllApplications();
  const events = getLiveEvents();
  const certificates = getIssuedCertificates();
  const payments = getEventRecords("payments");
  const registrations = getEventRecords("registrations");

  const eventReports: Report[] = events.map((event) => ({
    id: `event-${event.id}`,
    title: event.name,
    description: `${event.eventType} · ${event.tbd?.dates ? "TBD" : event.startDate} · ${event.city ?? ""}`,
    file: `vgmf-event-${event.slug || event.id}`,
    headers: ["Field", "Value"],
    rows: () => {
      const apps = applications.filter((item) => item.eventId === event.id || item.eventName === event.name);
      const regs = registrations.filter((item) => item.eventSlug === event.slug || item.eventId === event.id);
      const certs = certificates.filter((item) => item.event === event.name || item.event === event.slug);
      return [
        ["Name", event.name],
        ["Type", event.eventType],
        ["Mode", event.mode],
        ["Start", event.tbd?.dates ? "TBD" : event.startDate],
        ["End", event.endDate],
        ["City", event.tbd?.venue ? "TBD" : event.city ?? ""],
        ["Venue", event.venue ?? ""],
        ["Fee", event.tbd?.fee ? "TBD" : event.fee],
        ["Applications", apps.length],
        ["Registrations", regs.length],
        ["Certificates", certs.length],
        ...apps.map((app) => ["Applicant", `${app.applicationId} · ${app.name} · ${app.email} · ${app.status}`]),
      ];
    },
  }));

  return [
    {
      group: "Events",
      items: [
        {
          id: "events",
          title: "All events",
          description: "Every event with dates, fees and registration links.",
          file: "vgmf-events",
          headers: ["Name", "Type", "Start", "End", "City", "Fee", "Registration"],
          rows: () =>
            events.map((event) => [
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
          id: "applications",
          title: "Event applications",
          description: "All event applications across programmes.",
          file: "vgmf-event-applications",
          headers: ["Application", "Event", "Name", "Email", "Phone", "Status", "Applied"],
          rows: () =>
            applications.map((item) => [
              item.applicationId,
              item.eventName,
              item.name,
              item.email,
              item.phone ?? "",
              item.status,
              item.appliedAt,
            ]),
        },
        {
          id: "registrations",
          title: "Event registrations",
          description: "Registration records stored for events.",
          file: "vgmf-event-registrations",
          headers: ["ID", "Event", "Details"],
          rows: () =>
            registrations.map((item) => [item.id, item.eventSlug, JSON.stringify(item)]),
        },
        {
          id: "certificates",
          title: "Issued certificates",
          description: "Foundation certificates on file.",
          file: "vgmf-certificates",
          headers: ["Number", "Name", "Event", "Type", "Issued"],
          rows: () =>
            certificates.map((item) => [
              item.certificateNumber,
              item.name,
              item.event,
              item.certificateType,
              item.issueDate,
            ]),
        },
        ...eventReports,
      ],
    },
    {
      group: "People",
      items: [
        {
          id: "customers",
          title: "All customer information",
          description: "Registered shop customers with contact details and store credit.",
          file: "vgmf-customers",
          headers: ["Account ID", "Name", "Email", "Phone", "Status", "Store credit", "Created"],
          rows: () =>
            accounts
              .filter((account) => !account.role || account.role === "customer" || account.role === "doctor" || Boolean(account.partnerPortals?.length))
              .map((account) => [
                account.accountId ?? "",
                displayName(account),
                account.email,
                account.phone,
                account.status ?? "active",
                account.storeCredit ?? 0,
                account.createdAt ?? "",
              ]),
        },
        {
          id: "doctors",
          title: "Sister-portal customers",
          description: "Seminar doctors and Autism applicants listed with other customers.",
          file: "vgmf-sister-customers",
          headers: ["Account ID", "Name", "Email", "Phone", "Status", "Created"],
          rows: () =>
            accounts
              .filter((account) => Boolean(account.partnerPortals?.length) || account.role === "doctor")
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
          file: "vgmf-staff",
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
      ],
    },
    {
      group: "Content",
      items: [
        {
          id: "articles",
          title: "All articles report",
          description: "Published articles on the website.",
          file: "vgmf-articles",
          headers: ["Title", "Slug", "Author", "Category", "Date", "Status", "Featured"],
          rows: () =>
            getLiveArticles().map((article) => [
              article.title,
              article.slug,
              article.author ?? "",
              article.category,
              article.date,
              article.status ?? "published",
              article.featured ? "Yes" : "No",
            ]),
        },
        {
          id: "clinics",
          title: "Clinics",
          description: "Clinic pages and consulting doctors.",
          file: "vgmf-clinics",
          headers: ["Name", "Doctor", "City", "Phone", "Timings"],
          rows: () => getLiveClinics().map((clinic) => [clinic.name, clinic.doctor, clinic.city, clinic.phone, clinic.timings]),
        },
      ],
    },
    {
      group: "Commerce & information",
      items: [
        {
          id: "orders",
          title: "Orders",
          description: "Shop and POS orders with payment and fulfilment status.",
          file: "vgmf-orders",
          headers: ["Order ID", "Date", "Customer", "Country", "Status", "Payment", "Total", "Channel"],
          rows: () =>
            orders.map((order) => [
              order.id,
              order.date,
              order.deliveryAddress?.fullName || order.userId,
              order.deliveryAddress?.country || order.deliveryAddress?.countryCode || "",
              order.status,
              order.paymentStatus,
              order.total,
              order.channel ?? "online",
            ]),
        },
        {
          id: "payments",
          title: "Payments",
          description: "Order payments, methods and references.",
          file: "vgmf-payments",
          headers: ["Order ID", "Date", "Customer", "Method", "Status", "Amount", "Reference"],
          rows: () =>
            orders.map((order) => [
              order.id,
              order.paidAt || order.date,
              order.deliveryAddress?.fullName || order.userId,
              order.paymentMethod ?? "",
              order.paymentStatus,
              order.total,
              order.paymentRef || order.razorpayPaymentId || "",
            ]),
        },
        {
          id: "refunds",
          title: "Refunds",
          description: "Refunds recorded against orders.",
          file: "vgmf-refunds",
          headers: ["Order ID", "Refund ID", "Date", "Amount", "Destination", "Note"],
          rows: () =>
            orders.flatMap((order) =>
              (order.refunds ?? []).map((refund) => [
                order.id,
                refund.id,
                refund.at,
                refund.amount,
                refund.destination,
                refund.note ?? "",
              ])
            ),
        },
        {
          id: "shipments",
          title: "Shipments",
          description: "Booked courier shipments and AWB numbers.",
          file: "vgmf-shipments",
          headers: ["Shipment", "Order", "Courier", "AWB", "Status", "City", "Charges"],
          rows: () =>
            shipments.map((item) => [
              item.id,
              item.orderId,
              item.courier,
              item.awb,
              item.status,
              item.toAddress?.city ?? "",
              item.charges,
            ]),
        },
        {
          id: "event-payments",
          title: "Event payments",
          description: "Payments recorded against events.",
          file: "vgmf-event-payments",
          headers: ["ID", "Event", "Details"],
          rows: () => payments.map((item) => [item.id, item.eventSlug, JSON.stringify(item)]),
        },
        {
          id: "tickets",
          title: "Support tickets",
          description: "Contact and support desk tickets with reply counts.",
          file: "vgmf-support-tickets",
          headers: ["ID", "Portal", "Subject", "Status", "Email", "Replies"],
          rows: () =>
            tickets.map((ticket) => [
              ticket.id,
              ticket.portal ?? "customer",
              ticket.subject,
              ticket.status,
              ticket.email ?? "",
              ticket.responses.length,
            ]),
        },
        {
          id: "everything",
          title: "All information (combined)",
          description: "One workbook-style table of orders, accounts, events, articles and tickets.",
          file: "vgmf-all-information",
          headers: ["Kind", "ID", "Title", "Detail", "Status", "Amount"],
          rows: () => [
            ...orders.map((order) => ["Order", order.id, order.deliveryAddress?.fullName ?? "", order.date, order.status, order.total]),
            ...accounts.map((account) => ["Account", account.accountId ?? account.id, displayName(account), account.email, account.role ?? "customer", account.storeCredit ?? 0]),
            ...events.map((event) => ["Event", event.id, event.name, event.city ?? "", event.eventType, event.fee]),
            ...getLiveArticles().map((article) => ["Article", article.slug, article.title, article.author ?? "", article.status ?? "published", ""]),
            ...tickets.map((ticket) => ["Ticket", ticket.id, ticket.subject, ticket.email, ticket.status, ticket.responses.length]),
            ...shipments.map((item) => ["Shipment", item.id, item.courier, item.awb, item.status, item.charges]),
          ],
        },
      ],
    },
  ];
}

function ReportCard({ item }: { item: Report }) {
  const count = item.rows().length;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-900">{item.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{item.description}</p>
      <p className="mt-2 text-xs text-slate-400">{count} rows</p>
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
  );
}

export function ReportsDesk() {
  const groups = reports();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & export</h1>
        <p className="mt-1 text-sm text-slate-500">
          Download Excel, CSV or a printable PDF for each event, customers, doctors, articles, orders, payments and every other Foundation record.
        </p>
      </div>
      {groups.map((group) => (
        <section key={group.group} className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{group.group}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {group.items.map((item) => (
              <ReportCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

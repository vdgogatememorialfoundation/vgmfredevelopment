"use client";

import { useState } from "react";
import Link from "next/link";
import RecordDesk from "@/components/admin/RecordDesk";
import {
  certificateKeys,
  eventRecordKeys,
  getIssuedCertificates,
  getSectionSettings,
  hideEventRecord,
  getEventRecords,
  nextCertificateNumber,
  revokeCertificate,
  saveEventRecord,
  saveIssuedCertificate,
  saveSectionSettings,
  type EventRecord,
  type EventRecordKind,
  type IssuedCertificate,
} from "@/lib/cms";
import {
  getSettings,
  getShipments,
  refundOrder,
  saveSettings,
  setPaymentStatus,
} from "@/lib/admin-store";
import { getOrders } from "@/lib/store";
import { collectionHook, useLiveEvents } from "@/lib/use-cms";
import { certificates as seededCertificates } from "@/data/content";
import type { Order } from "@/types";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white";
const ghost = "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700";

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

type PaymentFilter = "all" | Order["paymentStatus"];

const paymentTitles: Record<PaymentFilter, string> = {
  all: "Transactions",
  Paid: "Successful payments",
  Failed: "Failed payments",
  Pending: "Pending payments",
  Refunded: "Refunded payments",
};

export function PaymentsDesk({ filter = "all" }: { filter?: PaymentFilter }) {
  const [orders, setOrders] = useState<Order[]>(() => getOrders());
  const refresh = () => setOrders(getOrders());
  const shown = filter === "all" ? orders : orders.filter((order) => order.paymentStatus === filter);
  const total = shown.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{paymentTitles[filter]}</h1>
          <p className="mt-1 text-sm text-slate-500">{shown.length} payments · {money(total)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link className={ghost} href="/admin/payments">All</Link>
          <Link className={ghost} href="/admin/payments/successful">Successful</Link>
          <Link className={ghost} href="/admin/payments/pending">Pending</Link>
          <Link className={ghost} href="/admin/payments/failed">Failed</Link>
          <Link className={ghost} href="/admin/payments/refunds">Refunds</Link>
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No payments in this list yet. Orders from checkout or{" "}
          <Link href="/admin/commerce/orders" className="font-semibold text-burgundy">Create order</Link> appear here.
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <p className="font-semibold text-slate-900">Order #{order.id} · {money(order.total)}</p>
                <p className="text-xs text-slate-500">
                  {order.deliveryAddress?.fullName ?? "Customer"} · {order.paymentStatus} · {order.status}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {order.paymentStatus !== "Paid" && order.paymentStatus !== "Refunded" && (
                  <button type="button" className={ghost} onClick={() => { setPaymentStatus(order.id, "Paid"); refresh(); }}>
                    Mark paid
                  </button>
                )}
                {order.paymentStatus === "Pending" && (
                  <button type="button" className={ghost} onClick={() => { setPaymentStatus(order.id, "Failed"); refresh(); }}>
                    Mark failed
                  </button>
                )}
                {order.paymentStatus === "Paid" && (
                  <button type="button" className={ghost} onClick={() => { refundOrder(order.id); refresh(); }}>
                    Issue refund
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReconciliationDesk() {
  const [orders] = useState<Order[]>(() => getOrders());
  const rows = (["Paid", "Pending", "Failed", "Refunded"] as const).map((status) => {
    const list = orders.filter((order) => order.paymentStatus === status);
    return { status, count: list.length, total: list.reduce((sum, order) => sum + order.total, 0) };
  });
  const collected = rows[0].total - rows[3].total;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Reconciliation</h1>
      <div className="grid gap-4 md:grid-cols-4">
        {rows.map((row) => (
          <div key={row.status} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{row.status}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{money(row.total)}</p>
            <p className="text-xs text-slate-500">{row.count} orders</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        Net collected after refunds: <span className="font-bold text-slate-900">{money(collected)}</span>
      </div>
    </div>
  );
}

export function GatewayDesk() {
  const [key, setKey] = useState(() => getSettings().apiKeys.razorpay);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Payment gateway</h1>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <label className="text-sm font-semibold text-slate-800">Razorpay key</label>
        <input className={field} value={key} onChange={(event) => setKey(event.target.value)} placeholder="rzp_live_..." />
        <button
          type="button"
          className={button}
          onClick={() => {
            const settings = getSettings();
            settings.apiKeys.razorpay = key.trim();
            saveSettings(settings);
            setNote(key.trim().length >= 8 ? "Gateway key saved." : "Key cleared. Checkout keeps the test payment step.");
          }}
        >
          Save gateway
        </button>
        {note && <p className="text-sm text-emerald-700">{note}</p>}
      </div>
    </div>
  );
}

const useIssuedCertificates = collectionHook<IssuedCertificate>(
  certificateKeys.edits,
  certificateKeys.custom,
  seededCertificates.map((certificate) => ({ ...certificate, id: certificate.certificateNumber, status: "Valid" as const })),
  getIssuedCertificates
);

export function CertificateRegistry({ mode, eventName }: { mode: "list" | "issue" | "reissue"; eventName?: string }) {
  const records = useIssuedCertificates();
  const heading = mode === "issue" ? "Issue certificate" : mode === "reissue" ? "Reissue certificate" : "Certificates";
  const description =
    mode === "reissue"
      ? "Choose Edit on a certificate, correct the details and save. The issue date updates and the certificate is marked reissued."
      : "Issued certificates verify on the public certificate verification page.";

  return (
    <div className="space-y-4">
      <RecordDesk<IssuedCertificate>
        heading={heading}
        description={description}
        publicHref="/certificate-verification"
        records={records}
        label={(record) => `${record.certificateNumber} · ${record.name} · ${record.event}${record.reissuedAt ? " · reissued" : ""}`}
        fields={[
          { key: "name", label: "Recipient name" },
          { key: "certificateNumber", label: "Certificate number" },
          { key: "event", label: "Event or course" },
          { key: "certificateType", label: "Certificate type", kind: "select", options: ["Participation", "Achievement", "Completion", "Merit"] },
          { key: "eventDate", label: "Event date" },
          { key: "issueDate", label: "Issue date" },
          { key: "signature", label: "Signed by" },
        ]}
        blank={() => {
          const today = new Date().toISOString().slice(0, 10);
          const number = nextCertificateNumber();
          return {
            id: number,
            certificateNumber: number,
            name: "",
            event: eventName ?? "",
            certificateType: "Participation",
            eventDate: today,
            issueDate: today,
            signature: "Dr. Ananya Deshpande",
            status: "Valid",
          };
        }}
        onSave={(record) => {
          const existing = records.some((item) => item.id === record.id);
          saveIssuedCertificate({
            ...record,
            issueDate: mode === "reissue" && existing ? new Date().toISOString().slice(0, 10) : record.issueDate,
            reissuedAt: mode === "reissue" && existing ? new Date().toISOString() : record.reissuedAt,
          });
        }}
        onHide={revokeCertificate}
      />
      <p className="text-xs text-slate-500">
        Hide revokes the certificate on the public verification page.
      </p>
    </div>
  );
}

type EventField = { key: string; label: string; kind?: "text" | "textarea" | "select"; options?: string[] };

const eventRecordConfig: Record<EventRecordKind, { heading: string; description: string; fields: EventField[]; label: (record: EventRecord) => string }> = {
  speakers: {
    heading: "Speakers",
    description: "Speakers saved here appear on the public event page.",
    fields: [
      { key: "name", label: "Speaker name" },
      { key: "designation", label: "Designation" },
      { key: "topic", label: "Topic" },
    ],
    label: (record) => `${record.name} · ${record.topic}`,
  },
  schedule: {
    heading: "Schedule",
    description: "Sessions saved here appear in the event schedule on the public event page.",
    fields: [
      { key: "title", label: "Session title" },
      { key: "time", label: "Time" },
      { key: "description", label: "Description", kind: "textarea" },
    ],
    label: (record) => `${record.time} · ${record.title}`,
  },
  registrations: {
    heading: "Registrations",
    description: "Track people registered for each event.",
    fields: [
      { key: "name", label: "Attendee name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "status", label: "Status", kind: "select", options: ["Pending", "Confirmed", "Waitlist", "Cancelled"] },
    ],
    label: (record) => `${record.name} · ${record.email} · ${record.status}`,
  },
  applications: {
    heading: "Applications",
    description: "Review fellowship and programme applications.",
    fields: [
      { key: "name", label: "Applicant name" },
      { key: "email", label: "Email" },
      { key: "statement", label: "Statement", kind: "textarea" },
      { key: "status", label: "Status", kind: "select", options: ["Submitted", "Under Review", "Approved", "Rejected"] },
    ],
    label: (record) => `${record.name} · ${record.status}`,
  },
  tickets: {
    heading: "Tickets",
    description: "Issue entry tickets for event attendees.",
    fields: [
      { key: "attendee", label: "Attendee name" },
      { key: "code", label: "Ticket code" },
      { key: "status", label: "Status", kind: "select", options: ["Issued", "Checked in", "Cancelled"] },
    ],
    label: (record) => `${record.code} · ${record.attendee} · ${record.status}`,
  },
  attendance: {
    heading: "Attendance",
    description: "Mark who attended each session.",
    fields: [
      { key: "attendee", label: "Attendee name" },
      { key: "session", label: "Session or day" },
      { key: "status", label: "Status", kind: "select", options: ["Present", "Absent", "Late"] },
    ],
    label: (record) => `${record.attendee} · ${record.session} · ${record.status}`,
  },
  payments: {
    heading: "Event payments",
    description: "Record registration fees received for events.",
    fields: [
      { key: "payer", label: "Payer name" },
      { key: "amount", label: "Amount (₹)" },
      { key: "reference", label: "Payment reference" },
      { key: "status", label: "Status", kind: "select", options: ["Paid", "Pending", "Failed", "Refunded"] },
    ],
    label: (record) => `${record.payer} · ₹${record.amount} · ${record.status}`,
  },
};

const eventRecordHooks = Object.fromEntries(
  (Object.keys(eventRecordConfig) as EventRecordKind[]).map((kind) => {
    const keys = eventRecordKeys(kind);
    return [kind, collectionHook<EventRecord>(keys.edits, keys.custom, [], () => getEventRecords(kind))];
  })
) as Record<EventRecordKind, () => EventRecord[]>;

export function EventRecordsDesk({ kind }: { kind: EventRecordKind }) {
  const config = eventRecordConfig[kind];
  const events = useLiveEvents();
  const records = eventRecordHooks[kind]();
  const eventOptions = events.map((event) => event.slug);
  const eventName = (slug: string) => events.find((event) => event.slug === slug)?.name ?? slug;

  return (
    <RecordDesk<EventRecord>
      heading={config.heading}
      description={config.description}
      publicHref="/events"
      records={records}
      label={(record) => `${eventName(record.eventSlug)} · ${config.label(record)}`}
      fields={[
        ...config.fields.slice(0, 1),
        { key: "eventSlug", label: "Event", kind: "select", options: eventOptions },
        ...config.fields.slice(1),
      ]}
      blank={() => {
        const record: EventRecord = { id: `${kind}-${Date.now()}`, eventSlug: eventOptions[0] ?? "" };
        for (const item of config.fields) {
          record[item.key] = item.kind === "select" ? item.options?.[0] ?? "" : "";
        }
        if (kind === "tickets") record.code = `TKT-${Date.now().toString().slice(-6)}`;
        return record;
      }}
      onSave={(record) => saveEventRecord(kind, record)}
      onHide={(id) => hideEventRecord(kind, id)}
    />
  );
}

export function CourierPerformanceDesk() {
  const [shipments] = useState(() => getShipments());
  const couriers = Array.from(new Set(shipments.map((shipment) => shipment.courier)));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Delivery partner performance</h1>
      {couriers.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Book a shipment from an order to start measuring partners.{" "}
          <Link href="/admin/commerce/orders" className="font-semibold text-burgundy">Open orders</Link>
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {couriers.map((courier) => {
            const list = shipments.filter((shipment) => shipment.courier === courier);
            const delivered = list.filter((shipment) => shipment.status === "Delivered").length;
            const charges = list.reduce((sum, shipment) => sum + shipment.charges, 0);
            return (
              <div key={courier} className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="font-semibold text-slate-900">{courier}</p>
                <p className="mt-2 text-sm text-slate-600">{list.length} shipments · {delivered} delivered</p>
                <p className="text-sm text-slate-600">Delivery rate {Math.round((delivered / list.length) * 100)}%</p>
                <p className="text-sm text-slate-600">Charges {money(charges)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type SettingField = { key: string; label: string; kind?: "toggle" | "text"; fallback: string };

const sectionSettings: Record<string, { heading: string; fields: SettingField[] }> = {
  registration: {
    heading: "Registration settings",
    fields: [
      { key: "allowSignup", label: "Allow new customer sign-ups", kind: "toggle", fallback: "true" },
      { key: "verifyEmail", label: "Require email verification", kind: "toggle", fallback: "true" },
      { key: "welcomeSubject", label: "Welcome email subject", fallback: "Welcome to the Vaidya Gogate Memorial Foundation" },
    ],
  },
  events: {
    heading: "Event settings",
    fields: [
      { key: "registrationSite", label: "Registration website", fallback: "https://seminar.vaidyagogate.org" },
      { key: "defaultCapacity", label: "Default capacity", fallback: "200" },
      { key: "waitlist", label: "Open a waitlist when an event is full", kind: "toggle", fallback: "true" },
    ],
  },
  orders: {
    heading: "Order settings",
    fields: [
      { key: "returnableDays", label: "Return window (days)", fallback: "7" },
      { key: "cancellationHours", label: "Cancellation window (hours)", fallback: "24" },
      { key: "invoicePrefix", label: "Invoice prefix", fallback: "VGMF-INV" },
      { key: "openBox", label: "Offer open-box delivery", kind: "toggle", fallback: "false" },
    ],
  },
  payments: {
    heading: "Payment settings",
    fields: [
      { key: "currency", label: "Currency", fallback: "INR" },
      { key: "gstPercent", label: "GST (%)", fallback: "5" },
      { key: "cod", label: "Allow cash on delivery", kind: "toggle", fallback: "true" },
    ],
  },
  notifications: {
    heading: "Notification settings",
    fields: [
      { key: "orderEmails", label: "Email customers on order updates", kind: "toggle", fallback: "true" },
      { key: "eventEmails", label: "Email attendees on event updates", kind: "toggle", fallback: "true" },
      { key: "adminAlert", label: "Admin alert address", fallback: "admin@vaidyagogate.org" },
    ],
  },
  security: {
    heading: "Security settings",
    fields: [
      { key: "sessionMinutes", label: "Admin session length (minutes)", fallback: "60" },
      { key: "strongPasswords", label: "Require strong staff passwords", kind: "toggle", fallback: "true" },
      { key: "allowedDomain", label: "Staff email domain", fallback: "vaidyagogate.org" },
    ],
  },
};

export function SectionSettingsDesk({ section }: { section: keyof typeof sectionSettings }) {
  const config = sectionSettings[section];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const saved = getSectionSettings(section);
    return Object.fromEntries(config.fields.map((item) => [item.key, saved[item.key] ?? item.fallback]));
  });
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">{config.heading}</h1>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        {config.fields.map((item) =>
          item.kind === "toggle" ? (
            <label key={item.key} className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={values[item.key] === "true"}
                onChange={(event) => { setValues({ ...values, [item.key]: String(event.target.checked) }); setSaved(false); }}
              />
              {item.label}
            </label>
          ) : (
            <label key={item.key} className="block text-sm font-medium text-slate-800">
              {item.label}
              <input
                className={`${field} mt-1`}
                value={values[item.key]}
                onChange={(event) => { setValues({ ...values, [item.key]: event.target.value }); setSaved(false); }}
              />
            </label>
          )
        )}
        <button type="button" className={button} onClick={() => { saveSectionSettings(section, values); setSaved(true); }}>
          Save settings
        </button>
        {saved && <p className="text-sm text-emerald-700">Settings saved.</p>}
      </div>
    </div>
  );
}

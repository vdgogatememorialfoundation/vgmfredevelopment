"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SiteLogo from "@/components/common/SiteLogo";
import ClientOnly from "@/components/common/ClientOnly";
import { useAuth } from "@/components/auth/AuthContext";
import { PortalLogin } from "@/components/admin/PortalLogin";
import { LiveChatDesk, SupportSection } from "@/components/admin/AdminSupport";
import { addTicket, displayName, setOrderStatus, type OrderStatus } from "@/lib/admin-store";
import { isSupportAgent } from "@/lib/roles";
import { useOrders } from "@/lib/use-cms";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { getShipments } from "@/lib/admin-store";
import { courierTrackingLink } from "@/lib/couriers";
import type { Order } from "@/types";
import { PortalShell } from "@/components/admin/PortalShell";

const ORDER_STATUSES: OrderStatus[] = [
  "Pending", "Paid", "Processing", "Accepted", "Packed", "Ready to Ship", "Shipped", "Out for Delivery", "Delivered", "Failed", "Cancelled",
];

type Tab = "chats" | "tickets" | "new" | "orders";
const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

export function SupportWorkspace() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("chats");
  if (!user || !isSupportAgent(user)) {
    return (
      <>
        <PortalLogin portal="support" />
        <p className="-mt-16 pb-10 text-center text-sm text-text-muted">
          Customer? <Link href="/account/tickets" className="font-semibold text-burgundy">Raise a ticket from your account</Link>
        </p>
      </>
    );
  }
  const tabs: { id: Tab; label: string }[] = [
    { id: "chats", label: "Live chats" },
    { id: "tickets", label: "Support tickets" },
    { id: "new", label: "Create ticket" },
    { id: "orders", label: "Customer orders" },
  ];
  return (
    <PortalShell
      eyebrow="Customer support"
      title="Customer support desk"
      subtitle={`${displayName(user) || user.email} · ${user.email}`}
      groups={[{ items: tabs.map((item) => ({ label: item.label, active: tab === item.id, onSelect: () => setTab(item.id) })) }]}
      contentClassName="bg-slate-50 p-4 sm:p-5 lg:p-8"
      actions={
        <>
          <SiteLogo size={32} />
          {(user.role === "admin" || user.role === "coadmin") && <Link href="/admin" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">Admin</Link>}
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700" onClick={signOut}>Sign out</button>
        </>
      }
    >
      <div className="mx-auto max-w-7xl">
        <ClientOnly>
          {tab === "chats" && <LiveChatDesk />}
          {tab === "tickets" && <SupportSection />}
          {tab === "new" && <CreateTicket agent={user.email} onCreated={() => setTab("tickets")} />}
          {tab === "orders" && <OrderLookup />}
        </ClientOnly>
      </div>
    </PortalShell>
  );
}

function CreateTicket({ agent, onCreated }: { agent: string; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", body: "" });
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });
  return (
    <form
      className="max-w-2xl space-y-3 rounded-2xl border border-slate-200 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.email.trim() || !form.subject.trim() || !form.body.trim()) {
          setError("Add the customer email, a subject and the details.");
          return;
        }
        addTicket({ ...form, portal: "staff", assignedTo: agent });
        onCreated();
      }}
    >
      <h2 className="text-lg font-bold text-slate-900">Create a ticket for a customer</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className={field} placeholder="Customer name" value={form.name} onChange={set("name")} />
        <input className={field} placeholder="Email" type="email" value={form.email} onChange={set("email")} />
        <input className={field} placeholder="Phone" value={form.phone} onChange={set("phone")} />
      </div>
      <input className={field} placeholder="Subject" value={form.subject} onChange={set("subject")} />
      <textarea className={field} rows={5} placeholder="What does the customer need?" value={form.body} onChange={set("body")} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white">Create ticket</button>
    </form>
  );
}

function matches(order: Order, query: string) {
  const address = order.deliveryAddress;
  return [order.id, order.trackingId, order.accountEmail, address?.fullName, address?.phone, address?.email]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function OrderLookup() {
  useCommerceMirror();
  const orders = useOrders();
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const shipments = getShipments();
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? orders.filter((order) => matches(order, q)) : orders;
    return list.slice(0, 50);
  }, [orders, query]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input className={`${field} max-w-md`} placeholder="Search by order id, tracking id, email, phone or name" value={query} onChange={(event) => setQuery(event.target.value)} />
        <span className="text-sm text-slate-500">{found.length} order{found.length === 1 ? "" : "s"}</span>
        {note && <span className="text-sm text-emerald-700">{note}</span>}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[52rem] w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Courier & tracking</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {found.map((order) => {
              const shipment = shipments.find((item) => item.orderId === order.id);
              const awb = shipment?.awb || order.trackingId;
              const link = shipment?.trackingUrl || courierTrackingLink(shipment?.directCourier, awb);
              return (
                <tr key={order.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-slate-900">{order.id}</p>
                    <p className="text-xs text-slate-500">{new Date(order.date).toLocaleString("en-IN")} · ₹{order.total}</p>
                    <p className="text-xs text-slate-500">{order.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <p>{order.deliveryAddress?.fullName || "—"}</p>
                    <p className="text-xs text-slate-500">{order.deliveryAddress?.phone} {order.accountEmail || order.deliveryAddress?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <p>{order.deliveryMode === "store_pickup" ? "Store pickup" : shipment?.courier || order.courierName || "Not booked yet"}</p>
                    {awb && <p className="font-mono text-xs">{awb}</p>}
                    {shipment?.tracking?.length ? <p className="text-xs text-slate-500">{shipment.tracking[shipment.tracking.length - 1]?.status}</p> : null}
                    {link && <a className="text-xs font-semibold text-burgundy" href={link} target="_blank" rel="noopener noreferrer">Courier tracking page</a>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{order.paymentStatus}</td>
                  <td className="px-4 py-3">
                    <select
                      className={field}
                      value={order.status}
                      onChange={(event) => {
                        setOrderStatus(order.id, event.target.value as OrderStatus);
                        setNote(`Order ${order.id} set to ${event.target.value}.`);
                      }}
                    >
                      {[order.status, ...ORDER_STATUSES.filter((status) => status !== order.status)].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
            {found.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No orders match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

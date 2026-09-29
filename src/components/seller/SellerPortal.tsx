"use client";

import { useState } from "react";
import Link from "next/link";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { useAuth } from "@/components/auth/AuthContext";
import {
  getShipments,
  getSellerOrders,
  getSellers,
  printOrderInvoice,
  printPackagingSlip,
  printShippingLabel,
  seedSellerOrders,
  setSellerOrderStatus,
  shipSellerOrder,
  signSellerAgreement,
  startSellerAccount,
  submitSellerBrand,
  submitSellerKyc,
} from "@/lib/admin-store";
import { getLiveBooks } from "@/lib/product-data";
import { classNames, formatDate } from "@/lib/utils";
import type { Order } from "@/types";
import { Button, StatCard, formatINR } from "@/components/admin/AdminUI";

export function SellerPortal() {
  const { user } = useAuth();
  const [, setSeedKey] = useState(0);
  const [sellers, setSellers] = useState(() => getSellers());

  const onboardEmail =
    typeof window !== "undefined" ? window.localStorage.getItem("vgmf_onboard_email") : null;

  const seller =
    user?.role === "seller" && user.sellerId
      ? sellers.find((s) => s.id === user.sellerId)
      : onboardEmail
        ? sellers.find(
            (s) => s.email.toLowerCase() === (onboardEmail || "").toLowerCase()
          )
        : undefined;

  const refresh = () => setSellers(getSellers());

  if (!seller) {
    return <AccountStep onChanged={refresh} />;
  }
  if (seller.status === "Onboarding") return <BrandForm sellerId={seller.id} onChanged={refresh} />;
  if (seller.status === "KYC Pending") return <KycStep sellerId={seller.id} onChanged={refresh} />;
  if (seller.status === "Under Review") return <KycSubmittedView seller={seller} />;
  if (seller.status === "Rejected") return <RejectedView seller={seller} />;
  if (seller.agreement.status !== "Signed") return <AgreementStep sellerId={seller.id} onChanged={refresh} onSeed={setSeedKey} />;

  seedSellerOrders(seller.id);
  return <SellerDashboard seller={seller} onChanged={refresh} op={() => setSeedKey((v) => v + 1)} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-warm-cream/40">
      <div className="container max-w-3xl py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm font-medium text-text-muted hover:text-burgundy">← Back to website</Link>
          <h1 className="mt-2 text-3xl font-bold text-text-primary">Seller portal</h1>
          <p className="text-sm text-text-muted">Sell on VGMF Marketplace.</p>
        </div>
        {children}
      </div>
    </main>
  );
}

function AccountStep({ onChanged }: { onChanged: () => void }) {
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [error, setError] = useState("");

  const submit = () => {
    if (!form.email || !form.password || !form.confirm) {
      setError("Please fill all fields.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    window.localStorage.setItem("vgmf_onboard_email", form.email.trim());
    startSellerAccount({ email: form.email, password: form.password });
    onChanged();
  };

  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Step 1 · Create your account</p>
        <h2 className="mt-1 text-2xl font-bold text-text-primary">Seller sign up</h2>
        <p className="mt-2 text-sm text-text-muted">
          Create your seller account with your email and a password. Next you
          will add your brand name and complete the onboarding form.
        </p>
        <div className="mt-5 space-y-4">
          <Label title="Email id">
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" autoComplete="username" />
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label title="Password">
              <input className="input-field" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 characters" autoComplete="new-password" />
            </Label>
            <Label title="Confirm password">
              <input className="input-field" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Re-enter password" autoComplete="new-password" />
            </Label>
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5">
          <Button onClick={submit}>Create account & continue</Button>
        </div>
        <p className="mt-4 text-sm text-text-muted">
          Already have a seller account?{" "}
          <Link href="/seller/login" className="font-semibold text-burgundy hover:underline">Sign in</Link>
        </p>
      </div>
    </Shell>
  );
}

function BrandForm({ sellerId, onChanged }: { sellerId: string; onChanged: () => void }) {
  const seller = getSellers().find((s) => s.id === sellerId);
  const [form, setForm] = useState({
    brandName: seller?.brandName ?? "",
    firstName: seller?.firstName ?? "",
    middleName: seller?.middleName ?? "",
    lastName: seller?.lastName ?? "",
    phone: seller?.phone ?? "",
    category: seller?.category || "Books",
    description: seller?.description ?? "",
  });
  const [error, setError] = useState("");

  const submit = () => {
    if (!form.brandName || !form.firstName || !form.lastName || !form.phone) {
      setError("Please fill all required fields.");
      return;
    }
    submitSellerBrand(sellerId, form);
    onChanged();
  };

  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Step 2 · Brand & onboarding</p>
        <h2 className="mt-1 text-2xl font-bold text-text-primary">Tell us about your brand</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 block">
            <span className="mb-1 block text-sm font-semibold text-text-primary">Brand name</span>
            <input className="input-field" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} />
          </label>
          <Label title="First name"><input className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Label>
          <Label title="Middle name"><input className="input-field" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} /></Label>
          <Label title="Last name"><input className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Label>
          <Label title="Phone number"><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 ..." /></Label>
          <Label title="Seller category">
            <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["Books", "Ayurveda products", "Herbal supplements", "Wellness & oils", "Other"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Label>
          <label className="sm:col-span-2 block">
            <span className="mb-1 block text-sm font-semibold text-text-primary">Seller description</span>
            <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell buyers about your brand and products." />
          </label>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5">
          <Button onClick={submit}>Save & continue to KYC</Button>
        </div>
      </div>
    </Shell>
  );
}

function Label({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-text-primary">{title}</span>
      {children}
    </label>
  );
}

function KycStep({ sellerId, onChanged }: { sellerId: string; onChanged: () => void }) {
  const [docs, setDocs] = useState<string[]>(["GST certificate", "PAN card"]);

  const submit = () => {
    submitSellerKyc(sellerId, { docs });
    onChanged();
  };

  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Step 3 · Digital KYC</p>
        <h2 className="mt-1 text-2xl font-bold text-text-primary">Submit your KYC documents</h2>
        <div className="mt-5">
          <p className="mb-1 text-sm font-semibold text-text-primary">Digital KYC documents</p>
          {docs.map((doc) => (
            <label key={doc} className="mb-1 flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked
                onChange={() => setDocs((list) => list.filter((d) => d !== doc))}
                className="h-4 w-4 accent-burgundy"
              />
              {doc}
            </label>
          ))}
          <button
            type="button"
            onClick={() => setDocs((list) => [...list, `Doc ${Math.floor(Math.random() * 900) + 100}`])}
            className="mt-1 text-xs font-semibold text-burgundy hover:underline"
          >
            + Add another document
          </button>
        </div>
        <div className="mt-5">
          <Button onClick={submit}>Submit KYC</Button>
        </div>
      </div>
    </Shell>
  );
}

function KycSubmittedView({ seller }: { seller: { status: string; brandName: string; kyc: { status: string; docs: { kind: string; submittedAt: string }[]; submittedAt?: string } } }) {
  const steps = [
    { label: "Application", done: true },
    { label: "Account created", done: true },
    { label: "KYC submitted", done: seller.kyc.status === "Submitted" || seller.kyc.status === "Verified" },
    { label: "Under review", active: seller.status === "Under Review" },
    { label: "Seller id + agreement", done: seller.status === "Active" },
  ];
  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Application status</p>
        <h2 className="mt-1 text-2xl font-bold text-text-primary">{seller.brandName}</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {steps.map((step) => (
            <span
              key={step.label}
              className={classNames(
                "rounded-full px-3 py-1 text-xs font-bold",
                step.done && "bg-emerald-50 text-emerald-700",
                step.active && !step.done && "bg-amber-50 text-amber-700",
                !step.done && !step.active && "bg-warm-cream text-text-muted"
              )}
            >
              {step.done ? "✓ " : ""}{step.label}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-text-muted">
          Your digital KYC is <strong className="text-text-primary">{seller.kyc.status}</strong>. Once our team
          activates you, an email delivers your 12-digit seller id and account credentials — then you sign the
          seller agreement and start selling.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-outline mt-6"
        >
          Check status refresh
        </button>
      </div>
    </Shell>
  );
}

function RejectedView({ seller }: { seller: { brandName: string } }) {
  return (
    <Shell>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <h2 className="text-xl font-bold">Application not approved</h2>
        <p className="mt-2">Your seller application for {seller.brandName} was rejected. Contact support to appeal.</p>
        <Link href="/contact" className="btn-outline mt-5 inline-flex">Contact support</Link>
      </div>
    </Shell>
  );
}

function AgreementStep({
  sellerId,
  onChanged,
  onSeed,
}: {
  sellerId: string;
  onChanged: () => void;
  onSeed: (n: number) => void;
}) {
  const seller = getSellers().find((s) => s.id === sellerId)!;
  const [accepted, setAccepted] = useState(false);

  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Account activated</p>
        <h2 className="mt-1 text-2xl font-bold text-text-primary">Your seller id is ready</h2>
        <p className="mt-1 font-mono text-lg font-bold text-burgundy">{seller.accountId ?? seller.id}</p>
        <div className="mt-4 rounded-xl bg-warm-cream/60 p-4 text-sm text-text-muted">
          <p><strong className="text-text-primary">Brand:</strong> {seller.brandName}</p>
          <p><strong className="text-text-primary">Category:</strong> {seller.category}</p>
          <p><strong className="text-text-primary">Account id:</strong> <span className="font-mono">{seller.accountId ?? "check your email"}</span> (check your email)</p>
        </div>
        <p className="mt-4 text-sm text-text-muted">
          To start selling, review and sign the seller agreement below. Once signed you can list products,
          accept orders, pack, select a courier partner and generate shipping labels.
        </p>
        <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-border p-4 text-xs leading-6 text-text-muted">
          <p className="font-semibold text-text-primary">VGMF Marketplace Seller Agreement</p>
          <p className="mt-1">This Agreement is between {seller.brandName} and Vaidya Gogate Memorial Foundation.
          The Seller agrees to list genuine products, honour published dispatch timelines, use the assigned
          courier partners for fulfilment, and accept returns per the platform returns policy. The Foundation
          provides the marketplace infrastructure, payment settlement (Razorpay), shipping integration (Shiprocket)
          and transactional email delivery (ZeptoMail). This demo agreement is a stand-in for the full legal document.</p>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 accent-burgundy" />
          <span className="text-text-primary">I have read and agree to the seller agreement.</span>
        </label>
        <div className="mt-5 flex gap-2">
          <Button disabled={!accepted} onClick={() => { signSellerAgreement(sellerId); onChanged(); onSeed(Date.now()); }}>
            Sign agreement & start selling
          </Button>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- Dashboard ---------------- */

type SellerTab = "dashboard" | "orders" | "payments" | "products" | "categories";

function SellerDashboard({
  seller,
  onChanged,
  op,
}: {
  seller: { id: string; accountId?: string; payoutsReceived: number };
  onChanged: () => void;
  op: () => void;
}) {
  const [tab, setTab] = useState<SellerTab>("dashboard");
  const [orders, setOrders] = useState<Order[]>(() => {
    seedSellerOrders(seller.id);
    return getSellerOrders();
  });

  const refresh = () => setOrders(getSellerOrders());

  const counts = {
    received: orders.length,
    readyToPack: orders.filter((o) => o.status === "Ordered").length,
    packed: orders.filter((o) => o.status === "Packed").length,
    shipped: orders.filter((o) => o.status === "Shipped").length,
    out: orders.filter((o) => o.status === "Out for Delivery").length,
    delivered: orders.filter((o) => o.status === "Delivered").length,
  };

  return (
    <main className="min-h-screen bg-warm-cream/40">
      <div className="container max-w-6xl py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Seller id {seller.accountId ?? seller.id}</p>
            <h1 className="text-2xl font-bold text-text-primary">Seller dashboard</h1>
          </div>
          <Link href="/" className="text-sm font-medium text-text-muted hover:text-burgundy">← Website</Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["dashboard", "orders", "payments", "products", "categories"] as SellerTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={classNames(
                "rounded-lg px-4 py-2 text-sm font-semibold capitalize transition",
                tab === t ? "bg-burgundy text-white" : "border border-border bg-white text-text-muted hover:text-burgundy"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "dashboard" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Orders received" value={counts.received} />
              <StatCard label="Payouts received" value={formatINR(seller.payoutsReceived)} tone="emerald" />
              <StatCard label="Ready to pack" value={counts.readyToPack} tone="amber" />
              <StatCard label="Packed" value={counts.packed} tone="sky" />
              <StatCard label="Shipped" value={counts.shipped} tone="sky" />
              <StatCard label="Out for delivery" value={counts.out} tone="amber" />
              <StatCard label="Delivered" value={counts.delivered} tone="emerald" />
              <StatCard label="Returns/Cancels" value={orders.filter((o) => o.status === "Cancelled" || o.returnRequest).length} tone="red" />
            </div>
          )}

          {tab === "orders" && (
            <SellerOrders
              orders={orders}
              onChanged={() => { refresh(); op(); onChanged(); }}
            />
          )}

          {tab === "payments" && <PaymentsSection sellerId={seller.id} />}
          {tab === "products" && <SellerProducts />}
          {tab === "categories" && <SellerCategories />}
        </div>
      </div>
    </main>
  );
}

function SellerOrders({ orders, onChanged }: { orders: Order[]; onChanged: () => void }) {
  const [sub, setSub] = useState<"active" | "returns" | "cancellations">("active");
  const list = orders.filter((o) =>
    sub === "active"
      ? o.status !== "Cancelled" && !o.returnRequest
      : sub === "returns"
        ? !!o.returnRequest
        : o.status === "Cancelled"
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["active", "returns", "cancellations"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSub(s)}
            className={classNames(
              "rounded-lg px-4 py-2 text-sm font-semibold capitalize transition",
              sub === s ? "bg-burgundy text-white" : "border border-border bg-white text-text-muted hover:text-burgundy"
            )}
          >
            {s === "active" ? "Active orders" : s}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-text-muted">
          No {sub} here. New orders appear when customers place them.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((order) => (
            <SellerOrderCard key={order.id} order={order} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function SellerOrderCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [courier, setCourier] = useState("Shiprocket");
  const [charges, setCharges] = useState(49);
  const [expanded, setExpanded] = useState(false);
  const shipments = getShipments().filter((s) => s.orderId === order.id);
  const shipment = shipments[0];

  const first = order.items[0];

  const dispatchBy = order.plan ? formatDate(order.plan.shippedBy) : "—";

  const accept = () => {
    setSellerOrderStatus(order.id, "Ordered");
    onChanged();
  };
  const pack = () => {
    setSellerOrderStatus(order.id, "Packed");
    onChanged();
  };
  const ship = () => {
    shipSellerOrder(order.id, courier, charges);
    onChanged();
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <MediaPlaceholder variant="book" label={first?.title ?? "Book"} aspectClassName="aspect-[3/4] w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-text-primary">Order {order.id}</span>
            <StatusChip status={order.status} />
            <span className="text-xs text-text-muted">
              {order.items.length} item(s) · {formatDate(order.date)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-text-primary">
            {order.items.map((i) => i.title).join(", ")}
          </p>
          <p className="text-xs text-text-muted">
            SKU: {first?.bookId} · Item id: {first?.bookId} · Qty {order.items.reduce((s, i) => s + i.quantity, 0)}
          </p>
          <p className="text-xs text-text-muted">
            Dispatch by <span className="font-semibold text-text-primary">{dispatchBy}</span> · Amount{" "}
            <span className="font-bold text-burgundy">{formatINR(order.total)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-burgundy transition hover:bg-warm-cream shrink-0"
        >
          {expanded ? "Hide details" : "View & fulfil"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Items in this order</h4>
          <ul className="space-y-2">
            {order.items.map((item) => (
              <li key={item.bookId} className="flex items-center gap-3 text-sm">
                <MediaPlaceholder variant="book" label={item.title} aspectClassName="aspect-[3/4] w-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text-primary">{item.title}</span>
                  <span className="text-xs text-text-muted">SKU {item.bookId} · Item id {item.bookId}</span>
                </span>
                <span className="text-text-muted">× {item.quantity}</span>
                <span className="font-medium text-text-primary">{formatINR(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {order.status === "Ordered" && (
              <Button variant="success" onClick={accept}>Accept order</Button>
            )}
            {order.status === "Ordered" && (
              <Button onClick={pack}>Accept & pack</Button>
            )}
            {(order.status === "Ordered" || order.status === "Packed") && (
              <>
                <SelectInputCourier value={courier} onChange={setCourier} />
                <input
                  type="number"
                  value={charges}
                  onChange={(e) => setCharges(Number(e.target.value))}
                  className="input-field w-24"
                  aria-label="Courier charges"
                />
                <Button variant="outline" onClick={ship}>
                  Book courier & ship (₹{charges})
                </Button>
              </>
            )}
          </div>

          {shipment ? (
            <div className="mt-3 rounded-xl bg-warm-cream/60 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-text-primary">
                  Shipment via {shipment.courier} · AWB <span className="font-mono text-burgundy">{shipment.awb}</span>
                </p>
                <StatusChip status={shipment.status} />
              </div>
              <p className="text-xs text-text-muted">
                Charges {formatINR(shipment.charges)} · generated {formatDate(shipment.generatedAt)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => printShippingLabel(shipment)}>Shipping label</Button>
                <Button variant="ghost" onClick={() => printOrderInvoice(order, shipment)}>Invoice</Button>
                <Button variant="ghost" onClick={() => printPackagingSlip(order)}>Packaging slip</Button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-text-muted">
              Pack the items, then book the courier to generate the shipping label, invoice and packaging slip.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SelectInputCourier({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="input-field w-44" value={value} onChange={(e) => onChange(e.target.value)}>
      {["Shiprocket", "Ekart Logistics", "Delhivery", "Blue Dart", "DTDC"].map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  );
}

function StatusChip({ status }: { status: string }) {
  const tones: Record<string, string> = {
    Ordered: "bg-burgundy/10 text-burgundy",
    Packed: "bg-amber-50 text-amber-700",
    Shipped: "bg-burgundy/10 text-burgundy",
    "Out for Delivery": "bg-burgundy/10 text-burgundy",
    Delivered: "bg-emerald-50 text-emerald-700",
    Cancelled: "bg-red-50 text-red-600",
    Booked: "bg-warm-cream text-burgundy",
    "Picked Up": "bg-emerald-50 text-emerald-700",
    "In Transit": "bg-amber-50 text-amber-700",
  };
  return (
    <span className={classNames("rounded-full px-2 py-0.5 text-[11px] font-bold", tones[status] ?? "bg-warm-cream text-text-muted")}>
      {status}
    </span>
  );
}

function PaymentsSection({ sellerId }: { sellerId: string }) {
  const orders = getSellerOrders();
  const delivered = orders.filter((o) => o.deliveryAddress?.phone);
  const payable = delivered.filter((o) => o.status === "Delivered").reduce((s, o) => s + o.total, 0);
  const payout = 0;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Payments received this month" value={formatINR(payout)} tone="emerald" hint="Settled payouts" />
      <StatCard label="Delivered value" value={formatINR(payable)} tone="sky" hint="Eligible for settlement" />
      <StatCard label="Orders in transit" value={delivered.length} hint="Payout after delivery" />
      <p className="text-sm text-text-muted sm:col-span-3">
        Settlements are processed via Razorpay after the customer confirms delivery. Seller id {sellerId} · payout account on file.
      </p>
    </div>
  );
}

function SellerProducts() {
  const products = getLiveBooks();
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <h3 className="font-bold text-text-primary">My product listing</h3>
      <p className="text-xs text-text-muted">Catalog available to customers ({products.length} products).</p>
      <ul className="mt-3 divide-y divide-border">
        {products.slice(0, 8).map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
            <MediaPlaceholder variant="book" label={p.title} aspectClassName="aspect-[3/4] w-9" />
            <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{p.title}</span>
            <span className="text-xs text-text-muted">SKU {p.sku}</span>
            <span className="font-semibold text-burgundy">{formatINR(p.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SellerCategories() {
  const live = getLiveBooks();
  const cats = [...new Set(live.map((b) => b.category))];
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <h3 className="font-bold text-text-primary">Product categories</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {cats.map((c) => (
          <li key={c} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
            <span className="font-medium text-text-primary">{c}</span>
            <span className="rounded-full bg-warm-cream px-2 py-0.5 text-xs font-bold text-burgundy">
              {live.filter((b) => b.category === c).length}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
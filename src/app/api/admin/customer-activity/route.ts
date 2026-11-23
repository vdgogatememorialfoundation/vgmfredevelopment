import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { dataFile } from "@/lib/server/paths";
import { findAccount, setAccountPassword, updateFoundationAccount, upsertAccount } from "@/lib/server/accounts";
import { listSignupForms } from "@/lib/server/signup-forms";
import { listShopOrders, ordersForAccount, patchShopOrder } from "@/lib/server/shop-orders";
import { listAudit } from "@/lib/server/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readJsonSafe<T>(filename: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(dataFile(filename), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;

  const email = (request.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });

  const fa = findAccount(email);
  const signupForms = listSignupForms().filter((f) => f.email.trim().toLowerCase() === email);
  const myOrders = ordersForAccount({ email, phone: fa?.phone || "", id: fa?.id });

  const carts = readJsonSafe<Array<{ email?: string; items?: Array<{ bookId: string; quantity: number }>; at?: number }>>("shop-carts.json", []);
  const myCart = carts.find((c) => String(c.email || "").trim().toLowerCase() === email);

  const presence = readJsonSafe<{
    customers?: Array<{ id: string; at: string; email: string; kind: string; detail: string }>;
  }>("live-presence.json", {});

  const customerActions = (presence.customers ?? []).filter((c) => c.email.toLowerCase() === email);
  const auditRows = listAudit({ q: email, limit: 200 });

  const websitePassword = fa?.password || "";
  const passwordHistory: Array<{ password: string; at: string; source: string }> = [];
  const seenPass = new Set<string>();
  const addPass = (password?: string, at?: string, source = "Website") => {
    if (!password) return;
    const key = `${password}|${source}`;
    if (seenPass.has(key)) return;
    seenPass.add(key);
    passwordHistory.push({ password, at: at || fa?.createdAt || new Date().toISOString(), source });
  };
  if (websitePassword) addPass(websitePassword, fa?.createdAt, "Active Website Password");
  for (const h of fa?.passwordHistory ?? []) {
    if (!/portal/i.test(String(h.source || ""))) addPass(h.password, h.at, h.source || "Website");
  }

  const timeline: Array<{ id: string; at: string; category: string; title: string; detail: string }> = [];

  if (fa?.createdAt) {
    timeline.push({
      id: "acct-created",
      at: String(fa.createdAt),
      category: "account",
      title: "Website Account Created",
      detail: `Account ID: ${fa.accountId || "—"} · Email: ${email}`,
    });
  }

  for (const sf of signupForms) {
    timeline.push({
      id: `form-${sf.formId}`,
      at: sf.createdAt,
      category: "signup",
      title: `Signup Acknowledgement Form Accepted (${sf.method === "google" ? "Google" : "Email"})`,
      detail: `Form ID: ${sf.formId} · Ack ID: ${sf.acknowledgementId} · IP: ${sf.ip || "—"}`,
    });
  }

  for (const act of customerActions) {
    timeline.push({
      id: act.id,
      at: act.at,
      category: "activity",
      title: `Customer Action: ${act.kind}`,
      detail: act.detail || email,
    });
  }

  for (const aud of auditRows) {
    timeline.push({
      id: `aud-${aud.id}`,
      at: aud.at,
      category: "audit",
      title: aud.action,
      detail: [aud.detail, aud.target ? `Target: ${aud.target}` : "", aud.ip ? `IP: ${aud.ip}` : "", aud.actor ? `By: ${aud.actor}` : ""].filter(Boolean).join(" · "),
    });
  }

  for (const ord of myOrders) {
    timeline.push({
      id: `ord-${ord.id}`,
      at: ord.date,
      category: "order",
      title: `Order #${ord.id} Placed (₹${ord.total})`,
      detail: `${(ord.items ?? []).map((i) => `${i.title} × ${i.quantity}`).join(", ")} · ${ord.deliveryMode === "store_pickup" ? "Store Pickup" : "Home Delivery"} · ${ord.paymentStatus}`,
    });
    for (const h of ord.history ?? []) {
      timeline.push({
        id: `ord-h-${ord.id}-${h.at}-${h.status}`,
        at: h.at,
        category: "order_status",
        title: `Order #${ord.id}: ${h.status}`,
        detail: [h.note, h.by ? `By: ${h.by}` : ""].filter(Boolean).join(" · "),
      });
    }
  }

  timeline.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));

  return NextResponse.json(
    {
      ok: true,
      email,
      websitePassword,
      passwordHistory,
      signupForms,
      activeCart: myCart && Array.isArray(myCart.items) && myCart.items.length ? myCart : null,
      timeline,
    },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const currentEmail = String(body.currentEmail || body.email || "").trim().toLowerCase();
  const nextEmail = String(body.email || currentEmail).trim().toLowerCase();
  if (!currentEmail) return NextResponse.json({ ok: false, error: "Customer email is required." }, { status: 400 });

  const address = (body.address ?? {}) as Record<string, string>;
  const extraFields: Record<string, string> = {};
  for (const k of ["line1", "landmark", "city", "state", "pincode", "country", "countryCode"]) {
    if (address[k] !== undefined) extraFields[k] = String(address[k] || "").trim();
  }

  let updated = updateFoundationAccount(currentEmail, {
    salutation: typeof body.salutation === "string" ? body.salutation : undefined,
    firstName: typeof body.firstName === "string" ? body.firstName : undefined,
    middleName: typeof body.middleName === "string" ? body.middleName : undefined,
    lastName: typeof body.lastName === "string" ? body.lastName : undefined,
    email: nextEmail,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : typeof body.phone === "string" ? body.phone : undefined,
    alternatePhone: typeof body.alternatePhone === "string" ? body.alternatePhone : undefined,
    extraFields: Object.keys(extraFields).length ? extraFields : undefined,
  });

  if (!updated && typeof body.firstName === "string" && typeof body.phone === "string") {
    updated = upsertAccount({
      salutation: String(body.salutation || "Dr."),
      firstName: String(body.firstName),
      middleName: String(body.middleName || ""),
      lastName: String(body.lastName || ""),
      email: nextEmail,
      phone: String(body.phone),
      whatsapp: String(body.phone),
      alternatePhone: String(body.alternatePhone || body.phone),
    });
  }

  const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";
  if (newPassword) {
    updated = setAccountPassword(nextEmail, newPassword, "Set by Admin") ?? updated;
  }

  const myOrders = listShopOrders().filter(
    (o) =>
      (o.accountEmail || "").toLowerCase() === currentEmail ||
      (o.deliveryAddress?.email || "").toLowerCase() === currentEmail
  );
  for (const ord of myOrders) {
    if (ord.status === "Delivered" || ord.status === "Cancelled") continue;
    const prevAddr = ord.deliveryAddress ?? { fullName: "", phone: "", line1: "", city: "", state: "Maharashtra", pincode: "", country: "India" };
    patchShopOrder(ord.id, {
      accountEmail: nextEmail,
      deliveryAddress: {
        ...prevAddr,
        fullName: [body.firstName, body.middleName, body.lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ") || prevAddr.fullName,
        phone: String(body.phone || prevAddr.phone || "").trim(),
        altPhone: String(body.alternatePhone || prevAddr.altPhone || body.phone || "").trim(),
        email: nextEmail,
        line1: extraFields.line1 || prevAddr.line1,
        landmark: extraFields.landmark || prevAddr.landmark,
        city: extraFields.city || prevAddr.city,
        state: extraFields.state || prevAddr.state,
        pincode: extraFields.pincode || prevAddr.pincode,
      },
    });
  }

  return NextResponse.json({ ok: true, account: updated });
}

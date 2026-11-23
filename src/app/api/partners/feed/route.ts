import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { loadPartnerSnapshot, publicPartnerFeed } from "@/lib/server/partner-portals";
import { listAccounts } from "@/lib/server/accounts";
import { listSignupForms } from "@/lib/server/signup-forms";
import { listShopOrders } from "@/lib/server/shop-orders";
import type { DeliveryAddress, User } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

type MainSiteUser = User & {
  passwordHistory?: Array<{ password: string; at: string; source?: string }>;
};

function buildMainSiteCustomerAccounts(): MainSiteUser[] {
  const byEmail = new Map<string, MainSiteUser>();
  const upsert = (incoming: MainSiteUser) => {
    const email = (incoming.email || "").trim().toLowerCase();
    if (!email) return;
    const prev = byEmail.get(email);
    if (!prev) {
      byEmail.set(email, incoming);
      return;
    }
    const histMap = new Map<string, { password: string; at: string; source?: string }>();
    for (const h of [...(prev.passwordHistory ?? []), ...(incoming.passwordHistory ?? [])]) {
      if (h?.password) histMap.set(`${h.password}|${h.source || ""}`, h);
    }
    byEmail.set(email, {
      ...prev,
      id: prev.id || incoming.id,
      accountId: prev.accountId || incoming.accountId,
      salutation: prev.salutation || incoming.salutation || "Dr.",
      firstName: prev.firstName || incoming.firstName,
      middleName: prev.middleName || incoming.middleName,
      lastName: prev.lastName || incoming.lastName,
      phone: prev.phone || incoming.phone,
      whatsapp: prev.whatsapp || incoming.whatsapp || prev.phone || incoming.phone,
      alternatePhone: prev.alternatePhone || incoming.alternatePhone || prev.phone || incoming.phone,
      address: prev.address?.line1 ? prev.address : incoming.address,
      password: incoming.password || prev.password,
      passwordHistory: histMap.size ? [...histMap.values()] : undefined,
      foundationPasswordSet: Boolean(prev.foundationPasswordSet || incoming.foundationPasswordSet || incoming.password || prev.password),
      createdAt: prev.createdAt || incoming.createdAt,
      status: prev.status || incoming.status || "active",
      role: prev.role === "admin" || prev.role === "coadmin" || prev.role === "staff" ? prev.role : "customer",
    });
  };

  for (const fa of listAccounts()) {
    const extra = fa.extraFields ?? {};
    const address: DeliveryAddress | undefined =
      extra.line1 || extra.city || extra.pincode
        ? {
            fullName: [fa.firstName, fa.middleName, fa.lastName].filter(Boolean).join(" "),
            phone: fa.phone,
            email: fa.email,
            line1: extra.line1 || "",
            landmark: extra.landmark || undefined,
            city: extra.city || "",
            state: extra.state || "Maharashtra",
            pincode: extra.pincode || "",
            country: extra.country || "India",
            countryCode: extra.countryCode || "IN",
          }
        : undefined;
    upsert({
      id: fa.id,
      accountId: fa.accountId,
      salutation: fa.salutation || "Dr.",
      firstName: fa.firstName,
      middleName: fa.middleName,
      lastName: fa.lastName,
      email: fa.email,
      phone: fa.phone,
      whatsapp: fa.whatsapp || fa.phone,
      alternatePhone: fa.alternatePhone || fa.phone,
      address,
      role: "customer",
      status: "active",
      password: fa.password,
      passwordHistory: fa.passwordHistory,
      foundationPasswordSet: Boolean(fa.passwordHash || fa.password),
      createdAt: fa.createdAt,
    });
  }

  for (const sf of listSignupForms()) {
    if (sf.method !== "email" && sf.method !== "google") continue;
    upsert({
      id: `form-${sf.formId}`,
      accountId: sf.accountId,
      salutation: sf.salutation || "Dr.",
      firstName: sf.firstName,
      middleName: sf.middleName,
      lastName: sf.lastName,
      email: sf.email,
      phone: sf.phone,
      whatsapp: sf.phone,
      alternatePhone: sf.phone,
      role: "customer",
      status: "active",
      createdAt: sf.createdAt,
    });
  }

  for (const ord of listShopOrders()) {
    const email = (ord.accountEmail || ord.deliveryAddress?.email || ord.createdBy || "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const addr = ord.deliveryAddress;
    const nameParts = (addr?.fullName || "").trim().split(/\s+/).filter(Boolean);
    upsert({
      id: ord.userId && ord.userId !== "guest" ? ord.userId : `ord-usr-${ord.id}`,
      salutation: "Dr.",
      firstName: nameParts[0] || email.split("@")[0],
      lastName: nameParts.slice(1).join(" "),
      email,
      phone: addr?.phone || "",
      whatsapp: addr?.phone || "",
      alternatePhone: addr?.altPhone || addr?.phone || "",
      address: addr?.line1 ? addr : undefined,
      role: "customer",
      status: "active",
      createdAt: ord.date,
    });
  }

  return [...byEmail.values()];
}

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const full = request.nextUrl.searchParams.get("full") === "1";
  const snapshot = await loadPartnerSnapshot({ refresh });
  if (full) {
    const denied = denyUnlessPortal(request);
    if (denied) return denied;
    const pub = publicPartnerFeed(snapshot);
    return NextResponse.json(
      {
        ok: true,
        ...pub,
        accounts: buildMainSiteCustomerAccounts(),
        ticketsByEmail: {},
        paymentsByEmail: {},
      },
      { headers: { ...corsHeaders, "cache-control": "no-store" } }
    );
  }
  return NextResponse.json(
    { ok: true, ...publicPartnerFeed(snapshot) },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}

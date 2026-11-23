import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { publicOrderSettings, type OrderSettings } from "@/lib/integrations";
import { savedAdminIntegrations } from "@/lib/server/admin-integrations";
import { verifyAwbLabelImage } from "@/lib/server/awb-verify";
import {
  isPackedBalanceDue,
  listPackedUnpaidOrders,
  orderBalanceDue,
  sendBalanceDueReminder,
  type ReminderChannel,
} from "@/lib/server/balance-reminder";
import { refreshStoredShipment } from "@/lib/server/live-track";
import { storeUploadedFile } from "@/lib/server/media-upload";
import { corsHeaders, readMobileFeed } from "@/lib/server/mobile-feed";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { feedPreorderable } from "@/lib/server/mobile-shop";
import { dataFile } from "@/lib/server/paths";
import {
  checkPortalLogin,
  findPortalAccount,
  issuePortalOtp,
  portalAccountBlocked,
  readPortalAccess,
  registerDeliveryPartnerAccount,
  verifyPortalOtp,
} from "@/lib/server/portal-accounts";
import {
  createPortalMobileSession,
  extractBearerToken,
  portalSessionFrom,
  portalSessionFromToken,
  revokePortalMobileSession,
} from "@/lib/server/portal-auth";
import {
  razorpayCreds,
  razorpayDeviceActivity,
  razorpayDeviceActivityStatus,
  razorpayLink,
  razorpayLinkStatus,
  razorpayOrder,
  razorpayOrderPayments,
  razorpayVerify,
} from "@/lib/server/providers";
import { findShopOrder, listShopOrders, patchShopOrder, upsertShopOrder } from "@/lib/server/shop-orders";
import { findShopShipment, listShopShipments } from "@/lib/server/shop-shipments";
import { allTickets, findTicket, replyToTicket, saveTicket } from "@/lib/server/support-tickets";
import { pickupOtp, pickupOtpReady } from "@/lib/store";
import { confirmAndSyncCodPayment, createDoorstepCodQr } from "@/lib/server/cod-payments";
import {
  authorizeOpenBoxSession,
  completeOpenBoxSession,
  readAdvancedStore,
  reconcilePickupManifest,
  scanIntoPickupManifest,
  startOpenBoxSession,
  updateExecutiveShiftStatus,
  type ServiceModeChoice,
} from "@/lib/server/vgmf-advanced-logistics";
import { buildKycPipelineStages, submitManualKyc, submitAccuraScanKyc, getEnabledKycProviders, type AgentKycData } from "@/lib/server/agent-kyc";
import {
  addAwbToBag,
  addCustomHub,
  addHubExecutive,
  applyDeliveryScanEvent,
  applyReturnEvent,
  assignParcelToAgent,
  buildDeliveryDashboard,
  createBag,
  createReturnShipmentRecord,
  createVgmfManifest,
  dispatchBagTransfer,
  ensureAgentEnrollmentOnSignup,
  generateVgmfAwb,
  getAgentEnrollment,
  requestAgentHubEnrollment,
  lookupInternalTracking,
  receiveBagTransfer,
  removeHubExecutive,
  resendDeliveryOrPickupOtp,
  sealBag,
  type HubType,
} from "@/lib/server/vgmf-logistics";

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}
import type { Order } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKED = "This account is disabled. Contact support@vaidyagogate.org for help.";
const OPEN_FOR_PICK = new Set(["Paid", "Ordered", "Accepted", "Processing", "Awaiting Confirmation", "To Ship"]);
const PACKED_SET = new Set(["Packed", "Ready to Ship", "To Ship"]);

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

function newOrderId() {
  const bytes = randomBytes(12);
  return Array.from(bytes, (b, i) => (i === 0 ? 1 + (b % 9) : b % 10)).join("");
}

function enrichOrder(order: Order) {
  const due = orderBalanceDue(order);
  const shipment = findShopShipment(order.id);
  const feedBooks = (readMobileFeed().books ?? []) as unknown as Record<string, unknown>[];
  const enrichedItems = (order.items ?? []).map((it) => {
    const b = feedBooks.find((row) => String(row.id) === String(it.bookId));
    return {
      ...it,
      sku: it.sku || (b?.sku ? String(b.sku) : undefined),
      barcode: b?.barcode ? String(b.barcode) : undefined,
      productCode: b?.productCode ? String(b.productCode) : b?.code ? String(b.code) : undefined,
      isbn: b?.isbn ? String(b.isbn) : undefined,
      batchNo: it.batchNo || (b?.batchNo ? String(b.batchNo) : undefined),
    };
  });
  return {
    ...order,
    items: enrichedItems,
    balanceDue: due,
    isPackedUnpaid: isPackedBalanceDue(order),
    shipment: shipment
      ? {
          id: shipment.id,
          courier: shipment.courier,
          provider: shipment.provider,
          directCourier: shipment.directCourier,
          awb: shipment.awb,
          status: shipment.status,
          expectedBy: shipment.expectedBy,
          trackingUrl: shipment.trackingUrl,
          agentName: shipment.agentName,
          agentPhone: shipment.agentPhone,
          deliveryOtp: shipment.deliveryOtp,
          tracking: shipment.tracking ?? [],
          events: shipment.tracking ?? (shipment as { events?: unknown[] }).events ?? [],
        }
      : undefined,
  };
}

function bookCodesMatch(book: Record<string, unknown> | undefined, item: Order["items"][number], raw: string) {
  const code = raw.trim().toLowerCase();
  if (!code) return false;
  const candidates = [
    item.bookId,
    item.sku,
    item.batchNo,
    book?.id,
    book?.sku,
    book?.isbn,
    book?.barcode,
    book?.code,
    book?.productCode,
    book?.slug,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());
  return candidates.some((c) => c === code || code.startsWith(`${c}-u`) || code.includes(c));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "").trim();

  // --- Public auth actions ---
  if (action === "login") {
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");
    const account = checkPortalLogin(email, password);
    if (!account) return json({ ok: false, error: "Incorrect email or password." }, 401);
    const session = createPortalMobileSession({
      email: String(account.email || email),
      role: String(account.role || "staff"),
      firstName: String(account.firstName || ""),
      lastName: String(account.lastName || ""),
      name: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || String(account.email || email),
      staffRoleId: account.staffRoleId ? String(account.staffRoleId) : undefined,
    });
    return json({ ok: true, token: session.token, session, account, access: readPortalAccess() });
  }

  if (action === "delivery-signup") {
    try {
      const account = registerDeliveryPartnerAccount({
        name: String(body?.name ?? "").trim(),
        email: String(body?.email ?? "").trim(),
        phone: String(body?.phone ?? "").trim(),
        password: String(body?.password ?? ""),
      });
      const session = createPortalMobileSession({
        email: String(account.email),
        role: String(account.role || "staff"),
        firstName: String(account.firstName || ""),
        lastName: String(account.lastName || ""),
        name: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || String(account.email),
        staffRoleId: "delivery_partner",
      });
      ensureAgentEnrollmentOnSignup({ email: String(account.email), name: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || String(account.email), phone: String(account.phone || "") });
      return json({ ok: true, token: session.token, session, account, access: readPortalAccess(), message: "Account created! Now select your VGMF Hub & complete KYC." });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Sign up failed." }, 400);
    }
  }

  if (action === "otp-send") {
    const email = String(body?.email ?? "").trim();
    const account = email ? findPortalAccount(email) : null;
    if (!account) return json({ ok: false, error: "No portal account found for this email." }, 404);
    if (portalAccountBlocked(account)) return json({ ok: false, error: BLOCKED }, 403);
    const code = issuePortalOtp(email);
    if (code) {
      const portal = String(body?.portal || "VGMF").replace(/[^\w &-]/g, "").slice(0, 40) || "VGMF";
      const sent = await sendMobileEmail(
        String(account.email),
        `${code} is your VGMF ${portal} app sign-in code`,
        `${code} is your Vaidya Gogate Memorial Foundation sign-in code for the ${portal} mobile app.\n\nIt expires in 10 minutes.`
      ).catch(() => false);
      if (!sent) return json({ ok: false, error: "Could not email the sign-in code right now." }, 502);
    }
    return json({ ok: true, message: "A 6-digit sign-in code was emailed to you." });
  }

  if (action === "otp-verify") {
    const email = String(body?.email ?? "").trim();
    const code = String(body?.code ?? "").trim();
    const account = email ? findPortalAccount(email) : null;
    if (!account) return json({ ok: false, error: "No portal account found for this email." }, 404);
    if (portalAccountBlocked(account)) return json({ ok: false, error: BLOCKED }, 403);
    const invalid = verifyPortalOtp(email, code);
    if (invalid) return json({ ok: false, error: invalid }, 401);
    const session = createPortalMobileSession({
      email: String(account.email || email),
      role: String(account.role || "staff"),
      firstName: String(account.firstName || ""),
      lastName: String(account.lastName || ""),
      name: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || String(account.email || email),
      staffRoleId: account.staffRoleId ? String(account.staffRoleId) : undefined,
    });
    return json({ ok: true, token: session.token, session, account, access: readPortalAccess() });
  }

  if (action === "logout") {
    revokePortalMobileSession(extractBearerToken(request) || String(body?.token ?? ""));
    return json({ ok: true });
  }

  // --- Authenticated portal actions ---
  const session = portalSessionFrom(request);
  if (!session) return json({ ok: false, error: "Please sign in with your VGMF portal account." }, 401);

  if (action === "me") {
    const account = findPortalAccount(session.email);
    return json({ ok: true, session, account, access: readPortalAccess() });
  }

  if (action === "dashboard") {
    const orders = listShopOrders().filter((o) => !o.splitInto?.length);
    const active = orders.filter((o) => o.status !== "Cancelled");
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = active.filter((o) => String(o.date || "").slice(0, 10) === todayStr);
    const packedUnpaid = orders.filter(isPackedBalanceDue);
    const tickets = allTickets();
    const openTickets = tickets.filter((t) => t.status === "Open" || t.status === "In Progress");
    const books = (readMobileFeed().books ?? []) as unknown as Record<string, unknown>[];
    const lowStock = books.filter((b) => Number(b.stock ?? 0) <= 5 && b.active !== false);
    const posSalesToday = todayOrders.filter((o) => o.channel === "pos");
    return json({
      ok: true,
      session,
      metrics: {
        totalOrders: orders.length,
        todayOrders: todayOrders.length,
        todayRevenue: todayOrders.reduce((s, o) => s + Number(o.total || 0), 0),
        totalRevenue: active.reduce((s, o) => s + Number(o.total || 0), 0),
        pendingPick: orders.filter((o) => OPEN_FOR_PICK.has(o.status) && !o.pick?.pickedAt).length,
        readyToPack: orders.filter((o) => Boolean(o.pick?.pickedAt) && !o.pick?.packedAt && o.status !== "Cancelled").length,
        packedCount: orders.filter((o) => PACKED_SET.has(o.status)).length,
        packedUnpaidCount: packedUnpaid.length,
        packedUnpaidAmount: packedUnpaid.reduce((s, o) => s + orderBalanceDue(o), 0),
        shippedCount: orders.filter((o) => o.status === "Shipped" || o.status === "Out for Delivery").length,
        deliveredCount: orders.filter((o) => o.status === "Delivered").length,
        openTickets: openTickets.length,
        lowStockCount: lowStock.length,
        posSalesTodayCount: posSalesToday.length,
        posSalesTodayAmount: posSalesToday.reduce((s, o) => s + Number(o.total || 0), 0),
      },
      packedUnpaid: packedUnpaid.slice(0, 40).map(enrichOrder),
      recentOrders: orders.slice(0, 15).map(enrichOrder),
    });
  }

  if (action === "orders") {
    const filter = String(body?.filter ?? "all").toLowerCase();
    const q = String(body?.q ?? "").trim().toLowerCase();
    const limit = Math.min(200, Math.max(10, Number(body?.limit) || 80));
    let list = listShopOrders().filter((o) => !o.splitInto?.length);
    if (filter === "packed") list = list.filter((o) => PACKED_SET.has(o.status));
    else if (filter === "packed_unpaid") list = list.filter(isPackedBalanceDue);
    else if (filter === "to_pack") list = list.filter((o) => OPEN_FOR_PICK.has(o.status));
    else if (filter === "shipped") list = list.filter((o) => o.status === "Shipped" || o.status === "Out for Delivery");
    else if (filter === "delivered") list = list.filter((o) => o.status === "Delivered");
    else if (filter === "cancelled") list = list.filter((o) => o.status === "Cancelled");
    else if (filter === "pos") list = list.filter((o) => o.channel === "pos");
    if (q) {
      list = list.filter((o) =>
        [o.id, o.deliveryAddress?.fullName, o.deliveryAddress?.phone, o.deliveryAddress?.email, o.trackingId, o.courierName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return json({ ok: true, total: list.length, orders: list.slice(0, limit).map(enrichOrder) });
  }

  if (action === "order-detail") {
    const id = String(body?.orderId ?? "").trim();
    const order = findShopOrder(id);
    if (!order) return json({ ok: false, error: "Order not found." }, 404);
    return json({ ok: true, order: enrichOrder(order) });
  }

  if (action === "order-update") {
    const id = String(body?.orderId ?? "").trim();
    const order = findShopOrder(id);
    if (!order) return json({ ok: false, error: "Order not found." }, 404);
    const at = new Date().toISOString();
    const by = session.name || session.email;
    const patch: Partial<Order> = {};
    const notes: string[] = [];

    if (typeof body?.status === "string" && body.status.trim()) {
      patch.status = body.status.trim() as Order["status"];
      notes.push(`Status updated to ${patch.status}`);
    }
    if (body?.markBalancePaid === true) {
      const method = String(body?.paymentMethod || "UPI / Bank").trim();
      const ref = String(body?.paymentRef || "").trim();
      patch.paymentStatus = "Paid";
      patch.paidAt = order.paidAt || at;
      if (order.preorderPayment) {
        patch.preorderPayment = { ...order.preorderPayment, balancePaidAt: at, balanceRef: ref || `Desk (${method})` };
      }
      notes.push(`Remaining balance recorded paid via ${method}${ref ? ` (${ref})` : ""}`);
    }
    if (typeof body?.note === "string" && body.note.trim()) {
      notes.push(body.note.trim());
    }
    if (!Object.keys(patch).length && !notes.length) {
      return json({ ok: false, error: "Nothing to update." }, 400);
    }
    patch.history = [
      ...(order.history ?? []),
      { at, status: patch.status ?? order.status, by, note: notes.join(" · ") || "Updated from mobile app" },
    ];
    const updated = patchShopOrder(id, patch);
    return json({ ok: true, order: updated ? enrichOrder(updated) : undefined });
  }

  if (action === "balance-reminder") {
    const channels = Array.isArray(body?.channels) && body.channels.length ? (body.channels as ReminderChannel[]) : (["whatsapp", "email"] as ReminderChannel[]);
    const by = session.name || session.email;
    if (body?.allPackedUnpaid) {
      const dueOrders = listPackedUnpaidOrders();
      const results = [];
      for (const item of dueOrders) {
        results.push(await sendBalanceDueReminder(item.id, { channels, by }));
      }
      const sentCount = results.filter((r) => r.ok).length;
      return json({ ok: sentCount > 0 || dueOrders.length === 0, sentCount, total: dueOrders.length, results });
    }
    const orderId = String(body?.orderId ?? "").trim();
    if (!orderId) return json({ ok: false, error: "Send an orderId." }, 400);
    const result = await sendBalanceDueReminder(orderId, { channels, by });
    const latest = findShopOrder(orderId);
    return json({ ...result, order: latest ? enrichOrder(latest) : undefined }, result.ok ? 200 : 400);
  }

  if (action === "pick-pack-queue") {
    const orders = listShopOrders().filter((o) => !o.splitInto?.length && o.status !== "Cancelled" && o.status !== "Delivered");
    const me = session.email.toLowerCase();
    const isLead = session.role === "admin" || session.role === "coadmin";
    // Strictly exclude unassigned orders from Picker & Packer apps! Only explicitly assigned orders enter pick/pack queues.
    const pickQueue = orders.filter(
      (o) =>
        Boolean(o.pick?.assignee?.trim()) &&
        !o.pick?.pickedAt &&
        !o.pick?.packedAt &&
        (isLead || o.pick!.assignee.trim().toLowerCase() === me)
    );
    const packQueue = orders.filter(
      (o) =>
        Boolean((o.pick?.packer || o.pick?.assignee)?.trim()) &&
        Boolean(o.pick?.pickedAt) &&
        !o.pick?.packedAt &&
        (isLead || (o.pick!.packer || o.pick!.assignee).trim().toLowerCase() === me)
    );
    const recentlyPacked = orders
      .filter((o) => PACKED_SET.has(o.status) && Boolean(o.pick?.packedAt || o.pick?.assignee || o.pick?.packer))
      .slice(0, 30);
    return json({
      ok: true,
      unassigned: [],
      pickQueue: pickQueue.slice(0, 50).map(enrichOrder),
      packQueue: packQueue.slice(0, 50).map(enrichOrder),
      recentlyPacked: recentlyPacked.map(enrichOrder),
    });
  }

  if (action === "upload-awb-photo") {
    const orderId = String(body?.orderId ?? "").trim();
    const dataUrl = String(body?.dataUrl ?? "").trim();
    const submittedAwb = String(body?.awb ?? "").trim().slice(0, 64);
    const filename = String(body?.filename ?? `awb-${orderId}.jpg`).trim();
    const order = findShopOrder(orderId);
    if (!order) return json({ ok: false, error: "Order not found." }, 404);
    const shipment = findShopShipment(orderId);
    const allottedAwb = String(shipment?.awb || order.trackingId || "").trim();
    const normAwb = (v?: string) => String(v || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const expectedKey = normAwb(allottedAwb);
    const submittedKey = normAwb(submittedAwb);

    if (!expectedKey) {
      return json({ ok: false, error: "Courier AWB has not been allotted to this order yet. Book a courier first." }, 400);
    }
    if (submittedKey && submittedKey !== expectedKey) {
      return json(
        {
          ok: false,
          error: `Strict AWB mismatch: scanned/entered AWB "${submittedAwb}" does not match courier-allotted AWB "${allottedAwb}".`,
        },
        400
      );
    }
    const alreadyUploaded = (order.awbPhotos ?? []).some(
      (p) => (shipment?.id && p.shipmentId === shipment.id) || normAwb(p.awb) === expectedKey
    );
    if (alreadyUploaded) {
      return json(
        {
          ok: false,
          error: `An AWB image is already uploaded for ${shipment?.courier || order.courierName || "this courier"} (AWB ${allottedAwb}). Delete the existing image or reassign the courier to upload a new one.`,
        },
        409
      );
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return json({ ok: false, error: "Choose an AWB label image or PDF to upload." }, 400);
    const mime = match[1];
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
      return json({ ok: false, error: "File must be under 10 MB." }, 400);
    }
    const ext = mime.includes("pdf") ? ".pdf" : mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
    const safeName = filename.includes(".") ? filename : `awb-${orderId}${ext}`;
    // Automatically read barcode + OCR text from the clicked label photo and verify against courier-allotted AWB!
    let verifiedVia = "Barcode/OCR";
    if (!mime.includes("pdf")) {
      const check = await verifyAwbLabelImage(bytes, ext, allottedAwb, orderId);
      if (!check.matched) {
        const seenCodes = check.barcodes.length ? ` Detected barcodes: ${check.barcodes.join(", ")}.` : "";
        return json(
          {
            ok: false,
            error: `Auto-verification failed: Label photo does not match courier-allotted AWB "${allottedAwb}".${seenCodes} Click a clear photo of the pasted shipping label.`,
          },
          422
        );
      }
      verifiedVia = check.method;
    } else if (submittedKey !== expectedKey) {
      return json({ ok: false, error: `For PDF upload, scan or enter the exact courier AWB "${allottedAwb}".` }, 400);
    }
    const fileObj = new File([bytes], safeName, { type: mime });
    const stored = await storeUploadedFile(fileObj);
    const at = new Date().toISOString();
    const byName = session.name || session.email;
    const courierName = shipment?.courier || order.courierName || undefined;
    const entry = {
      url: stored.url,
      at,
      by: session.email,
      byName,
      awb: allottedAwb,
      courier: courierName,
      shipmentId: shipment?.id || undefined,
    };
    const nextPhotos = [...(order.awbPhotos ?? []), entry];
    const patch: Partial<Order> = {
      awbPhotos: nextPhotos,
      history: [
        ...(order.history ?? []),
        { at, status: order.status, by: byName, note: `AWB label auto-verified via ${verifiedVia} & uploaded (${courierName ? `${courierName} · ` : ""}AWB ${allottedAwb})` },
      ],
    };
    const updated = patchShopOrder(orderId, patch);
    return json({ ok: true, photo: entry, order: updated ? enrichOrder(updated) : undefined });
  }

  if (action === "delete-awb-photo") {
    const orderId = String(body?.orderId ?? "").trim();
    const url = String(body?.url ?? "").trim();
    if (!orderId || !url) return json({ ok: false, error: "Order ID and photo URL are required." }, 400);
    const order = findShopOrder(orderId);
    if (!order) return json({ ok: false, error: "Order not found." }, 404);
    const existing = order.awbPhotos ?? [];
    const target = existing.find((p) => p.url === url);
    if (!target) return json({ ok: false, error: "AWB image not found on this order." }, 404);
    const nextPhotos = existing.filter((p) => p.url !== url);
    const at = new Date().toISOString();
    const byName = session.name || session.email;
    const updated = patchShopOrder(orderId, {
      awbPhotos: nextPhotos,
      history: [
        ...(order.history ?? []),
        { at, status: order.status, by: byName, note: `Deleted AWB label image${target.awb ? ` (AWB ${target.awb})` : ""}` },
      ],
    });
    return json({ ok: true, order: updated ? enrichOrder(updated) : undefined });
  }

  if (action === "pick-pack-action") {
    const sub = String(body?.sub ?? "").trim();
    const orderId = String(body?.orderId ?? "").trim();
    const order = findShopOrder(orderId);
    if (!order) return json({ ok: false, error: "Order not found." }, 404);
    const at = new Date().toISOString();
    const by = session.name || session.email;
    const me = session.email.toLowerCase();
    const books = (readMobileFeed().books ?? []) as unknown as Record<string, unknown>[];
    const normCode = (v?: unknown) => String(v ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const orderNorm = normCode(order.id);
    const boxNorm = normCode(`BOX-${order.id}`);

    const itemRequiredCodes = (stage: "pick" | "pack", item: Order["items"][number], book: Record<string, unknown> | undefined) => {
      const req: Array<{ kind: "productCode" | "sku" | "isbn"; label: string; values: string[] }> = [];
      const prodVals = [book?.barcode, book?.productCode, book?.code].filter(Boolean).map(normCode).filter(Boolean);
      const skuVals = [item.sku, book?.sku].filter(Boolean).map(normCode).filter(Boolean);
      const isbnVals = [book?.isbn].filter(Boolean).map(normCode).filter(Boolean);
      if (stage === "pick") {
        if (prodVals.length) req.push({ kind: "productCode", label: "Product code / Barcode", values: prodVals });
        if (skuVals.length) req.push({ kind: "sku", label: "SKU", values: skuVals });
      } else {
        if (skuVals.length) req.push({ kind: "sku", label: "SKU", values: skuVals });
        if (isbnVals.length) req.push({ kind: "isbn", label: "ISBN", values: isbnVals });
        if (!req.length && prodVals.length) req.push({ kind: "productCode", label: "Product code", values: prodVals });
      }
      return req;
    };

    if (sub === "claim-pick") {
      const pick = order.pick ?? {
        assignee: me,
        assignedAt: at,
        acceptedAt: at,
        picked: {},
        pickCodes: {},
        packScan: {},
        packCodes: {},
      };
      const updated = patchShopOrder(orderId, {
        status: order.status === "Paid" || order.status === "Ordered" ? "Processing" : order.status,
        pick: { ...pick, assignee: pick.assignee || me, acceptedAt: pick.acceptedAt || at },
        history: [...(order.history ?? []), { at, status: order.status, by, note: `Picked up in Scanner app by ${by}` }],
      });
      return json({ ok: true, order: updated ? enrichOrder(updated) : undefined });
    }

    if (sub === "upload-pick-photo") {
      const dataUrl = String(body?.dataUrl ?? "").trim();
      const filename = String(body?.filename ?? `pick-${orderId}.jpg`).trim();
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return json({ ok: false, error: "Capture or choose a photo of the picked book(s) first." }, 400);
      const mime = match[1];
      const bytes = Buffer.from(match[2], "base64");
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
        return json({ ok: false, error: "Photo must be under 10 MB." }, 400);
      }
      const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
      const safeName = filename.includes(".") ? filename : `pick-${orderId}${ext}`;
      const stored = await storeUploadedFile(new File([bytes], safeName, { type: mime }));
      const nextPhotos = [...((order as unknown as { pickPhotos?: Array<{ url: string; at: string; by: string; byName?: string }> }).pickPhotos ?? []), { url: stored.url, at, by: session.email, byName: by }];
      const updated = patchShopOrder(orderId, {
        pickPhotos: nextPhotos,
        history: [...(order.history ?? []), { at, status: order.status, by, note: `Picked book photo uploaded via Scanner app (${nextPhotos.length})` }],
      } as Partial<Order>);
      return json({ ok: true, order: updated ? enrichOrder(updated) : undefined });
    }

    if (sub === "upload-pack-photo") {
      const dataUrl = String(body?.dataUrl ?? "").trim();
      const filename = String(body?.filename ?? `pack-${orderId}.jpg`).trim();
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return json({ ok: false, error: "Capture or choose a packing photo first." }, 400);
      const mime = match[1];
      const bytes = Buffer.from(match[2], "base64");
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
        return json({ ok: false, error: "Photo must be under 10 MB." }, 400);
      }
      const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
      const safeName = filename.includes(".") ? filename : `pack-${orderId}${ext}`;
      const stored = await storeUploadedFile(new File([bytes], safeName, { type: mime }));
      const nextPhotos = [...(order.packPhotos ?? []), { url: stored.url, at, by: session.email, byName: by }];
      const updated = patchShopOrder(orderId, {
        packPhotos: nextPhotos,
        history: [...(order.history ?? []), { at, status: order.status, by, note: `Packing photo uploaded via Scanner app (${nextPhotos.length})` }],
      });
      return json({ ok: true, order: updated ? enrichOrder(updated) : undefined });
    }

    if (sub === "pick-scan") {
      const rawCode = String(body?.code ?? "").trim();
      const cNorm = normCode(rawCode);
      if (!cNorm) return json({ ok: false, error: "Scan a barcode or QR code first." }, 400);
      const pick = order.pick ?? { assignee: me, assignedAt: at, acceptedAt: at, picked: {}, pickCodes: {}, packScan: {}, packCodes: {} };

      // Picker Step 1 (MANDATORY): Scan Order Code (e.g. 589923966850) first!
      if (!pick.pickOrderScannedAt) {
        if (cNorm === orderNorm || (cNorm.includes(orderNorm) && !cNorm.startsWith("BOX"))) {
          const updated = patchShopOrder(orderId, {
            pick: { ...pick, assignee: pick.assignee || me, acceptedAt: pick.acceptedAt || at, pickOrderScannedAt: at },
          });
          return json({ ok: true, orderQrMatched: true, stepMessage: `Picker Step 1 OK: Order #${order.id} verified. Now scan each item's Product Code & SKU.`, order: updated ? enrichOrder(updated) : undefined });
        }
        return json({ ok: false, error: `Picker Step 1 required: Scan Order Code "${order.id}" first before scanning items.` }, 400);
      }

      // Picker Step 2 (MANDATORY): Scan each item's Product Code AND SKU
      const picked = { ...(pick.picked ?? {}) };
      const pickCodes: Record<string, string[]> = { ...(pick.pickCodes ?? {}) };
      let matchedItem: Order["items"][number] | null = null;
      let matchedLabel = "";

      for (const row of order.items) {
        const book = books.find((b) => String(b.id) === row.bookId);
        const reqs = itemRequiredCodes("pick", row, book);
        const had = new Set(pickCodes[row.bookId] ?? []);
        const count = picked[row.bookId] || 0;
        const primary = reqs[0];
        // Match secondary required code (e.g. SKU) if not yet scanned
        const secondaryMatch = reqs.slice(1).find((r) => !had.has(r.kind) && r.values.some((v) => v === cNorm || cNorm.includes(v)));
        if (secondaryMatch) {
          had.add(secondaryMatch.kind);
          pickCodes[row.bookId] = [...had];
          matchedItem = row;
          matchedLabel = `${row.title} · ${secondaryMatch.label} verified`;
          break;
        }
        // Match primary code (Product code / Barcode) to count units
        if (count < row.quantity && ((primary && primary.values.some((v) => v === cNorm || cNorm.includes(v))) || (!primary && bookCodesMatch(book, row, rawCode)))) {
          picked[row.bookId] = count + 1;
          if (primary) {
            had.add(primary.kind);
            pickCodes[row.bookId] = [...had];
          }
          matchedItem = row;
          matchedLabel = `${row.title} (${picked[row.bookId]}/${row.quantity})${primary ? ` · ${primary.label}` : ""}`;
          break;
        }
      }

      if (!matchedItem) {
        return json({ ok: false, error: `Code "${rawCode}" did not match any remaining item Product Code or SKU in order #${orderId}.` }, 400);
      }

      const allPicked = order.items.every((row) => {
        const book = books.find((b) => String(b.id) === row.bookId);
        const reqs = itemRequiredCodes("pick", row, book);
        const had = pickCodes[row.bookId] ?? [];
        return (picked[row.bookId] || 0) >= row.quantity && reqs.every((r) => had.includes(r.kind));
      });

      const hasPickPhoto = Boolean((order as unknown as { pickPhotos?: unknown[] }).pickPhotos?.length);
      const readyToAutoComplete = allPicked && hasPickPhoto;
      const nextPick = { ...pick, picked, pickCodes, ...(readyToAutoComplete ? { pickedAt: at } : {}) };
      const updated = patchShopOrder(orderId, {
        pick: nextPick,
        history: readyToAutoComplete
          ? [...(order.history ?? []), { at, status: order.status, by, note: `All items picked, photographed & verified via Scanner app by ${by}` }]
          : order.history,
      });
      return json({
        ok: true,
        allPicked: readyToAutoComplete,
        stepMessage: allPicked && !hasPickPhoto ? "All item codes verified! Mandatory Step 3: Take a picture of the picked book(s) to finish Pick." : undefined,
        matchedTitle: matchedLabel,
        order: updated ? enrichOrder(updated) : undefined,
      });
    }

    if (sub === "complete-pick") {
      const pick = order.pick;
      if (!pick?.pickOrderScannedAt) {
        return json({ ok: false, error: `Mandatory: Scan Order Code "${order.id}" first.` }, 400);
      }
      const missing: string[] = [];
      for (const row of order.items) {
        const book = books.find((b) => String(b.id) === row.bookId);
        const reqs = itemRequiredCodes("pick", row, book);
        const count = pick.picked?.[row.bookId] || 0;
        const had = pick.pickCodes?.[row.bookId] ?? [];
        if (count < row.quantity) missing.push(`${row.title}: ${row.quantity - count} more unit(s)`);
        for (const r of reqs) {
          if (!had.includes(r.kind)) missing.push(`${row.title}: scan ${r.label}`);
        }
      }
      if (missing.length) {
        return json({ ok: false, error: `Cannot finish pick — missing mandatory scans: ${missing.join(" · ")}` }, 400);
      }
      if (!((order as unknown as { pickPhotos?: unknown[] }).pickPhotos?.length)) {
        return json({ ok: false, error: "Mandatory Step 3: Click and upload a picture of the picked book(s) before completing pick." }, 400);
      }
      const updated = patchShopOrder(orderId, {
        pick: { ...pick, pickedAt: at },
        history: [...(order.history ?? []), { at, status: order.status, by, note: `Picking completed & verified via Scanner app by ${by}` }],
      });
      return json({ ok: true, order: updated ? enrichOrder(updated) : undefined });
    }

    if (sub === "pack-scan") {
      const rawCode = String(body?.code ?? "").trim();
      const cNorm = normCode(rawCode);
      if (!cNorm) return json({ ok: false, error: "Scan a barcode or QR code first." }, 400);
      const pick = order.pick ?? { assignee: me, assignedAt: at, acceptedAt: at, picked: {}, pickedAt: at, packScan: {}, packCodes: {} };

      // Packer Step 1 (MANDATORY): Scan Box Code (BOX-<orderId>)
      if (!pick.boxScannedAt) {
        if (cNorm === boxNorm || cNorm.includes(boxNorm)) {
          const updated = patchShopOrder(orderId, {
            pick: { ...pick, boxScannedAt: at, packer: pick.packer || me },
          });
          return json({ ok: true, boxMatched: true, stepMessage: `Packer Step 1 OK: Box BOX-${order.id} verified! Next, scan Order Code ${order.id}.`, order: updated ? enrichOrder(updated) : undefined });
        }
        return json({ ok: false, error: `Packer Step 1 required: Scan Box Code "BOX-${order.id}" first.` }, 400);
      }

      // Packer Step 2 (MANDATORY): Scan Order Code (<orderId>)
      if (!pick.orderScannedAt) {
        if (cNorm === orderNorm || (cNorm.includes(orderNorm) && !cNorm.startsWith("BOX"))) {
          const updated = patchShopOrder(orderId, {
            pick: { ...pick, orderScannedAt: at, packer: pick.packer || me },
          });
          return json({ ok: true, orderQrMatched: true, stepMessage: `Packer Step 2 OK: Order #${order.id} verified! Now scan each item's SKU (and ISBN for books).`, order: updated ? enrichOrder(updated) : undefined });
        }
        return json({ ok: false, error: `Packer Step 2 required: Scan Order Code "${order.id}" before scanning items.` }, 400);
      }

      // Packer Step 3 (MANDATORY): Scan each item's SKU (and ISBN for books)
      const packScan = { ...(pick.packScan ?? {}) };
      const packCodes: Record<string, string[]> = { ...(pick.packCodes ?? {}) };
      let matchedItem: Order["items"][number] | null = null;
      let matchedLabel = "";

      for (const row of order.items) {
        const book = books.find((b) => String(b.id) === row.bookId);
        const reqs = itemRequiredCodes("pack", row, book);
        const had = new Set(packCodes[row.bookId] ?? []);
        const count = packScan[row.bookId] || 0;
        const primary = reqs[0];
        const secondaryMatch = reqs.slice(1).find((r) => !had.has(r.kind) && r.values.some((v) => v === cNorm || cNorm.includes(v)));
        if (secondaryMatch) {
          had.add(secondaryMatch.kind);
          packCodes[row.bookId] = [...had];
          matchedItem = row;
          matchedLabel = `${row.title} · ${secondaryMatch.label} verified`;
          break;
        }
        if (count < row.quantity && ((primary && primary.values.some((v) => v === cNorm || cNorm.includes(v))) || (!primary && bookCodesMatch(book, row, rawCode)))) {
          packScan[row.bookId] = count + 1;
          if (primary) {
            had.add(primary.kind);
            packCodes[row.bookId] = [...had];
          }
          matchedItem = row;
          matchedLabel = `${row.title} (${packScan[row.bookId]}/${row.quantity})${primary ? ` · ${primary.label}` : ""}`;
          break;
        }
      }

      if (!matchedItem) {
        return json({ ok: false, error: `Code "${rawCode}" did not match any remaining item SKU or ISBN in order #${orderId}.` }, 400);
      }

      const updated = patchShopOrder(orderId, {
        pick: { ...pick, packScan, packCodes, packer: pick.packer || me },
      });
      return json({ ok: true, matchedTitle: matchedLabel, order: updated ? enrichOrder(updated) : undefined });
    }

    if (sub === "complete-pack") {
      const pick = order.pick;
      const confirmMatched = Boolean(body?.confirmMatched);
      if (!pick?.boxScannedAt) {
        return json({ ok: false, error: `Mandatory Step 1: Scan Box Code "BOX-${order.id}" first.` }, 400);
      }
      if (!pick?.orderScannedAt) {
        return json({ ok: false, error: `Mandatory Step 2: Scan Order Code "${order.id}" first.` }, 400);
      }
      const missing: string[] = [];
      for (const row of order.items) {
        const book = books.find((b) => String(b.id) === row.bookId);
        const reqs = itemRequiredCodes("pack", row, book);
        const count = pick.packScan?.[row.bookId] || 0;
        const had = pick.packCodes?.[row.bookId] ?? [];
        if (count < row.quantity) missing.push(`${row.title}: ${row.quantity - count} more unit(s)`);
        for (const r of reqs) {
          if (!had.includes(r.kind)) missing.push(`${row.title}: scan ${r.label}`);
        }
      }
      if (missing.length) {
        return json({ ok: false, error: `Mandatory Step 3 incomplete: ${missing.join(" · ")}` }, 400);
      }
      if (!order.packPhotos?.length) {
        return json({ ok: false, error: "Mandatory Step 4: Upload at least 1 packing photo of the items/sealed parcel before completing pack." }, 400);
      }
      if (!confirmMatched) {
        return json({ ok: false, error: "Mandatory Step 5: Tick 'Confirm items match packaging slip' before finishing pack." }, 400);
      }
      const updated = patchShopOrder(orderId, {
        status: "Packed",
        pick: { ...pick, packer: pick.packer || me, matchedAt: at, packedAt: at },
        history: [...(order.history ?? []), { at, status: "Packed", by, note: `Packed, photographed & verified via Scanner app by ${by}` }],
      });
      return json({ ok: true, order: updated ? enrichOrder(updated) : undefined });
    }

    return json({ ok: false, error: "Unknown pick/pack action." }, 400);
  }

  if (action === "scan-lookup") {
    const code = String(body?.code ?? "").trim();
    if (!code) return json({ ok: false, error: "Enter or scan a code." }, 400);
    const directOrder = findShopOrder(code) || listShopOrders().find((o) => o.trackingId?.toLowerCase() === code.toLowerCase() || code.includes(o.id));
    if (directOrder) return json({ ok: true, kind: "order", order: enrichOrder(directOrder) });
    const books = (readMobileFeed().books ?? []) as unknown as Record<string, unknown>[];
    const matchedBook = books.find((b) =>
      [b.id, b.sku, b.isbn, b.barcode, b.code, b.productCode, b.slug]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase() === code.toLowerCase() || code.toLowerCase().includes(String(v).toLowerCase()))
    );
    if (matchedBook) return json({ ok: true, kind: "book", book: matchedBook });
    return json({ ok: false, error: `No order, AWB, or publication matched "${code}".` }, 404);
  }

  if (action === "pos-catalog") {
    const feed = readMobileFeed();
    const rawBooks = (feed.books ?? []) as unknown as Record<string, unknown>[];
    const books = rawBooks.map((b) => ({
      ...b,
      isPreorderable: feedPreorderable(b as never),
    }));
    let rawCustomers: Record<string, unknown>[] = [];
    try {
      const parsed = JSON.parse(readFileSync(dataFile("foundation-accounts.json"), "utf8"));
      if (Array.isArray(parsed)) rawCustomers = parsed as Record<string, unknown>[];
    } catch {
      /* fallback to recent order customers */
    }
    const seen = new Set<string>();
    const customers: { id: string; name: string; email: string; phone: string }[] = [];
    for (const c of rawCustomers) {
      const email = String(c.email || "").trim().toLowerCase();
      const phone = String(c.phone || "").trim();
      const key = email || phone;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      customers.push({
        id: String(c.id || key),
        name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || String(c.name || email || "Customer"),
        email,
        phone,
      });
      if (customers.length >= 250) break;
    }
    for (const o of listShopOrders()) {
      const email = String(o.deliveryAddress?.email || o.accountEmail || "").trim().toLowerCase();
      const phone = String(o.deliveryAddress?.phone || "").trim();
      const key = email || phone;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      customers.push({
        id: key,
        name: String(o.deliveryAddress?.fullName || email || "Customer"),
        email,
        phone,
      });
      if (customers.length >= 300) break;
    }
    const orderSettings = publicOrderSettings(feed.orderSettings as Partial<OrderSettings> | undefined);
    const rzpCfg = (savedAdminIntegrations().razorpay ?? {}) as Record<string, unknown>;
    return json({
      ok: true,
      books,
      customers,
      site: feed.site,
      orderSettings,
      razorpayConfigured: Boolean(razorpayCreds({})),
      razorpayEdcConfigured: Boolean(rzpCfg.posDeviceId),
    });
  }

  if (action === "pos-razorpay-start") {
    const creds = razorpayCreds({});
    if (!creds) return json({ ok: false, error: "Razorpay is not configured on this server." }, 503);
    const amount = Math.round(Number(body?.amount || 0) * 100) / 100;
    if (!(amount > 0)) return json({ ok: false, error: "Enter an amount greater than ₹0." }, 400);
    const receipt = String(body?.receipt || `POS-${newOrderId().slice(-8)}`).slice(0, 40);
    try {
      const created = await razorpayOrder(creds, amount, receipt);
      return json({ ok: true, keyId: created.keyId, razorpayOrderId: created.orderId, amount, receipt });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message || "Could not create Razorpay order." }, 502);
    }
  }

  if (action === "pos-razorpay-link") {
    const creds = razorpayCreds({});
    if (!creds) return json({ ok: false, error: "Razorpay is not configured on this server." }, 503);
    const amount = Math.round(Number(body?.amount || 0) * 100) / 100;
    if (!(amount > 0)) return json({ ok: false, error: "Enter an amount greater than ₹0." }, 400);
    const receipt = String(body?.receipt || `POS-${newOrderId().slice(-8)}`).slice(0, 40);
    try {
      const link = await razorpayLink(creds, {
        amount,
        orderId: receipt,
        name: String(body?.customerName || "Walk-in Customer").slice(0, 80),
        email: body?.customerEmail ? String(body.customerEmail) : undefined,
        phone: body?.customerPhone ? String(body.customerPhone) : undefined,
        description: String(body?.description || `VGMF Store POS ${receipt}`),
        expiryMinutes: 60,
      });
      return json({ ok: true, linkId: link.id, url: link.url, status: link.status, amount, receipt });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message || "Could not create Razorpay payment link." }, 502);
    }
  }

  if (action === "pos-razorpay-link-check") {
    const creds = razorpayCreds({});
    if (!creds) return json({ ok: false, error: "Razorpay is not configured." }, 503);
    const linkId = String(body?.linkId || "").trim();
    if (!linkId) return json({ ok: false, error: "Send linkId." }, 400);
    try {
      const res = await razorpayLinkStatus(creds, linkId);
      return json({ ok: true, paid: res.status === "paid", status: res.status, paymentId: res.paymentId || "" });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message || "Could not check payment link." }, 502);
    }
  }

  if (action === "pos-edc-start") {
    const creds = razorpayCreds({});
    if (!creds) return json({ ok: false, error: "Razorpay is not configured." }, 503);
    const rzpCfg = (savedAdminIntegrations().razorpay ?? {}) as Record<string, unknown>;
    const deviceId = String(rzpCfg.posDeviceId || "").trim();
    const deviceMode = rzpCfg.posDeviceMode === "wired" ? "wired" : "wireless";
    const amount = Math.round(Number(body?.amount || 0) * 100) / 100;
    if (!(amount > 0)) return json({ ok: false, error: "Enter an amount greater than ₹0." }, 400);
    const receipt = String(body?.receipt || `POS-${newOrderId().slice(-8)}`).slice(0, 40);
    try {
      const order = await razorpayOrder(creds, amount, receipt, deviceMode);
      const activity = await razorpayDeviceActivity(creds, {
        action: "initiate_checkout",
        deviceMode,
        deviceId: deviceId || undefined,
        amountRupees: amount,
        orderId: order.orderId,
        name: String(body?.customerName || "Walk-in Customer"),
        email: body?.customerEmail ? String(body.customerEmail) : undefined,
        phone: body?.customerPhone ? String(body.customerPhone) : undefined,
        method: body?.edcMethod === "upi" ? "upi" : "card",
        description: `VGMF Store POS ${receipt}`,
      });
      if (activity.status === "failed") {
        return json({ ok: false, error: activity.error || "Razorpay EDC rejected the payment request." }, 502);
      }
      return json({ ok: true, razorpayOrderId: order.orderId, activityId: activity.activityId || "", status: activity.status, deviceMode });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message || "Could not reach Razorpay EDC terminal." }, 502);
    }
  }

  if (action === "pos-edc-status") {
    const creds = razorpayCreds({});
    if (!creds) return json({ ok: false, error: "Razorpay is not configured." }, 503);
    const rzpCfg = (savedAdminIntegrations().razorpay ?? {}) as Record<string, unknown>;
    const deviceMode = rzpCfg.posDeviceMode === "wired" ? "wired" : "wireless";
    const activityId = String(body?.activityId || "").trim();
    const orderId = String(body?.razorpayOrderId || "").trim();
    try {
      const activity = activityId ? await razorpayDeviceActivityStatus(creds, activityId, deviceMode) : { status: "", error: undefined };
      const payments = orderId ? await razorpayOrderPayments(creds, orderId, deviceMode) : { status: "", paymentId: undefined, method: undefined };
      const paid = payments.status === "paid" || Boolean(payments.paymentId);
      const failed = activity.status === "failed";
      return json({
        ok: true,
        paid,
        failed,
        pending: !paid && !failed,
        paymentId: payments.paymentId || "",
        method: payments.method || "Razorpay EDC",
        error: failed ? activity.error : undefined,
      });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message || "Could not poll EDC terminal." }, 502);
    }
  }

  if (action === "pos-create-order") {
    const rawItems = Array.isArray(body?.items) ? (body.items as { id?: string; bookId?: string; quantity?: number; price?: number }[]) : [];
    if (!rawItems.length) return json({ ok: false, error: "Add at least one item to the POS bill." }, 400);
    const feed = readMobileFeed();
    const books = (feed.books ?? []) as unknown as Record<string, unknown>[];
    const settings = publicOrderSettings(feed.orderSettings as Partial<OrderSettings> | undefined);
    const requestedType = String(body?.orderType || "normal").toLowerCase();
    const items: Order["items"] = [];
    for (const row of rawItems) {
      const id = String(row.bookId || row.id || "").trim();
      const book = books.find((b) => String(b.id) === id || String(b.slug) === id);
      if (!book) return json({ ok: false, error: `Item ${id} was not found in the catalogue.` }, 400);
      const qty = Math.max(1, Math.min(200, Math.floor(Number(row.quantity) || 1)));
      const unitPrice = row.price !== undefined && Number(row.price) >= 0 ? Math.round(Number(row.price) * 100) / 100 : Number(book.price || 0);
      const isPreorderItem = requestedType === "preorder" || feedPreorderable(book as never);
      items.push({
        bookId: String(book.id),
        title: String(book.title || "VGMF Item"),
        quantity: qty,
        price: unitPrice,
        currency: "INR",
        sku: book.sku ? String(book.sku) : undefined,
        batchNo: book.batchNo ? String(book.batchNo) : undefined,
        preorder: isPreorderItem || undefined,
      });
    }
    const isPreorder = requestedType === "preorder" || items.some((i) => i.preorder);
    const deliveryMode: "delivery" | "store_pickup" = body?.deliveryMode === "delivery" ? "delivery" : "store_pickup";
    const subtotal = items.reduce((s, item) => s + item.price * item.quantity, 0);
    const discount = Math.max(0, Math.min(subtotal, Math.round(Number(body?.discount || 0) * 100) / 100));
    const shippingDue = deliveryMode === "delivery" && (body?.shippingDue === true || (isPreorder && !(Number(body?.shipping) > 0)));
    const shipping = deliveryMode === "delivery" && !shippingDue ? Math.max(0, Math.round(Number(body?.shipping || 0) * 100) / 100) : 0;
    const total = Math.max(0, Math.round((subtotal - discount + shipping) * 100) / 100);
    const requestedPayNow = body?.payNow !== undefined ? Math.round(Number(body.payNow) * 100) / 100 : total;
    const payNow = Math.max(1, Math.min(total, Number.isFinite(requestedPayNow) && requestedPayNow > 0 ? requestedPayNow : total));
    const balance = Math.max(0, Math.round((total - payNow) * 100) / 100);

    const method = String(body?.paymentMethod || "Cash at Store").trim();
    let paymentRef = String(body?.paymentRef || "").trim();
    let razorpayOrderId = String(body?.razorpayOrderId || "").trim() || undefined;
    let razorpayPaymentId = String(body?.razorpayPaymentId || "").trim() || undefined;
    const razorpaySignature = String(body?.razorpaySignature || "").trim();

    // Cryptographically verify Razorpay UPI / Online checkout BEFORE recording the order!
    if (method === "Razorpay UPI") {
      const creds = razorpayCreds({});
      if (!creds) return json({ ok: false, error: "Razorpay is not configured on this server." }, 503);
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return json({ ok: false, error: "Complete Razorpay UPI payment before recording this sale." }, 400);
      }
      if (!razorpayVerify(creds.keySecret, razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
        return json({ ok: false, error: "Razorpay payment signature could not be verified." }, 400);
      }
      paymentRef = razorpayPaymentId;
    } else if (method === "Razorpay Pay Link") {
      const creds = razorpayCreds({});
      const linkId = String(body?.paymentLinkId || "").trim();
      if (!creds || !linkId) return json({ ok: false, error: "Create and verify the Razorpay payment link first." }, 400);
      const st = await razorpayLinkStatus(creds, linkId);
      if (st.status !== "paid") {
        return json({ ok: false, error: "Payment link is not paid yet. Ask the customer to complete payment, then tap Verify." }, 400);
      }
      razorpayPaymentId = st.paymentId || linkId;
      paymentRef = razorpayPaymentId;
    }

    const customerName = String(body?.customerName || "Walk-in Customer").trim().slice(0, 100);
    const customerPhone = String(body?.customerPhone || "").trim().slice(0, 24);
    const customerEmail = String(body?.customerEmail || "").trim().toLowerCase().slice(0, 120);
    const rawAddr = (body?.address ?? {}) as Record<string, unknown>;
    const deliveryAddress =
      deliveryMode === "delivery"
        ? {
            fullName: customerName,
            phone: customerPhone,
            email: customerEmail || undefined,
            line1: String(rawAddr.line1 || "").trim().slice(0, 180) || "Delivery address",
            landmark: String(rawAddr.landmark || "").trim().slice(0, 120) || undefined,
            city: String(rawAddr.city || "").trim().slice(0, 80) || "Pune",
            state: String(rawAddr.state || "").trim().slice(0, 80) || "Maharashtra",
            pincode: String(rawAddr.pincode || "").trim().slice(0, 12) || "411030",
            country: "India",
            countryCode: "IN",
          }
        : {
            fullName: customerName,
            phone: customerPhone,
            email: customerEmail || undefined,
            line1: "VGMF Store Counter",
            city: "Pune",
            state: "Maharashtra",
            pincode: "411030",
            country: "India",
            countryCode: "IN",
          };

    const now = new Date().toISOString();
    const id = newOrderId();
    const by = session.name || session.email;
    const isPartial = balance > 0 || (isPreorder && shippingDue);
    const status: Order["status"] = isPreorder || deliveryMode === "delivery" ? "Paid" : "Delivered";
    const noteText = isPreorder
      ? `POS pre-order · advance ₹${payNow} paid via ${method}${balance > 0 ? ` · balance ₹${balance} due when ready` : ""}${shippingDue ? " · courier charge added once packed" : ""}`
      : isPartial
        ? `POS counter order · partial payment ₹${payNow} via ${method} · balance ₹${balance} due`
        : `POS counter sale completed via ${method}${paymentRef ? ` (${paymentRef})` : ""} · ₹${total}`;

    const order: Order = {
      id,
      userId: customerEmail || "pos-walkin",
      accountEmail: customerEmail || undefined,
      date: now,
      items,
      subtotal,
      discount,
      gst: 0,
      shipping,
      shippingDue: shippingDue || undefined,
      total,
      currency: "INR",
      paymentStatus: isPartial ? "Partially Paid" : "Paid",
      amountPaid: payNow,
      status,
      channel: "pos",
      deliveryMode,
      deliveryAddress,
      paymentMethod: method,
      paymentRef: paymentRef || undefined,
      razorpayOrderId,
      razorpayPaymentId,
      paidAt: now,
      preorderPayment:
        isPreorder && (balance > 0 || shippingDue)
          ? {
              advance: payNow,
              balance,
              balanceWhen: settings.preorderPayment.balanceWhen,
              advancePaidAt: now,
              shippingDue: shippingDue || undefined,
            }
          : undefined,
      createdBy: `Store POS App (${by})`,
      history: [{ at: now, status, by, note: noteText }],
    };
    const saved = upsertShopOrder(order) ?? order;
    return json({ ok: true, order: enrichOrder(saved) });
  }


  if (action === "whatsapp-threads") {
    const { listWhatsAppThreads } = await import("@/lib/server/whatsapp-inbox");
    return json({ ok: true, threads: listWhatsAppThreads().slice(0, 80) });
  }

  if (action === "whatsapp-action") {
    const {
      addWhatsAppInternalNote,
      closeWhatsApp,
      markWhatsAppRead,
      replyOnWhatsApp,
      sendOrderingFlowFromDesk,
      startNewWhatsAppChat,
    } = await import("@/lib/server/whatsapp-inbox");
    const sub = String(body?.sub ?? "reply").trim();
    const threadId = String(body?.threadId ?? "").trim();
    const byName = session.name || session.email;
    try {
      if (sub === "read") return json({ ok: true, thread: markWhatsAppRead(threadId) });
      if (sub === "reply") return json({ ok: true, thread: await replyOnWhatsApp(threadId, String(body?.text ?? ""), session.email) });
      if (sub === "note") return json({ ok: true, thread: addWhatsAppInternalNote(threadId, String(body?.text ?? ""), byName) });
      if (sub === "send-flow") return json({ ok: true, thread: await sendOrderingFlowFromDesk(threadId, byName) });
      if (sub === "close") return json({ ok: true, ...(await closeWhatsApp(threadId, byName, session.email)) });
      if (sub === "start") {
        const thread = await startNewWhatsAppChat({
          phone: String(body?.phone ?? ""),
          name: String(body?.name ?? ""),
          text: String(body?.text ?? ""),
          sendFlow: Boolean(body?.sendFlow),
          by: byName,
        });
        return json({ ok: true, thread });
      }
      return json({ ok: false, error: "Unknown whatsapp action." }, 400);
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 400);
    }
  }

  if (action === "livechat-threads") {
    const { listChatThreads } = await import("@/lib/server/live-chat-store");
    return json({ ok: true, threads: listChatThreads({ staff: true }).slice(0, 80) });
  }

  if (action === "livechat-action") {
    const { closeChatThread, postLiveMessage, setChatTyping, takeChatThread } = await import("@/lib/server/live-chat-store");
    const sub = String(body?.sub ?? "reply").trim();
    const threadId = String(body?.threadId ?? "").trim();
    const byName = session.name || session.email;
    if (sub === "typing") {
      return json({
        ok: true,
        thread: setChatTyping({
          threadId,
          from: "staff",
          name: byName,
          typing: body?.typing !== false,
          preview: String(body?.preview ?? ""),
        }),
      });
    }
    if (sub === "take") return json({ ok: true, thread: takeChatThread(threadId, session.email, byName) });
    if (sub === "close") return json({ ok: true, thread: closeChatThread(threadId, byName) });
    if (sub === "reply") {
      return json({
        ok: true,
        thread: postLiveMessage({
          threadId,
          from: "staff",
          name: byName,
          text: String(body?.text ?? ""),
        }),
      });
    }
    return json({ ok: false, error: "Unknown livechat action." }, 400);
  }

  if (action === "tickets") {
    const list = allTickets();
    return json({ ok: true, tickets: list.slice(0, 80) });
  }

  if (action === "ticket-reply") {
    const id = String(body?.ticketId ?? "").trim();
    const text = String(body?.text ?? "").trim();
    const status = typeof body?.status === "string" ? body.status.trim() : "";
    const existing = findTicket(id);
    if (!existing) return json({ ok: false, error: "Ticket not found." }, 404);
    let updated = existing;
    if (text) {
      updated = replyToTicket(id, session.name || session.email, text) ?? updated;
    }
    if (status && ["Open", "In Progress", "Resolved", "Closed"].includes(status)) {
      updated = saveTicket({ ...updated, status: status as typeof updated.status, updatedAt: new Date().toISOString() });
    }
    return json({ ok: true, ticket: updated });
  }


  // ==================== NATIVE MODULE ENGINE ====================
  if (action === "staff-context") {
    const accounts = readJson<Array<Record<string, unknown>>>(dataFile("foundation-accounts.json"), []);
    const me = accounts.find((a) => String(a.email || "").toLowerCase() === session.email.toLowerCase()) || {
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
      name: session.name,
      phone: (session as { phone?: string }).phone,
      role: session.role,
      staffRoleId: session.staffRoleId || "general-staff",
      replyToEmail: "care@vaidyagogate.org",
    };
    const notices = readJson<Array<Record<string, unknown>>>(dataFile("notices.json"), []);
    return json({
      ok: true,
      profile: {
        firstName: String(me.firstName || session.firstName || ""),
        lastName: String(me.lastName || session.lastName || ""),
        email: String(me.email || session.email || ""),
        phone: String(me.phone || (session as { phone?: string }).phone || ""),
        role: String(me.role || session.role || "staff"),
        staffRoleId: String(me.staffRoleId || session.staffRoleId || "general-staff"),
        replyToEmail: String(me.replyToEmail || "care@vaidyagogate.org"),
      },
      notifications: notices.slice(0, 25),
    });
  }

  if (action === "staff-profile-save") {
    const accountsFile = dataFile("foundation-accounts.json");
    const accounts = readJson<Array<Record<string, unknown>>>(accountsFile, []);
    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const replyToEmail = String(body?.replyToEmail ?? "care@vaidyagogate.org").trim();
    let found = false;
    const next = accounts.map((a) => {
      if (String(a.email || "").toLowerCase() === session.email.toLowerCase()) {
        found = true;
        return {
          ...a,
          firstName: firstName || a.firstName,
          lastName: lastName || a.lastName,
          phone: phone || a.phone,
          whatsapp: phone || a.whatsapp,
          replyToEmail: replyToEmail || "care@vaidyagogate.org",
        };
      }
      return a;
    });
    if (found) writeJson(accountsFile, next);
    return json({ ok: true, message: "Staff profile saved to production." });
  }

  if (action === "module-load") {
    const href = String(body?.href ?? "/admin/settings").trim();
    const feedFile = dataFile("app-feed.json");
    const integFile = dataFile("admin-integrations.json");
    const feed = readJson<Record<string, any>>(feedFile, {});
    const integ = readJson<Record<string, any>>(integFile, { settings: {} });
    const settings = (integ.settings ?? {}) as Record<string, any>;
    const allOrders = listShopOrders();
    const shipments = listShopShipments();

    // Return tailored native schema & live data for every single /admin/* and /staff/* path
    if (href === "/admin/settings") {
      return json({
        ok: true,
        kind: "form",
        title: "General & Maintenance",
        subtitle: "Foundation identity, contact details, shloka ticker and maintenance mode",
        target: "feed.site",
        fields: [
          { key: "name", label: "Foundation Name", type: "text", value: feed.site?.name ?? "Vaidya Gogate Memorial Foundation" },
          { key: "tagline", label: "Site & Footer Tagline", type: "text", value: feed.site?.tagline ?? "" },
          { key: "email", label: "Official Contact Email", type: "text", value: feed.site?.email ?? "" },
          { key: "phone", label: "Official Phone Number", type: "text", value: feed.site?.phone ?? "" },
          { key: "address", label: "Foundation Address", type: "multiline", value: feed.site?.address ?? "" },
          { key: "queryNumber", label: "WhatsApp Query Number", type: "text", value: feed.site?.queryNumber ?? "" },
          { key: "queryMessage", label: "Default WhatsApp Message", type: "text", value: feed.site?.queryMessage ?? "" },
          { key: "shlokaBar", label: "Show Top Shloka Ticker Bar", type: "boolean", value: Boolean(feed.site?.shlokaBar) },
          { key: "liveChat", label: "Enable Public Live Help Chat", type: "boolean", value: feed.site?.liveChat !== false },
          { key: "maintenanceMode", label: "Maintenance Mode (Pause Public Site)", type: "boolean", value: Boolean(feed.site?.maintenanceMode) },
          { key: "maintenanceMessage", label: "Maintenance Message", type: "multiline", value: feed.site?.maintenanceMessage ?? "" },
        ],
      });
    }

    if (href === "/admin/settings/payments") {
      const rzp = settings.razorpay ?? {};
      const payu = settings.payu ?? {};
      const cf = settings.cashfree ?? {};
      const eb = settings.easebuzz ?? {};
      return json({
        ok: true,
        kind: "form",
        title: "Payments & Razorpay",
        subtitle: "Live payment gateway keys for checkout, pre-orders, balance links and Store POS UPI QR",
        target: "integ.payments",
        fields: [
          { key: "razorpay.enabled", label: "Razorpay Enabled", type: "boolean", value: rzp.enabled !== false },
          { key: "razorpay.keyId", label: "Razorpay Key ID", type: "text", value: rzp.keyId ?? "" },
          { key: "razorpay.keySecret", label: "Razorpay Key Secret", type: "text", value: rzp.keySecret ?? "" },
          { key: "razorpay.webhookSecret", label: "Razorpay Webhook Secret", type: "text", value: rzp.webhookSecret ?? "" },
          { key: "payu.enabled", label: "PayU Enabled", type: "boolean", value: Boolean(payu.enabled) },
          { key: "payu.key", label: "PayU Merchant Key", type: "text", value: payu.key ?? "" },
          { key: "payu.salt", label: "PayU Merchant Salt", type: "text", value: payu.salt ?? "" },
          { key: "cashfree.enabled", label: "Cashfree Enabled", type: "boolean", value: Boolean(cf.enabled) },
          { key: "cashfree.appId", label: "Cashfree App ID", type: "text", value: cf.appId ?? "" },
          { key: "cashfree.secretKey", label: "Cashfree Secret Key", type: "text", value: cf.secretKey ?? "" },
          { key: "easebuzz.enabled", label: "Easebuzz Enabled", type: "boolean", value: Boolean(eb.enabled) },
          { key: "easebuzz.key", label: "Easebuzz Key", type: "text", value: eb.key ?? "" },
        ],
      });
    }

    if (href === "/admin/settings/email") {
      const em = settings.email ?? {};
      return json({
        ok: true,
        kind: "form",
        title: "Email: Zoho CPaaS & ZeptoMail",
        subtitle: "Transactional email provider for OTPs, invoices, order updates and balance reminders",
        target: "integ.email",
        fields: [
          { key: "enabled", label: "Email Delivery Enabled", type: "boolean", value: em.enabled !== false },
          { key: "provider", label: "Active Provider (zeptomail / smtp)", type: "text", value: em.provider ?? "zeptomail" },
          { key: "fromName", label: "Sender Name", type: "text", value: em.fromName ?? "Vaidya Gogate Memorial Foundation" },
          { key: "fromEmail", label: "Sender Email", type: "text", value: em.fromEmail ?? "noreply@vaidyagogate.org" },
          { key: "replyTo", label: "Reply-To Address", type: "text", value: em.replyTo ?? "care@vaidyagogate.org" },
          { key: "zeptoMailToken", label: "ZeptoMail Send Mail Token", type: "text", value: em.zeptoMailToken ?? "" },
          { key: "zeptoMailHost", label: "ZeptoMail API Host", type: "text", value: em.zeptoMailHost ?? "api.zeptomail.in" },
        ],
      });
    }

    if (href === "/admin/settings/whatsapp") {
      const wa = settings.whatsapp ?? {};
      return json({
        ok: true,
        kind: "form",
        title: "WhatsApp: Meta & Zoho CPaaS",
        subtitle: "Official WhatsApp Business API credentials for order updates, packed balance reminders & OTPs",
        target: "integ.whatsapp",
        fields: [
          { key: "enabled", label: "WhatsApp Notifications Enabled", type: "boolean", value: wa.enabled !== false },
          { key: "provider", label: "Provider (meta / zoho)", type: "text", value: wa.provider ?? "meta" },
          { key: "phoneNumberId", label: "Meta Phone Number ID", type: "text", value: wa.phoneNumberId ?? "" },
          { key: "wabaId", label: "WhatsApp Business Account (WABA) ID", type: "text", value: wa.wabaId ?? "" },
          { key: "accessToken", label: "Meta Permanent Access Token", type: "text", value: wa.accessToken ?? "" },
          { key: "businessNumber", label: "Business Display Number", type: "text", value: wa.businessNumber ?? "" },
          { key: "defaultLanguage", label: "Template Language Code", type: "text", value: wa.defaultLanguage ?? "en" },
        ],
      });
    }

    if (href === "/admin/settings/sms") {
      const sms = settings.sms ?? {};
      return json({
        ok: true,
        kind: "form",
        title: "SMS: MSG91",
        subtitle: "DLT-compliant SMS delivery for login OTPs and order alerts",
        target: "integ.sms",
        fields: [
          { key: "enabled", label: "MSG91 SMS Enabled", type: "boolean", value: Boolean(sms.enabled) },
          { key: "senderId", label: "DLT Sender ID (6 chars)", type: "text", value: sms.senderId ?? "" },
          { key: "msg91AuthKey", label: "MSG91 Auth Key", type: "text", value: sms.msg91AuthKey ?? "" },
          { key: "msg91TemplateId", label: "MSG91 Default Template ID", type: "text", value: sms.msg91TemplateId ?? "" },
          { key: "dltEntityId", label: "DLT Principal Entity ID", type: "text", value: sms.dltEntityId ?? "" },
        ],
      });
    }

    if (href === "/admin/settings/firebase") {
      const fb = settings.firebase ?? {};
      return json({
        ok: true,
        kind: "form",
        title: "Firebase: App Push Notifications",
        subtitle: "FCM push notification credentials for Android and iOS customer & operations apps",
        target: "integ.firebase",
        fields: [
          { key: "serviceAccountSecret", label: "Firebase Service Account JSON", type: "multiline", value: fb.serviceAccountSecret ?? "" },
          { key: "androidConfig", label: "google-services.json (Android)", type: "multiline", value: fb.androidConfig ?? "" },
          { key: "iosConfig", label: "GoogleService-Info.plist (iOS)", type: "multiline", value: fb.iosConfig ?? "" },
        ],
      });
    }

    if (href === "/admin/settings/shipping-apis") {
      const sh = settings.shipping ?? {};
      return json({
        ok: true,
        kind: "form",
        title: "Shipping APIs (Including Shipway)",
        subtitle: "Configure Shipway, Shiprocket, NimbusPost, iThink, Delhivery/Ekart, Shadowfax, RapidShyp, Vamaship & Pickup Address",
        target: "integ.shipping",
        fields: [
          { key: "shipway.enabled", label: "Shipway Enabled (apidocs.shipway.com)", type: "boolean", value: Boolean(sh.shipway?.enabled) },
          { key: "shipway.username", label: "Shipway Username / Email", type: "text", value: sh.shipway?.username ?? "" },
          { key: "shipway.licenseKey", label: "Shipway License Key", type: "text", value: sh.shipway?.licenseKey ?? "" },
          { key: "shipway.carrierId", label: "Shipway Default Carrier ID (optional)", type: "text", value: sh.shipway?.carrierId ?? "" },
          { key: "shiprocket.enabled", label: "Shiprocket Enabled", type: "boolean", value: Boolean(sh.shiprocket?.enabled) },
          { key: "shiprocket.email", label: "Shiprocket API Email", type: "text", value: sh.shiprocket?.email ?? "" },
          { key: "shiprocket.password", label: "Shiprocket API Password", type: "text", value: sh.shiprocket?.password ?? "" },
          { key: "nimbuspost.enabled", label: "NimbusPost Enabled", type: "boolean", value: Boolean(sh.nimbuspost?.enabled) },
          { key: "nimbuspost.apiKey", label: "NimbusPost API Key", type: "text", value: sh.nimbuspost?.apiKey ?? "" },
          { key: "ithink.enabled", label: "iThink Logistics Enabled", type: "boolean", value: Boolean(sh.ithink?.enabled) },
          { key: "ithink.accessToken", label: "iThink Access Token", type: "text", value: sh.ithink?.accessToken ?? "" },
          { key: "ithink.secretKey", label: "iThink Secret Key", type: "text", value: sh.ithink?.secretKey ?? "" },
          { key: "rapidshyp.enabled", label: "RapidShyp Enabled", type: "boolean", value: Boolean(sh.rapidshyp?.enabled) },
          { key: "rapidshyp.apiKey", label: "RapidShyp API Key", type: "text", value: sh.rapidshyp?.apiKey ?? "" },
          { key: "vamaship.enabled", label: "Vamaship Enabled", type: "boolean", value: Boolean(sh.vamaship?.enabled) },
          { key: "vamaship.apiToken", label: "Vamaship API Token", type: "text", value: sh.vamaship?.apiToken ?? "" },
          { key: "ekart.enabled", label: "Ekart Enabled", type: "boolean", value: Boolean(sh.ekart?.enabled) },
          { key: "shadowfax.enabled", label: "Shadowfax Enabled", type: "boolean", value: Boolean(sh.shadowfax?.enabled) },
          { key: "pickup.name", label: "Pickup Warehouse Name", type: "text", value: sh.pickup?.name ?? "VGMF Store Pune" },
          { key: "pickup.phone", label: "Pickup Phone", type: "text", value: sh.pickup?.phone ?? "" },
          { key: "pickup.line1", label: "Pickup Street Address", type: "text", value: sh.pickup?.line1 ?? "" },
          { key: "pickup.city", label: "Pickup City", type: "text", value: sh.pickup?.city ?? "Pune" },
          { key: "pickup.state", label: "Pickup State", type: "text", value: sh.pickup?.state ?? "Maharashtra" },
          { key: "pickup.pincode", label: "Pickup Pincode", type: "text", value: sh.pickup?.pincode ?? "411030" },
        ],
      });
    }

    if (href === "/admin/settings/mobile") {
      const mobNotifs = readJson<Record<string, any>>(dataFile("mobile-notifications.json"), {
        events: {
          Ordered: { enabled: true, title: "Order Confirmed · #{orderId}", body: "Thank you {customerName}! Your order #{orderId} for {items} ({total}) is confirmed." },
          Packed: { enabled: true, title: "Order Packed · #{orderId}", body: "Good news {customerName}! Your order #{orderId} ({items}) is packed and ready for dispatch." },
          Shipped: { enabled: true, title: "Order Shipped · #{orderId}", body: "Your order #{orderId} has been shipped via {courier} (AWB: {awb})." },
          "Out for Delivery": { enabled: true, title: "Out for Delivery · #{orderId}", body: "Your parcel for order #{orderId} is out for delivery today via {courier}." },
          Delivered: { enabled: true, title: "Order Delivered · #{orderId}", body: "Your order #{orderId} ({items}) has been delivered. Thank you!" },
        },
        broadcasts: [],
      });
      const ev = mobNotifs.events ?? {};
      return json({
        ok: true,
        kind: "mobile-notifications",
        title: "Mobile App & Event Notifications",
        subtitle: "Manage Customer App Order Stage Notifications (Ordered, Packed, Shipped, Out for Delivery, Delivered), App Version & Broadcasts",
        mobileConfig: feed.mobile ?? {},
        events: ev,
        broadcasts: mobNotifs.broadcasts ?? [],
      });
    }

    if (href === "/admin/settings/appearance" || href === "/admin/website/text") {
      const app = feed.appearance ?? {};
      const col = app.colors ?? {};
      return json({
        ok: true,
        kind: "form",
        title: "App & Website Appearance (White & Blue UI)",
        subtitle: "Primary brand blue, pure white surfaces, typography and layout tokens",
        target: "feed.appearance.colors",
        fields: [
          { key: "primary", label: "Primary Brand Blue Hex", type: "text", value: col.primary ?? "#1D4ED8" },
          { key: "secondary", label: "Deep Navy Ink Hex", type: "text", value: col.secondary ?? "#0B1F3A" },
          { key: "accent", label: "Accent Blue Hex", type: "text", value: col.accent ?? "#2563EB" },
          { key: "background", label: "App Background Hex", type: "text", value: col.background ?? "#F8FAFC" },
          { key: "surface", label: "Soft Blue Surface Hex", type: "text", value: col.surface ?? "#EFF6FF" },
          { key: "paper", label: "Card Paper Hex", type: "text", value: col.paper ?? "#FFFFFF" },
          { key: "text", label: "Primary Text Hex", type: "text", value: col.text ?? "#0B1F3A" },
          { key: "muted", label: "Muted Text Hex", type: "text", value: col.muted ?? "#475569" },
          { key: "border", label: "Border Hex", type: "text", value: col.border ?? "#E2E8F0" },
        ],
      });
    }

    if (href === "/admin/settings/orders" || href === "/admin/settings/shipping" || href === "/admin/settings/timelines") {
      const os = feed.orderSettings ?? {};
      return json({
        ok: true,
        kind: "form",
        title: href.endsWith("timelines") ? "Processing Timelines" : href.endsWith("shipping") ? "Delivery Zones & Fees" : "Orders, Pre-orders, Returns & Refunds",
        subtitle: "Configure shipping fees, pre-order partial payment rules, processing timelines and returns",
        target: "feed.orderSettings",
        fields: [
          { key: "deliveryEnabled", label: "Home Delivery Enabled", type: "boolean", value: os.deliveryEnabled !== false },
          { key: "pickupEnabled", label: "Store Pickup Enabled", type: "boolean", value: os.pickupEnabled !== false },
          { key: "codEnabled", label: "Cash on Delivery (COD) Enabled", type: "boolean", value: Boolean(os.codEnabled) },
          { key: "shippingFeeMode", label: "Shipping Fee Mode (flat / free / free_above / courier_rate)", type: "text", value: os.shippingFeeMode ?? "flat" },
          { key: "flatFee", label: "Flat Shipping Fee (₹)", type: "number", value: Number(os.flatFee ?? 60) },
          { key: "freeAbove", label: "Free Shipping Above (₹)", type: "number", value: Number(os.freeAbove ?? 999) },
          { key: "packingCharge", label: "Packing Charge per Copy (₹)", type: "number", value: Number(os.packingCharge ?? 0) },
          { key: "processingHours", label: "Standard Processing Time (Hours)", type: "number", value: Number(os.processingHours ?? 24) },
          { key: "dispatchCutoff", label: "Daily Dispatch Cutoff Time", type: "text", value: os.dispatchCutoff ?? "16:00" },
        ],
      });
    }

    if (href === "/admin/website/homepage") {
      return json({
        ok: true,
        kind: "form",
        title: "Homepage & Site Tagline",
        subtitle: "Edit the main website & footer tagline, hero banners and support callout",
        target: "feed.homepage",
        fields: [
          { key: "tagline", label: "Site & Footer Tagline", type: "text", value: feed.site?.tagline ?? "Ayurveda education, publications and clinical care." },
          { key: "footerText", label: "Footer Tagline Override (optional)", type: "text", value: feed.site?.chrome?.footerText ?? "" },
          { key: "supportUs", label: "Show Support the Foundation Banner", type: "boolean", value: Boolean(feed.flags?.supportUs) },
          { key: "supportUsTitle", label: "Support Banner Title", type: "text", value: feed.flags?.supportUsTitle ?? "" },
          { key: "supportUsText", label: "Support Banner Text", type: "multiline", value: feed.flags?.supportUsText ?? "" },
        ],
      });
    }

    if (href === "/admin/website/visibility") {
      const vis = feed.visibility ?? {};
      return json({
        ok: true,
        kind: "form",
        title: "Site & Portal Module Switches",
        subtitle: "Toggle public sections across the website and Customer App",
        target: "feed.visibility",
        fields: [
          { key: "shop", label: "Publications Shop", type: "boolean", value: vis.shop !== false },
          { key: "events", label: "Seminars & Events", type: "boolean", value: vis.events !== false },
          { key: "clinics", label: "Foundation Clinics", type: "boolean", value: vis.clinics !== false },
          { key: "articles", label: "Ayurveda Articles Library", type: "boolean", value: vis.articles !== false },
          { key: "about", label: "About the Foundation", type: "boolean", value: vis.about !== false },
          { key: "gallery", label: "Photo Gallery", type: "boolean", value: vis.gallery !== false },
          { key: "videos", label: "Videos Library", type: "boolean", value: vis.videos !== false },
          { key: "announcements", label: "Announcements & Notice Board", type: "boolean", value: vis.announcements !== false },
          { key: "certificates", label: "Certificate Verification", type: "boolean", value: vis.certificates !== false },
          { key: "support", label: "Customer Helpdesk & Tickets", type: "boolean", value: vis.support !== false },
        ],
      });
    }

    if (href === "/admin/website/policies") {
      const pol = feed.policies ?? {};
      return json({
        ok: true,
        kind: "form",
        title: "Website & App Policies",
        subtitle: "Edit Privacy, Terms, Shipping, Return, Refund and Cancellation policies",
        target: "feed.policies",
        fields: [
          { key: "privacy", label: "Privacy Policy", type: "multiline", value: pol.privacy ?? "" },
          { key: "terms", label: "Terms of Use", type: "multiline", value: pol.terms ?? "" },
          { key: "shipping", label: "Shipping Policy", type: "multiline", value: pol.shipping ?? "" },
          { key: "returns", label: "Return Policy", type: "multiline", value: pol.returns ?? "" },
          { key: "refund", label: "Refund Policy", type: "multiline", value: pol.refund ?? "" },
          { key: "cancellation", label: "Cancellation Policy", type: "multiline", value: pol.cancellation ?? "" },
        ],
      });
    }

    if (href === "/admin/settings/countries") {
      const pc = feed.platformCountries ?? { allowInternational: true, enabledCountryCodes: ["IN"] };
      return json({
        ok: true,
        kind: "form",
        title: "Platform Countries",
        subtitle: "Control international shipping & registration availability",
        target: "feed.platformCountries",
        fields: [
          { key: "allowInternational", label: "Allow International Orders & Registrations", type: "boolean", value: pc.allowInternational !== false },
          { key: "codesCsv", label: "Enabled ISO Country Codes (comma-separated)", type: "text", value: Array.isArray(pc.enabledCountryCodes) ? pc.enabledCountryCodes.join(", ") : "IN, US, GB, AE, AU, CA" },
        ],
      });
    }

    if (href === "/admin/settings/domains") {
      const dom = readJson<Record<string, any>>(dataFile("domain-settings.json"), { primaryDomain: "vaidyagogate.org", seminarDomain: "seminar.vaidyagogate.org", autismDomain: "autism.vaidyagogate.org" });
      return json({
        ok: true,
        kind: "form",
        title: "Domains & Sister Portal DNS",
        subtitle: "Connected production domains across VGMF ecosystem",
        target: "file.domain-settings",
        fields: [
          { key: "primaryDomain", label: "Main Foundation Domain", type: "text", value: dom.primaryDomain ?? "vaidyagogate.org" },
          { key: "seminarDomain", label: "Seminar Portal Domain", type: "text", value: dom.seminarDomain ?? "seminar.vaidyagogate.org" },
          { key: "autismDomain", label: "Autism Portal Domain", type: "text", value: dom.autismDomain ?? "autism.vaidyagogate.org" },
        ],
      });
    }

    if (href === "/admin/settings/media") {
      const mc = readJson<Record<string, any>>(dataFile("media-config.json"), { provider: "local", maxUploadMb: 25 });
      return json({
        ok: true,
        kind: "form",
        title: "Media Storage Configuration",
        subtitle: "Storage driver and upload size limits for books, flyers, certificates and AWB labels",
        target: "file.media-config",
        fields: [
          { key: "provider", label: "Storage Provider (local / s3 / cloudflare)", type: "text", value: mc.provider ?? "local" },
          { key: "maxUploadMb", label: "Max Upload Size (MB)", type: "number", value: Number(mc.maxUploadMb ?? 25) },
          { key: "cdnBaseUrl", label: "CDN Base URL (optional)", type: "text", value: mc.cdnBaseUrl ?? "https://vaidyagogate.org" },
        ],
      });
    }

    // Collection / List screens for all remaining Admin & Staff pages
    if (href === "/admin/commerce/products" || href === "/admin/commerce/inventory") {
      const books = (feed.books ?? []) as Array<Record<string, any>>;
      return json({
        ok: true,
        kind: "collection",
        collectionKey: "books",
        title: href.endsWith("inventory") ? "Inventory Management" : "Product & Book Catalogue",
        subtitle: `${books.length} official publication(s) · Tap any item to edit price, stock, SKU or pre-order status`,
        canCreate: true,
        itemSchema: [
          { key: "title", label: "Publication Title", type: "text" },
          { key: "author", label: "Author", type: "text" },
          { key: "price", label: "Selling Price (₹)", type: "number" },
          { key: "originalPrice", label: "MRP / Original Price (₹)", type: "number" },
          { key: "sku", label: "SKU / Barcode", type: "text" },
          { key: "batchNo", label: "Batch / Edition No.", type: "text" },
          { key: "stock", label: "Available Stock Count", type: "number" },
          { key: "stockStatus", label: "Stock Status (in_stock / out_of_stock)", type: "text" },
          { key: "coverImage", label: "Cover Image URL", type: "text" },
          { key: "description", label: "Description", type: "multiline" },
        ],
        items: books.map((b) => ({
          id: String(b.id),
          title: String(b.title || "Publication"),
          subtitle: `SKU: ${b.sku || "—"} · Stock: ${b.stock ?? 0} · ₹${b.price ?? 0}`,
          badge: b.stockStatus === "out_of_stock" ? "Out of Stock" : `In Stock (${b.stock ?? 0})`,
          badgeTone: b.stockStatus === "out_of_stock" ? "red" : "green",
          image: b.coverImage || "",
          raw: b,
        })),
      });
    }

    if (href.includes("/articles")) {
      const articles = (feed.articles ?? []) as Array<Record<string, any>>;
      const onlyPending = href.endsWith("/approvals");
      const list = onlyPending ? articles.filter((a) => a.status === "pending" || a.status === "draft") : articles;
      return json({
        ok: true,
        kind: "collection",
        collectionKey: "articles",
        title: onlyPending ? "Articles Waiting for Approval" : href.endsWith("/new") ? "Create & Manage Articles" : "All Ayurveda Articles",
        subtitle: `${list.length} article(s) · Create, edit or publish directly to vaidyagogate.org`,
        canCreate: true,
        itemSchema: [
          { key: "title", label: "Article Title", type: "text" },
          { key: "author", label: "Author Name", type: "text" },
          { key: "category", label: "Category", type: "text" },
          { key: "status", label: "Status (published / pending / draft)", type: "text" },
          { key: "excerpt", label: "Short Excerpt", type: "multiline" },
          { key: "content", label: "Full Article Content", type: "multiline" },
        ],
        items: list.map((a) => ({
          id: String(a.id || a.slug),
          title: String(a.title || "Untitled Article"),
          subtitle: `${a.author || "VGMF"} · ${a.category || "Ayurveda"} · ${String(a.date || "").slice(0, 10)}`,
          badge: String(a.status || "published").toUpperCase(),
          badgeTone: a.status === "pending" ? "amber" : "green",
          raw: a,
        })),
      });
    }

    if (href.includes("/notices") || href.includes("/announcements")) {
      const isAnn = href.includes("/announcements");
      const key = isAnn ? "announcements" : "notices";
      const list = ((feed[key] ?? []) as Array<Record<string, any>>);
      return json({
        ok: true,
        kind: "collection",
        collectionKey: key,
        title: isAnn ? "Announcements" : "Official Notice Board",
        subtitle: `${list.length} published entry(s) · Tap to edit or add new`,
        canCreate: true,
        itemSchema: [
          { key: "title", label: "Title", type: "text" },
          { key: "date", label: "Date (YYYY-MM-DD)", type: "text" },
          { key: "category", label: "Category", type: "text" },
          { key: "body", label: "Details / Body", type: "multiline" },
        ],
        items: list.map((n, idx) => ({
          id: String(n.id || idx + 1),
          title: String(n.title || "Notice"),
          subtitle: `${String(n.date || n.publishedAt || "").slice(0, 10)} · ${n.category || "General"}`,
          badge: "LIVE",
          badgeTone: "blue",
          raw: n,
        })),
      });
    }

    if (href.includes("/events") || href === "/admin/settings/events" || href === "/admin/settings/portals") {
      const events = (feed.events ?? []) as Array<Record<string, any>>;
      return json({
        ok: true,
        kind: "collection",
        collectionKey: "events",
        title: href.endsWith("/speakers") ? "Event Speakers" : href.endsWith("/schedule") ? "Event Schedules" : "Foundation & Sister Portal Events",
        subtitle: `${events.length} event(s) synced across vaidyagogate.org, seminar.vaidyagogate.org & autism.vaidyagogate.org`,
        canCreate: true,
        itemSchema: [
          { key: "name", label: "Event Title", type: "text" },
          { key: "startDate", label: "Start Date (YYYY-MM-DD)", type: "text" },
          { key: "endDate", label: "End Date (YYYY-MM-DD)", type: "text" },
          { key: "venue", label: "Venue", type: "text" },
          { key: "city", label: "City", type: "text" },
          { key: "mode", label: "Mode (Offline / Online / Hybrid)", type: "text" },
          { key: "fee", label: "Registration Fee (₹)", type: "number" },
          { key: "registrationStatus", label: "Registration Status (Open / Closed)", type: "text" },
          { key: "shortDescription", label: "Short Summary", type: "multiline" },
        ],
        items: events.map((ev) => ({
          id: String(ev.id),
          title: String(ev.name || "Event"),
          subtitle: `${ev.startDate || ""} · ${ev.venue || ev.city || "Pune"} · ₹${ev.fee ?? 0}`,
          badge: String(ev.registrationStatus || "Open"),
          badgeTone: ev.registrationStatus === "Closed" ? "red" : "green",
          image: ev.bannerUrl || "",
          raw: ev,
        })),
      });
    }

    if (href.includes("/clinics")) {
      const clinics = (feed.clinics ?? []) as Array<Record<string, any>>;
      return json({
        ok: true,
        kind: "collection",
        collectionKey: "clinics",
        title: "Foundation Clinics",
        subtitle: `${clinics.length} clinic location(s) · Edit timings, doctor, phone and map links`,
        canCreate: true,
        itemSchema: [
          { key: "name", label: "Clinic Name", type: "text" },
          { key: "doctor", label: "Consulting Vaidya / Doctor", type: "text" },
          { key: "city", label: "City / Area", type: "text" },
          { key: "phone", label: "Appointment Phone", type: "text" },
          { key: "timings", label: "Consultation Hours", type: "text" },
          { key: "address", label: "Full Clinic Address", type: "multiline" },
        ],
        items: clinics.map((c, idx) => ({
          id: String(c.id || idx + 1),
          title: String(c.name || "Foundation Clinic"),
          subtitle: `${c.city || "Pune"} · ${c.phone || ""}`,
          badge: "ACTIVE",
          badgeTone: "green",
          raw: c,
        })),
      });
    }

    if (href.includes("/accounts/staff") || href.includes("/accounts/customers") || href.includes("/accounts/roles")) {
      const accounts = readJson<Array<Record<string, any>>>(dataFile("foundation-accounts.json"), []);
      const isCustomers = href.includes("/customers");
      const list = isCustomers
        ? accounts.filter((a) => !a.role || a.role === "customer" || a.role === "member")
        : accounts.filter((a) => a.role === "admin" || a.role === "coadmin" || a.role === "staff" || a.role === "doctor");
      return json({
        ok: true,
        kind: "collection",
        collectionKey: "accounts",
        title: isCustomers ? "Customer Accounts" : href.includes("/roles") ? "Staff Roles & Permissions" : "Staff & Co-Admin Accounts",
        subtitle: `${list.length} account(s) on vaidyagogate.org`,
        canCreate: !isCustomers,
        itemSchema: [
          { key: "firstName", label: "First Name", type: "text" },
          { key: "lastName", label: "Last Name", type: "text" },
          { key: "email", label: "Email Address", type: "text" },
          { key: "phone", label: "Phone Number", type: "text" },
          { key: "role", label: "Role (staff / coadmin / admin)", type: "text" },
          { key: "staffRoleId", label: "Staff Role ID (general-staff / order-manager / store-manager / support-agent / article-writer)", type: "text" },
          { key: "password", label: "Password (leave blank to keep unchanged)", type: "text" },
        ],
        items: list.slice(0, 120).map((a, idx) => ({
          id: String(a.id || a.email || idx + 1),
          title: [a.firstName, a.lastName].filter(Boolean).join(" ").trim() || String(a.name || a.email || "Account"),
          subtitle: `${a.email || ""} · ${a.phone || ""}`,
          badge: String(a.staffRoleId || a.role || "member").toUpperCase(),
          badgeTone: a.role === "admin" || a.role === "coadmin" ? "blue" : "green",
          raw: a,
        })),
      });
    }

    if (href.includes("/certificates")) {
      const certs = readJson<Array<Record<string, any>>>(dataFile("certificates.json"), []);
      return json({
        ok: true,
        kind: "collection",
        collectionKey: "certificates",
        title: "Certificates & Verification",
        subtitle: `${certs.length} Foundation certificate record(s)`,
        canCreate: true,
        itemSchema: [
          { key: "number", label: "12-Digit Certificate ID / Number", type: "text" },
          { key: "name", label: "Recipient Full Name", type: "text" },
          { key: "event", label: "Seminar / Programme Title", type: "text" },
          { key: "eventDate", label: "Event Date (YYYY-MM-DD)", type: "text" },
          { key: "kind", label: "Type (participant / volunteer)", type: "text" },
        ],
        items: certs.slice(0, 100).map((c, idx) => ({
          id: String(c.number || c.id || idx + 1),
          title: `${c.name || "Recipient"} · ${c.number || ""}`,
          subtitle: `${c.event || "Seminar"} · ${c.eventDate || ""}`,
          badge: c.enabled === false ? "DISABLED" : "VERIFIED",
          badgeTone: c.enabled === false ? "red" : "green",
          raw: c,
        })),
      });
    }

    if (href.includes("/shipments") || href.includes("/ready-to-ship") || href.includes("/quick-shipment") || href.includes("/delivery-partners")) {
      return json({
        ok: true,
        kind: "collection",
        collectionKey: "shipments",
        title: "Shipments & Couriers (Shipway / Shiprocket / All)",
        subtitle: `${shipments.length} live shipment(s) tracked across courier partners`,
        canCreate: false,
        itemSchema: [
          { key: "awb", label: "AWB Tracking Number", type: "text" },
          { key: "courier", label: "Courier Name", type: "text" },
          { key: "status", label: "Shipment Status", type: "text" },
          { key: "expectedBy", label: "Expected Delivery Date", type: "text" },
        ],
        items: shipments.slice(0, 100).map((s) => ({
          id: String(s.id),
          title: `Order #${s.orderId} · ${s.courier || s.provider || "Courier"}`,
          subtitle: `AWB: ${s.awb || "Pending"} · ${(s as unknown as Record<string, unknown>).customerName || ""} · ${(s as unknown as Record<string, unknown>).city || ""}`,
          badge: String(s.status || "Booked"),
          badgeTone: s.status === "Delivered" ? "green" : "blue",
          raw: s,
        })),
      });
    }

    if (href.includes("/payments") || href.includes("/invoices") || href.includes("/approvals") || href.includes("/customer-purchases") || href.includes("/pickup") || href.includes("/pos") || href.includes("/orders") || href.includes("/picking") || href.includes("/picker") || href.includes("/packer")) {
      let filtered = allOrders;
      if (href.endsWith("/successful")) filtered = allOrders.filter((o) => o.paymentStatus === "Paid");
      else if (href.endsWith("/failed")) filtered = allOrders.filter((o) => o.status === "Cancelled");
      else if (href.endsWith("/pending")) filtered = allOrders.filter((o) => o.paymentStatus !== "Paid");
      else if (href.endsWith("/refunds")) filtered = allOrders.filter((o) => (o.refunds?.length ?? 0) > 0 || o.returnRequest);
      else if (href.includes("/pickup")) filtered = allOrders.filter((o) => o.deliveryMode === "store_pickup");
      else if (href.includes("/pos")) filtered = allOrders.filter((o) => o.channel === "pos");
      else if (href.includes("/approvals")) filtered = allOrders.filter((o) => Boolean(o.returnRequest || (o as unknown as Record<string, unknown>).approval));

      return json({
        ok: true,
        kind: "orders-list",
        title: href.split("/").pop()?.replace(/-/g, " ").toUpperCase() || "ORDERS & PAYMENTS",
        subtitle: `${filtered.length} matching record(s) from live production orders`,
        orders: filtered.slice(0, 80).map(enrichOrder),
      });
    }

    if (href.includes("/support/whatsapp")) {
      const waList = readJson<Array<Record<string, any>>>(dataFile("whatsapp-inbox.json"), []);
      return json({
        ok: true,
        kind: "collection",
        collectionKey: "whatsapp-inbox",
        title: "WhatsApp Business Inbox",
        subtitle: `${waList.length} incoming & outgoing WhatsApp conversation entry(s)`,
        canCreate: false,
        itemSchema: [
          { key: "from", label: "Customer Phone", type: "text" },
          { key: "name", label: "Customer Name", type: "text" },
          { key: "text", label: "Message Text", type: "multiline" },
        ],
        items: waList.slice(0, 80).map((m, idx) => ({
          id: String(m.id || idx + 1),
          title: `${m.name || m.from || "WhatsApp User"}`,
          subtitle: `${m.text || m.body || "Template message"} · ${String(m.at || m.timestamp || "").slice(0, 16)}`,
          badge: String(m.direction || "IN").toUpperCase(),
          badgeTone: "green",
          raw: m,
        })),
      });
    }

    if (href.includes("/support/chat")) {
      const chats = readJson<Array<Record<string, any>>>(dataFile("live-chat.json"), []);
      return json({
        ok: true,
        kind: "collection",
        collectionKey: "live-chat",
        title: "Live Support Chat Sessions",
        subtitle: `${chats.length} chat conversation(s) from website & app`,
        canCreate: false,
        itemSchema: [
          { key: "name", label: "Visitor Name", type: "text" },
          { key: "email", label: "Visitor Email", type: "text" },
          { key: "status", label: "Chat Status", type: "text" },
        ],
        items: chats.slice(0, 80).map((c, idx) => ({
          id: String(c.id || idx + 1),
          title: `${c.name || c.email || "Visitor"}`,
          subtitle: `${Array.isArray(c.messages) && c.messages.length ? c.messages[c.messages.length - 1]?.text : "Active chat"}`,
          badge: String(c.status || "OPEN").toUpperCase(),
          badgeTone: "blue",
          raw: c,
        })),
      });
    }

    if (href.includes("/email") || href.includes("/notifications") || href.includes("/activity")) {
      const file = href.includes("/activity") ? "audit-log.json" : "email-log.json";
      const logs = readJson<Array<Record<string, any>>>(dataFile(file), []);
      return json({
        ok: true,
        kind: "collection",
        collectionKey: file,
        title: href.includes("/activity") ? "Account & Admin Activity Log" : "Email & Notification Delivery Log",
        subtitle: `${logs.length} logged event(s)`,
        canCreate: false,
        itemSchema: [
          { key: "to", label: "Recipient / Actor", type: "text" },
          { key: "subject", label: "Subject / Action", type: "text" },
          { key: "at", label: "Timestamp", type: "text" },
        ],
        items: logs.slice(0, 80).map((l, idx) => ({
          id: String(l.id || idx + 1),
          title: String(l.subject || l.detail || l.kind || "Activity"),
          subtitle: `${l.to || l.email || l.by || ""} · ${String(l.at || "").slice(0, 16)}`,
          badge: String(l.status || l.kind || "LOGGED").toUpperCase(),
          badgeTone: "blue",
          raw: l,
        })),
      });
    }

    // Generic CMS collection handler for flyers, banners, awards, thanks, gallery, videos, reviews, pages, about, promos
    const cmsKeyMap: Record<string, { key: string; title: string }> = {
      "/admin/website/flyers": { key: "flyers", title: "Slideshow & Posters" },
      "/admin/website/banners": { key: "banners", title: "Promotional Banners" },
      "/admin/website/awards": { key: "awards", title: "Competition Awards" },
      "/admin/website/thanks": { key: "thanks", title: "Special Thanks" },
      "/admin/website/gallery": { key: "gallery", title: "Photo Gallery" },
      "/admin/website/videos": { key: "videos", title: "Videos Library" },
      "/admin/website/reviews": { key: "seminarReviews", title: "Participant & Book Reviews" },
      "/admin/website/pages": { key: "pages", title: "Custom Website Pages" },
    };
    if (cmsKeyMap[href]) {
      const { key, title } = cmsKeyMap[href];
      const list = (Array.isArray(feed[key]) ? feed[key] : []) as Array<Record<string, any>>;
      return json({
        ok: true,
        kind: "collection",
        collectionKey: key,
        title,
        subtitle: `${list.length} item(s) published in ${title}`,
        canCreate: true,
        itemSchema: [
          { key: "title", label: "Title / Name", type: "text" },
          { key: "description", label: "Description / Text", type: "multiline" },
          { key: "image", label: "Image / Media URL", type: "text" },
          { key: "href", label: "Target Link (optional)", type: "text" },
        ],
        items: list.map((item, idx) => ({
          id: String(item.id || idx + 1),
          title: String(item.title || item.personName || item.name || `Item #${idx + 1}`),
          subtitle: String(item.description || item.text || item.awardName || item.href || ""),
          badge: "PUBLISHED",
          badgeTone: "green",
          image: item.image || item.src || "",
          raw: item,
        })),
      });
    }

    // Fallback native summary for Analytics / Reports / Other pages
    return json({
      ok: true,
      kind: "analytics",
      title: href.split("/").filter(Boolean).pop()?.replace(/-/g, " ").toUpperCase() || "MODULE OVERVIEW",
      subtitle: `Native live data for ${href}`,
      stats: [
        { label: "Total Orders", value: String(allOrders.length) },
        { label: "Active Shipments", value: String(shipments.length) },
        { label: "Published Books", value: String((feed.books ?? []).length) },
        { label: "Published Articles", value: String((feed.articles ?? []).length) },
        { label: "Published Events", value: String((feed.events ?? []).length) },
        { label: "Notices & Alerts", value: String((feed.notices ?? []).length) },
      ],
    });
  }

  if (action === "module-save") {
    const target = String(body?.target ?? "").trim();
    const values = (body?.values ?? {}) as Record<string, any>;
    const feedFile = dataFile("app-feed.json");
    const integFile = dataFile("admin-integrations.json");

    if (target.startsWith("feed.")) {
      const feed = readJson<Record<string, any>>(feedFile, {});
      if (target === "feed.site") {
        feed.site = { ...(feed.site ?? {}), ...values };
      } else if (target === "feed.homepage") {
        feed.site = {
          ...(feed.site ?? {}),
          tagline: values.tagline ?? feed.site?.tagline,
          chrome: { ...(feed.site?.chrome ?? {}), footerText: values.footerText ?? "" },
        };
        feed.flags = {
          ...(feed.flags ?? {}),
          supportUs: Boolean(values.supportUs),
          supportUsTitle: values.supportUsTitle ?? "",
          supportUsText: values.supportUsText ?? "",
        };
      } else if (target === "feed.visibility") {
        feed.visibility = { ...(feed.visibility ?? {}), ...values };
      } else if (target === "feed.policies") {
        feed.policies = { ...(feed.policies ?? {}), ...values };
      } else if (target === "feed.orderSettings") {
        feed.orderSettings = { ...(feed.orderSettings ?? {}), ...values };
      } else if (target === "feed.appearance.colors") {
        feed.appearance = {
          ...(feed.appearance ?? {}),
          version: Number(feed.appearance?.version || 10) + 1,
          publishedAt: new Date().toISOString(),
          colors: { ...(feed.appearance?.colors ?? {}), ...values },
        };
      } else if (target === "feed.platformCountries") {
        const codes = String(values.codesCsv || "IN").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
        feed.platformCountries = {
          allowInternational: Boolean(values.allowInternational),
          enabledCountryCodes: codes.length ? codes : ["IN"],
        };
      }
      feed.publishedAt = new Date().toISOString();
      writeJson(feedFile, feed);
      return json({ ok: true, message: "Saved live to vaidyagogate.org production feed." });
    }

    if (target.startsWith("integ.")) {
      const integ = readJson<Record<string, any>>(integFile, { settings: {} });
      const s = (integ.settings ?? {}) as Record<string, any>;
      if (target === "integ.email") s.email = { ...(s.email ?? {}), ...values };
      else if (target === "integ.whatsapp") s.whatsapp = { ...(s.whatsapp ?? {}), ...values };
      else if (target === "integ.sms") s.sms = { ...(s.sms ?? {}), ...values };
      else if (target === "integ.firebase") s.firebase = { ...(s.firebase ?? {}), ...values };
      else if (target === "integ.payments" || target === "integ.shipping") {
        const groupKey = target === "integ.shipping" ? "shipping" : null;
        const targetObj = groupKey ? (s[groupKey] = s[groupKey] ?? {}) : s;
        for (const [k, v] of Object.entries(values)) {
          const [sub, field] = k.split(".");
          if (sub && field) {
            targetObj[sub] = { ...(targetObj[sub] ?? {}), [field]: v };
          } else {
            targetObj[k] = v;
          }
        }
      }
      integ.settings = s;
      integ.updatedAt = new Date().toISOString();
      writeJson(integFile, integ);
      return json({ ok: true, message: "Integration credentials saved to vaidyagogate.org." });
    }

    if (target === "file.domain-settings") {
      writeJson(dataFile("domain-settings.json"), values);
      return json({ ok: true, message: "Domain settings saved." });
    }
    if (target === "file.media-config") {
      writeJson(dataFile("media-config.json"), values);
      return json({ ok: true, message: "Media storage configuration saved." });
    }

    return json({ ok: false, error: "Unsupported save target." }, 400);
  }

  if (action === "module-item-action") {
    const collectionKey = String(body?.collectionKey ?? "").trim();
    const op = String(body?.op ?? "upsert").trim(); // "upsert" | "delete"
    const item = (body?.item ?? {}) as Record<string, any>;
    const itemId = String(body?.itemId ?? item.id ?? "").trim() || `ITEM-${Date.now()}`;

    if (["books", "articles", "notices", "announcements", "events", "clinics", "flyers", "banners", "awards", "thanks", "gallery", "videos", "seminarReviews", "pages"].includes(collectionKey)) {
      const feedFile = dataFile("app-feed.json");
      const feed = readJson<Record<string, any>>(feedFile, {});
      const list = (Array.isArray(feed[collectionKey]) ? feed[collectionKey] : []) as Array<Record<string, any>>;
      if (op === "delete") {
        feed[collectionKey] = list.filter((x) => String(x.id || x.slug) !== itemId);
      } else {
        const exists = list.some((x) => String(x.id || x.slug) === itemId);
        const nextItem = { ...item, id: itemId };
        feed[collectionKey] = exists
          ? list.map((x) => (String(x.id || x.slug) === itemId ? { ...x, ...nextItem } : x))
          : [nextItem, ...list];
      }
      feed.publishedAt = new Date().toISOString();
      writeJson(feedFile, feed);
      return json({ ok: true, message: op === "delete" ? "Item removed." : "Saved to production." });
    }

    if (collectionKey === "accounts") {
      const accFile = dataFile("foundation-accounts.json");
      const list = readJson<Array<Record<string, any>>>(accFile, []);
      if (op === "delete") {
        writeJson(accFile, list.filter((a) => String(a.id || a.email) !== itemId));
      } else {
        const emailKey = String(item.email || itemId).trim().toLowerCase();
        const exists = list.some((a) => String(a.email || "").toLowerCase() === emailKey || String(a.id) === itemId);
        const nextList = exists
          ? list.map((a) => {
              if (String(a.email || "").toLowerCase() === emailKey || String(a.id) === itemId) {
                const updated = { ...a, ...item };
                if (!item.password) updated.password = a.password;
                return updated;
              }
              return a;
            })
          : [{ id: itemId, createdAt: new Date().toISOString(), status: "active", ...item }, ...list];
        writeJson(accFile, nextList);
      }
      return json({ ok: true, message: "Account updated." });
    }

    if (collectionKey === "certificates") {
      const certFile = dataFile("certificates.json");
      const list = readJson<Array<Record<string, any>>>(certFile, []);
      const num = String(item.number || itemId).trim();
      if (op === "delete") {
        writeJson(certFile, list.filter((c) => String(c.number || c.id) !== num));
      } else {
        const exists = list.some((c) => String(c.number || c.id) === num);
        const nextList = exists
          ? list.map((c) => (String(c.number || c.id) === num ? { ...c, ...item, number: num, updatedAt: new Date().toISOString() } : c))
          : [{ id: num, number: num, enabled: true, scanVerified: true, updatedAt: new Date().toISOString(), ...item }, ...list];
        writeJson(certFile, nextList);
      }
      return json({ ok: true, message: "Certificate saved." });
    }

    if (collectionKey === "shipments") {
      const shipFile = dataFile("shop-shipments.json");
      const list = readJson<Array<Record<string, any>>>(shipFile, []);
      const nextList = list.map((s) => (String(s.id) === itemId ? { ...s, ...item } : s));
      writeJson(shipFile, nextList);
      return json({ ok: true, message: "Shipment updated." });
    }

    return json({ ok: false, error: "Unsupported collection." }, 400);
  }
  // ==================== END NATIVE MODULE ENGINE ====================

  if (action === "refresh-shipment") {
    const orderId = String(body?.orderId ?? "").trim();
    const shipmentId = String(body?.shipmentId ?? "").trim();
    if (!orderId) return json({ ok: false, error: "Order ID required." }, 400);
    const result = await refreshStoredShipment(orderId, shipmentId);
    const latestOrder = findShopOrder(orderId);
    return json({
      ok: true,
      live: "live" in result ? result.live : false,
      status: "status" in result ? result.status : "",
      order: latestOrder ? enrichOrder(latestOrder) : null,
      shipment: "shipment" in result ? result.shipment : findShopShipment(orderId, shipmentId),
    });
  }

  if (action === "store-pickup-orders") {
    const q = String(body?.q ?? "").trim().toLowerCase();
    const orders = listShopOrders()
      .filter((o) => {
        if (q) {
          const hay = [o.id, o.deliveryAddress?.fullName, o.deliveryAddress?.phone, o.deliveryAddress?.email].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(q);
        }
        return o.deliveryMode === "store_pickup" && o.status !== "Cancelled";
      })
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 120)
      .map((o) => ({
        ...enrichOrder(o),
        pickupArrivedAt: o.pickupArrivedAt,
        pickupOtpReady: pickupOtpReady(o),
      }));
    return json({ ok: true, orders });
  }

  if (action === "store-pickup-action") {
    const sub = String(body?.sub ?? "").trim();
    const orderId = String(body?.orderId ?? "").trim();
    const order = findShopOrder(orderId);
    if (!order) return json({ ok: false, error: "Order not found." }, 404);
    const at = new Date().toISOString();
    const by = session.name || session.email;

    if (sub === "arrived") {
      const updated = patchShopOrder(orderId, {
        pickupArrivedAt: at,
        history: [...(order.history ?? []), { at, status: order.status, by, note: "Customer arrived at store pickup counter" }],
      });
      return json({
        ok: true,
        message: "Marked customer arrived at store counter.",
        order: updated ? { ...enrichOrder(updated), pickupArrivedAt: updated.pickupArrivedAt, pickupOtpReady: pickupOtpReady(updated) } : null,
      });
    }

    if (sub === "mark-ready") {
      const updated = patchShopOrder(orderId, {
        status: "Packed",
        history: [...(order.history ?? []), { at, status: "Packed", by, note: "Marked ready for store pickup (OTP unlocked)" }],
      });
      const code = pickupOtp(orderId);
      const email = order.deliveryAddress?.email || order.accountEmail;
      if (email) {
        void sendMobileEmail(
          email,
          `Your VGMF Order #${orderId} is Ready for Store Pickup (OTP: ${code})`,
          `Namaste ${order.deliveryAddress?.fullName || "Customer"},\n\nYour Vaidya Gogate Memorial Foundation order #${orderId} is ready for store pickup.\n\nYour 6-digit Pickup OTP is: ${code}\n\nPlease share this OTP at the counter when collecting your parcel.`
        ).catch(() => undefined);
      }
      return json({
        ok: true,
        message: "Order marked ready for pickup & OTP sent to customer.",
        order: updated ? { ...enrichOrder(updated), pickupArrivedAt: updated.pickupArrivedAt, pickupOtpReady: pickupOtpReady(updated) } : null,
      });
    }

    if (sub === "mark-paid") {
      const method = String(body?.paymentMethod || order.paymentMethod || "Cash at Store");
      const updated = patchShopOrder(orderId, {
        paymentStatus: "Paid",
        paymentMethod: method,
        amountPaid: order.total,
        paidAt: order.paidAt || at,
        history: [...(order.history ?? []), { at, status: order.status, by, note: `Paid at Store Pickup Counter (${method})` }],
      });
      return json({
        ok: true,
        message: "Payment recorded as Paid.",
        order: updated ? { ...enrichOrder(updated), pickupArrivedAt: updated.pickupArrivedAt, pickupOtpReady: pickupOtpReady(updated) } : null,
      });
    }

    if (sub === "resend-otp") {
      if (!pickupOtpReady(order)) {
        return json({ ok: false, error: "Mark the order ready for pickup first to unlock the OTP." }, 400);
      }
      const code = pickupOtp(orderId);
      const email = order.deliveryAddress?.email || order.accountEmail;
      if (email) {
        await sendMobileEmail(
          email,
          `Pickup OTP for VGMF Order #${orderId}: ${code}`,
          `Namaste ${order.deliveryAddress?.fullName || "Customer"},\n\nYour 6-digit Store Pickup OTP for order #${orderId} is: ${code}\n\nPlease share this OTP at the VGMF counter.`
        ).catch(() => undefined);
      }
      return json({ ok: true, message: "Pickup OTP resent to customer." });
    }

    if (sub === "verify-otp") {
      if (!pickupOtpReady(order)) {
        return json({ ok: false, error: "Order must be marked ready for pickup before verifying OTP." }, 400);
      }
      const entered = String(body?.otp ?? "").replace(/\D/g, "").trim();
      const expected = pickupOtp(orderId);
      if (entered !== expected) {
        return json({ ok: false, error: "Incorrect 6-digit Pickup OTP. Please verify with the customer." }, 400);
      }
      const updated = patchShopOrder(orderId, {
        status: "Delivered",
        history: [...(order.history ?? []), { at, status: "Delivered", by, note: "Pickup OTP verified · handed over at store counter" }],
      });
      return json({
        ok: true,
        message: "Pickup OTP verified! Order marked Delivered / Picked Up.",
        order: updated ? { ...enrichOrder(updated), pickupArrivedAt: updated.pickupArrivedAt, pickupOtpReady: pickupOtpReady(updated) } : null,
      });
    }

    return json({ ok: false, error: "Unknown store-pickup action." }, 400);
  }

  if (action === "delivery-dashboard") {
    const enrollment = getAgentEnrollment(session.email, session.role);
    const isAdmin = session.role === "admin" || session.role === "superadmin";
    const hubCode = String((!isAdmin && enrollment.hubCode) ? enrollment.hubCode : (body?.hubCode || enrollment.hubCode || "")).trim();
    const kycPipeline = buildKycPipelineStages(enrollment as unknown as { status: "unassigned" | "pending" | "approved" | "rejected"; hubCode?: string; requestedAt?: string; reviewedAt?: string; reviewedBy?: string; kyc?: AgentKycData });
    const adv = readAdvancedStore();
    const myAttendance = adv.attendance.find((a) => a.email.toLowerCase() === session.email.toLowerCase()) || null;
    const myPickupManifests = adv.pickupManifests.filter((m) => m.executiveEmail.toLowerCase() === session.email.toLowerCase());
    return json({
      ok: true,
      agentEnrollment: { ...enrollment, kycPipeline },
      enabledKycProviders: getEnabledKycProviders(),
      shiftTemplates: adv.shiftTemplates,
      myAttendance,
      myPickupManifests,
      openBoxSettings: adv.openBoxSettings,
      ...buildDeliveryDashboard(session.email, hubCode),
    });
  }

  if (action === "delivery-kyc-manual-submit") {
    try {
      const res = submitManualKyc({
        email: session.email,
        name: session.name || session.email,
        documentType: String(body?.documentType || ""),
        documentNumber: String(body?.documentNumber || ""),
        idPhotoUrl: String(body?.idPhotoUrl || ""),
        selfiePhotoUrl: String(body?.selfiePhotoUrl || ""),
      });
      return json({ ok: true, ...res, message: "Manual KYC submitted! Awaiting Admin verification." });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not submit manual KYC." }, 400);
    }
  }

  if (action === "delivery-kyc-accurascan-submit") {
    try {
      const res = await submitAccuraScanKyc({
        email: session.email,
        name: session.name || session.email,
        documentType: String(body?.documentType || "Aadhaar Card"),
        documentNumber: String(body?.documentNumber || ""),
        idPhotoBase64: String(body?.idPhotoBase64 || ""),
        selfiePhotoBase64: String(body?.selfiePhotoBase64 || ""),
        idPhotoUrl: String(body?.idPhotoUrl || ""),
        selfiePhotoUrl: String(body?.selfiePhotoUrl || ""),
      });
      return json({
        ok: true,
        ...res,
        message: res.kyc.status === "Approved"
          ? `AccuraScan AI KYC Approved! Face Match ${res.faceMatchScore ?? "—"}% · Liveness ${res.livenessScore ?? "—"}%`
          : "AccuraScan KYC submitted for review.",
      });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not complete AccuraScan KYC." }, 400);
    }
  }

  if (action === "delivery-request-hub") {
    try {
      const enrollment = requestAgentHubEnrollment({
        email: session.email,
        name: session.name || session.email,
        phone: String(body?.phone || ""),
        vehicleNo: String(body?.vehicleNo || ""),
        hubCode: String(body?.hubCode || ""),
      });
      if (body?.serviceMode) {
        updateExecutiveShiftStatus({
          email: session.email,
          name: session.name || session.email,
          hubCode: enrollment.hubCode,
          serviceMode: String(body.serviceMode) as ServiceModeChoice,
          status: "checked_out",
        });
      }
      return json({ ok: true, agentEnrollment: enrollment, message: `Activation request sent to ${enrollment.hubCode}. Waiting for Hub Manager approval.` });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not submit hub request." }, 400);
    }
  }

  if (action === "delivery-add-hub") {
    try {
      const hub = addCustomHub({
        code: String(body?.code || ""),
        name: String(body?.name || ""),
        type: (String(body?.type || "combined") as HubType),
        city: String(body?.city || ""),
        state: String(body?.state || "Maharashtra"),
        pincode: String(body?.pincode || ""),
      });
      return json({ ok: true, hub, message: `Hub ${hub.code} (${hub.type}) saved.` });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not save hub." }, 400);
    }
  }

  if (action === "delivery-hub-executive") {
    try {
      const sub = String(body?.sub || "add").trim();
      const hubCode = String(body?.hubCode || "VGMF-PNQ").trim();
      if (sub === "remove") {
        const hub = removeHubExecutive(hubCode, String(body?.execId || ""));
        return json({ ok: true, hub, message: "Executive removed from hub." });
      }
      const hub = addHubExecutive(hubCode, {
        name: String(body?.name || ""),
        email: String(body?.email || ""),
        phone: String(body?.phone || ""),
        role: (String(body?.role || "delivery_executive") as "hub_manager" | "pickup_executive" | "delivery_executive" | "sorter"),
      });
      return json({ ok: true, hub, message: `Executive added to ${hub.code}.` });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not update hub executive." }, 400);
    }
  }

  if (action === "delivery-generate-awb") {
    try {
      const orderId = String(body?.orderId || "").trim();
      const hubCode = String(body?.hubCode || "VGMF-PNQ").trim();
      if (!orderId) return json({ ok: false, error: "orderId is required." }, 400);
      const result = generateVgmfAwb(orderId, hubCode, session.name || session.email);
      return json({
        ok: true,
        ...result,
        labelUrl: `https://vaidyagogate.org/api/admin/vgmf-label?awb=${encodeURIComponent(String(result.shipment.awb || ""))}`,
        message: result.alreadyExists
          ? `12-digit VGMF AWB ${result.shipment.awb} already generated.`
          : `12-digit VGMF AWB ${result.shipment.awb} generated & 6-digit Seller Pickup OTP sent.`,
      });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not generate AWB." }, 400);
    }
  }

  if (action === "delivery-shift-status") {
    try {
      const rec = updateExecutiveShiftStatus({
        email: session.email,
        name: session.name || session.email,
        hubCode: String(body?.hubCode || ""),
        serviceMode: body?.serviceMode ? (String(body.serviceMode) as ServiceModeChoice) : undefined,
        shiftId: body?.shiftId ? String(body.shiftId) : undefined,
        status: (String(body?.status || "checked_in") as "checked_in" | "on_break" | "checked_out"),
      });
      return json({ ok: true, myAttendance: rec, message: `Shift status updated: ${rec.status.replace(/_/g, " ")} (${rec.serviceMode}).` });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not update shift status." }, 400);
    }
  }

  if (action === "delivery-openbox-start") {
    try {
      const res = startOpenBoxSession({
        awb: String(body?.awb || ""),
        executiveEmail: session.email,
        executiveName: session.name || session.email,
      });
      return json({ ok: true, ...res });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not start Open-Box delivery." }, 400);
    }
  }

  if (action === "delivery-openbox-authorize") {
    try {
      const res = authorizeOpenBoxSession({
        sessionId: String(body?.sessionId || ""),
        last4Digits: String(body?.last4Digits || ""),
        openBoxOtp: String(body?.openBoxOtp || ""),
      });
      return json({ ok: true, ...res });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Open-Box authorization failed." }, 400);
    }
  }

  if (action === "delivery-openbox-complete") {
    try {
      const res = completeOpenBoxSession({
        sessionId: String(body?.sessionId || ""),
        answers: (body?.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, string>,
        remarks: body?.remarks ? String(body.remarks) : "",
        photos: Array.isArray(body?.photos) ? body.photos : [],
        decision: (String(body?.decision || "accepted") as "accepted" | "damaged" | "wrong_product" | "missing_item" | "refused"),
        finalDeliveryOtp: body?.finalDeliveryOtp ? String(body.finalDeliveryOtp) : undefined,
        recipientName: body?.recipientName ? String(body.recipientName) : undefined,
        codCollected: Boolean(body?.codCollected),
        hubCode: body?.hubCode ? String(body.hubCode) : undefined,
      });
      return json({ ok: true, ...res });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not complete Open-Box delivery." }, 400);
    }
  }

  if (action === "delivery-pm-scan") {
    try {
      const pm = scanIntoPickupManifest(String(body?.manifestId || ""), String(body?.awb || ""));
      return json({ ok: true, pickupManifest: pm, message: `Scanned ${body?.awb} (${pm.scannedAwbs.length}/${pm.expectedAwbs.length}).` });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Pickup manifest scan failed." }, 400);
    }
  }

  if (action === "delivery-pm-reconcile") {
    try {
      const pm = reconcilePickupManifest(String(body?.manifestId || ""), (body?.missingReasons || {}) as Record<string, string>);
      return json({ ok: true, pickupManifest: pm, message: `Pickup Manifest ${pm.id} marked ${pm.status}.` });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Reconciliation failed." }, 400);
    }
  }

  if (action === "delivery-cod-qr") {
    try {
      const res = await createDoorstepCodQr({
        orderId: String(body?.orderId || ""),
        provider: (String(body?.provider || "paytm") as "paytm" | "razorpay"),
        executiveName: session.name || session.email,
      });
      return json({ ok: true, ...res });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not generate COD QR." }, 400);
    }
  }

  if (action === "delivery-cod-confirm") {
    try {
      const res = await confirmAndSyncCodPayment({
        orderId: String(body?.orderId || ""),
        method: (String(body?.method || "cash") as "cash" | "paytm" | "razorpay"),
        referenceId: body?.referenceId ? String(body.referenceId) : undefined,
        utr: body?.utr ? String(body.utr) : undefined,
        executiveName: session.name || session.email,
      });
      return json({ ok: true, ...res });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not confirm COD payment." }, 400);
    }
  }

  if (action === "delivery-assign-runsheet") {
    try {
      const enr = getAgentEnrollment(session.email, session.role);
      if (enr.status !== "approved") return json({ ok: false, error: "Your ID is pending Hub Manager approval. You cannot accept deliveries until activated." }, 403);
      const code = String(body?.code || "").trim();
      if (!code) return json({ ok: false, error: "Scan a 12-digit AWB / Order barcode to assign to your runsheet." }, 400);
      const res = assignParcelToAgent({
        code,
        agentEmail: session.email,
        agentName: session.name || session.email,
        hubCode: String(body?.hubCode || "VGMF-PNQ"),
      });
      return json({
        ok: true,
        ...res,
        message: `Assigned AWB ${res.shipment.awb} to your Runsheet (${res.runsheetId}). 6-digit Delivery OTP sent to customer.`,
      });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not assign parcel." }, 400);
    }
  }

  if (action === "delivery-resend-otp") {
    try {
      const code = String(body?.code || "").trim();
      const target = String(body?.target || "customer_delivery") as "seller_pickup" | "customer_delivery";
      const res = resendDeliveryOrPickupOtp(code, target, session.name || session.email);
      return json({ ok: true, ...res });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not resend OTP." }, 400);
    }
  }

  if (action === "delivery-event") {
    try {
      const enr = getAgentEnrollment(session.email, session.role);
      if (enr.status !== "approved") return json({ ok: false, error: "Your ID is pending Hub Manager approval. Deliveries are locked until activated." }, 403);
      const code = String(body?.code || body?.awb || body?.orderId || "").trim();
      const event = String(body?.event || "").trim() as
        | "out_for_pickup"
        | "picked_up"
        | "hub_inscan"
        | "out_for_delivery"
        | "delivered"
        | "ndr";
      if (!code || !event) return json({ ok: false, error: "Barcode/AWB and event are required." }, 400);
      const res = applyDeliveryScanEvent({
        code,
        scannedCode: String(body?.scannedCode || ""),
        event,
        hubCode: String(body?.hubCode || "VGMF-PNQ"),
        by: session.name || session.email,
        agentEmail: session.email,
        riderName: String(body?.riderName || session.name || session.email),
        riderPhone: String(body?.riderPhone || ""),
        recipientName: String(body?.recipientName || ""),
        otp: String(body?.otp || ""),
        codCollected: Boolean(body?.codCollected),
        reason: String(body?.reason || ""),
        photoUrl: String(body?.photoUrl || ""),
      });
      return json({
        ok: true,
        ...res,
        message: res.sellerUpdate.message,
      });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not record delivery scan." }, 400);
    }
  }

  if (action === "delivery-bag") {
    try {
      const sub = String(body?.sub || "").trim();
      const by = session.name || session.email;
      if (sub === "create") {
        const bag = createBag(String(body?.originHub || "VGMF-PNQ"), String(body?.destHub || "VGMF-THN"), by, String(body?.sealNo || ""));
        return json({ ok: true, bag, message: `Created bag ${bag.id}.` });
      }
      if (sub === "add-awb") {
        const res = addAwbToBag(String(body?.bagId || ""), String(body?.code || ""), by);
        return json({ ok: true, ...res, message: `Scanned ${res.awb} into ${res.bag.id}.` });
      }
      if (sub === "seal") {
        const bag = sealBag(String(body?.bagId || ""), String(body?.sealNo || ""), by);
        return json({ ok: true, bag, message: `Bag ${bag.id} sealed (${bag.sealNo}).` });
      }
      if (sub === "dispatch") {
        const bag = dispatchBagTransfer(
          String(body?.bagId || ""),
          String(body?.destHub || ""),
          by,
          String(body?.vehicleNo || ""),
          String(body?.driverName || by)
        );
        return json({ ok: true, bag, message: `Bag ${bag.id} dispatched to ${bag.destHub} (${bag.awbs.length} parcels updated).` });
      }
      if (sub === "receive") {
        const bag = receiveBagTransfer(String(body?.bagId || ""), String(body?.hubCode || ""), by);
        return json({ ok: true, bag, message: `Bag ${bag.id} received & debagged (${bag.awbs.length} parcels updated).` });
      }
      return json({ ok: false, error: "Unknown delivery-bag action." }, 400);
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Bag operation failed." }, 400);
    }
  }

  if (action === "delivery-return") {
    try {
      const sub = String(body?.sub || "").trim();
      const by = session.name || session.email;
      const hubCode = String(body?.hubCode || "VGMF-PNQ");
      if (sub === "create") {
        const ret = createReturnShipmentRecord({
          code: String(body?.code || ""),
          kind: (String(body?.kind || "customer_return") as "customer_return" | "rto"),
          reason: String(body?.reason || ""),
          hubCode,
          by,
        });
        return json({
          ok: true,
          returnRecord: ret,
          message: `12-digit Return AWB ${ret.returnAwb} created. 6-digit Return OTP sent.`,
        });
      }
      const ret = applyReturnEvent({
        returnAwb: String(body?.returnAwb || ""),
        scannedCode: String(body?.scannedCode || ""),
        event: sub as "out_for_return_pickup" | "return_picked_up" | "return_hub_inscan" | "return_delivered_seller",
        hubCode,
        otp: String(body?.otp || ""),
        agentEmail: session.email,
        by,
      });
      return json({ ok: true, returnRecord: ret, message: `Return ${ret.returnAwb} updated to ${ret.status}.` });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Return operation failed." }, 400);
    }
  }

  if (action === "delivery-manifest") {
    try {
      const manifest = createVgmfManifest({
        type: (String(body?.type || "first_mile_pickup") as "first_mile_pickup" | "hub_transfer" | "last_mile_ofd"),
        hubCode: String(body?.hubCode || "VGMF-PNQ"),
        destHubCode: body?.destHubCode ? String(body.destHubCode) : undefined,
        riderName: String(body?.riderName || session.name || session.email),
        riderPhone: String(body?.riderPhone || ""),
        vehicleNo: String(body?.vehicleNo || ""),
        awbs: Array.isArray(body?.awbs) ? body.awbs.map(String) : [],
        bagIds: Array.isArray(body?.bagIds) ? body.bagIds.map(String) : [],
        notes: String(body?.notes || ""),
        by: session.name || session.email,
      });
      return json({
        ok: true,
        manifest,
        manifestUrl: `https://vaidyagogate.org/api/admin/vgmf-manifest?id=${encodeURIComponent(manifest.id)}`,
        message: `Manifest ${manifest.id} generated (${manifest.awbs.length} shipments).`,
      });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not generate manifest." }, 400);
    }
  }

  if (action === "delivery-track") {
    const code = String(body?.code || "").trim();
    if (!code) return json({ ok: false, error: "Enter or scan a 12-digit AWB, Order ID, Return AWB, or Bag ID." }, 400);
    const result = lookupInternalTracking(code);
    if (!result) return json({ ok: false, error: `No internal tracking found for "${code}".` }, 404);
    return json({ ok: true, result });
  }

  if (action === "delivery-upload-photo") {
    try {
      const dataUrl = String(body?.dataUrl || "");
      const prefix = String(body?.kind || "pod").replace(/[^a-z0-9_-]/gi, "");
      if (!dataUrl.startsWith("data:image/")) {
        return json({ ok: false, error: "Valid image dataUrl required." }, 400);
      }
      const comma = dataUrl.indexOf(",");
      const mimeMatch = dataUrl.slice(0, comma).match(/^data:([^;]+);base64$/);
      const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const ext = mime.includes("png") ? "png" : "jpg";
      const buf = Buffer.from(dataUrl.slice(comma + 1), "base64");
      const stored = await storeUploadedFile(new File([new Uint8Array(buf)], `vgmf-${prefix}-${Date.now()}.${ext}`, { type: mime }));
      return json({ ok: true, url: stored.url });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Photo upload failed." }, 400);
    }
  }

  return json({ ok: false, error: "Unknown portal action." }, 400);
}

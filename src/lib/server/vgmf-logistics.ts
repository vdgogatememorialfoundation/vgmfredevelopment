import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";
import { findShopOrder, listShopOrders, patchShopOrder } from "@/lib/server/shop-orders";
import { findShopShipment, listShopShipments, upsertShopShipment } from "@/lib/server/shop-shipments";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { readLogisticsSettings } from "@/lib/server/vgmf-logistics-settings";

export type HubType = "delivery_pickup" | "warehouse" | "sorting_facility" | "combined";

export type HubExecutive = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "hub_manager" | "inward_operator" | "sorting_operator" | "bagging_operator" | "dispatch_operator" | "transfer_coordinator" | "last_mile_supervisor" | "security_staff" | "pickup_executive" | "delivery_executive" | "sorter";
  shift?: string;
  station?: string;
  passwordHash?: string;
  addedAt: string;
};

export type VgmfHub = {
  code: string;
  name: string;
  type: HubType;
  city: string;
  state: string;
  pincode?: string;
  address?: string;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  executives: HubExecutive[];
};

export type VgmfBag = {
  id: string;
  originHub: string;
  destHub: string;
  sealNo?: string;
  status: "Open" | "Sealed" | "In Transit" | "Received" | "Debagged";
  awbs: string[];
  createdAt: string;
  createdBy: string;
  sealedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  receivedBy?: string;
  vehicleNo?: string;
  driverName?: string;
};

export type VgmfManifest = {
  id: string;
  type: "first_mile_pickup" | "hub_transfer" | "last_mile_ofd" | "inward_manifest" | "bag_manifest" | "vehicle_manifest" | "dispatch_manifest" | "return_manifest";
  hubCode: string;
  destHubCode?: string;
  riderName: string;
  riderPhone?: string;
  vehicleNo?: string;
  awbs: string[];
  bagIds: string[];
  createdAt: string;
  createdBy: string;
  notes?: string;
};

export type VgmfReturnRecord = {
  id: string;
  returnAwb: string; // 12-digit numeric AWB starting with 89
  originalOrderId: string;
  originalAwb?: string;
  kind: "customer_return" | "rto";
  reason: string;
  status:
    | "Initiated" | "Out for Return Pickup" | "Return Picked Up" | "At Return Hub" | "In Transit" | "At Destination Hub" | "Out for Seller Delivery" | "Returned to Seller";
  returnPickupOtp: string; // 6-digit OTP sent to customer for return pickup
  sellerHandoverOtp: string; // 6-digit OTP sent to seller for return handover
  hubCode: string;
  assignedAgentEmail?: string;
  assignedAgentName?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  address?: string;
  city?: string;
  pincode?: string;
  tracking: { at: string; status: string; location?: string }[];
  createdAt: string;
  createdBy: string;
};

export type SellerUpdateRecord = {
  id: string;
  at: string;
  orderId: string;
  awb: string;
  event: string;
  title: string;
  message: string;
  hubCode?: string;
  by: string;
  photoUrl?: string;
};


export type HubTransferRecord = {
  id: string;
  originHub: string;
  destHub: string;
  bagIds: string[];
  parcelCount: number;
  vehicleNo: string;
  driverName: string;
  driverPhone?: string;
  status: "In Transit" | "Received";
  departedAt: string;
  receivedAt?: string;
  receivedBy?: string;
  createdBy: string;
};

export type GateRegisterEntry = {
  id: string;
  hubCode: string;
  vehicleNo: string;
  driverName: string;
  driverPhone?: string;
  purpose: string;
  transferId?: string;
  bagCount: number;
  entryAt: string;
  exitAt?: string;
  securityBy: string;
  exitBy?: string;
};

export type HubExceptionRecord = {
  id: string;
  hubCode: string;
  code: string;
  category: "missing_shipment" | "damaged_parcel" | "wrong_hub" | "weight_discrepancy" | "unidentified_barcode" | "transfer_shortage";
  status: "Open" | "Resolved";
  notes: string;
  cctvRef?: string;
  createdAt: string;
  createdBy: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type HubAuditEntry = {
  id: string;
  at: string;
  hubCode: string;
  action: string;
  ref: string;
  by: string;
  detail: string;
};


export type AgentEnrollmentRecord = {
  email: string;
  name: string;
  phone?: string;
  vehicleNo?: string;
  hubCode: string;
  status: "pending" | "approved" | "rejected";
  role?: HubExecutive["role"];
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
  lastLocation?: { lat: number; lng: number; accuracy?: number; at: string; note?: string };
};

type LogisticsStore = {
  hubs: VgmfHub[];
  bags: VgmfBag[];
  manifests: VgmfManifest[];
  returns: VgmfReturnRecord[];
  transfers: HubTransferRecord[];
  gateEntries: GateRegisterEntry[];
  exceptions: HubExceptionRecord[];
  auditLog: HubAuditEntry[];
  agentEnrollments: AgentEnrollmentRecord[];
  sellerUpdates: SellerUpdateRecord[];
  seq: { awb: number; returnAwb: number; bag: number; manifest: number; transfer: number; exc: number };
};

const DEFAULT_HUBS: VgmfHub[] = [];

function storePath() {
  return dataFile("vgmf-logistics.json");
}

function sixDigitOtp(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function yymmdd() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function readLogisticsStore(): LogisticsStore {
  try {
    const raw = JSON.parse(readFileSync(storePath(), "utf8")) as Partial<LogisticsStore>;
    const hubs: VgmfHub[] =
      Array.isArray(raw.hubs)
        ? raw.hubs.map((h) => ({
            ...h,
            type: (h.type || "combined") as HubType,
            executives: Array.isArray(h.executives) ? h.executives : [],
          }))
        : DEFAULT_HUBS;
    return {
      hubs,
      bags: Array.isArray(raw.bags) ? raw.bags : [],
      manifests: Array.isArray(raw.manifests) ? raw.manifests : [],
      returns: Array.isArray(raw.returns) ? raw.returns : [],
      transfers: Array.isArray(raw.transfers) ? raw.transfers : [],
      gateEntries: Array.isArray(raw.gateEntries) ? raw.gateEntries : [],
      exceptions: Array.isArray(raw.exceptions) ? raw.exceptions : [],
      auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : [],
      agentEnrollments: Array.isArray(raw.agentEnrollments) ? raw.agentEnrollments : [],
      sellerUpdates: Array.isArray(raw.sellerUpdates) ? raw.sellerUpdates : [],
      seq: {
        awb: Number(raw.seq?.awb || 1000),
        returnAwb: Number(raw.seq?.returnAwb || 1000),
        bag: Number(raw.seq?.bag || 1000),
        manifest: Number(raw.seq?.manifest || 1000),
        transfer: Number(raw.seq?.transfer || 100),
        exc: Number(raw.seq?.exc || 100),
      },
    };
  } catch {
    return {
      hubs: DEFAULT_HUBS,
      bags: [],
      manifests: [],
      returns: [],
      transfers: [],
      gateEntries: [],
      exceptions: [],
      auditLog: [],
      agentEnrollments: [],
      sellerUpdates: [],
      seq: { awb: 1000, returnAwb: 1000, bag: 1000, manifest: 1000, transfer: 100, exc: 100 },
    };
  }
}

export function writeLogisticsStore(store: LogisticsStore) {
  const file = storePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(store, null, 2), "utf8");
}

export function findHub(store: LogisticsStore, code?: string): VgmfHub {
  const clean = String(code || "").trim().toUpperCase();
  return store.hubs.find((h) => h.code.toUpperCase() === clean) || store.hubs[0] || { code: clean || "UNASSIGNED", name: "No Hub Configured", type: "combined", city: "", state: "", executives: [] };
}

export function generateNextHubCode(city: string): string {
  const store = readLogisticsStore();
  const cfg = readLogisticsSettings().current;
  const prefix = (cfg.hubRules?.hubCodePrefix || "VGMF").trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "VGMF";
  const cityPart = (city || "HUB").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "HUB";
  let n = store.hubs.length + 1;
  let candidate = `${prefix}-${cityPart}-${String(n).padStart(3, "0")}`;
  while (store.hubs.some((h) => h.code.toUpperCase() === candidate)) {
    n += 1;
    candidate = `${prefix}-${cityPart}-${String(n).padStart(3, "0")}`;
  }
  return candidate;
}

export function addCustomHub(hub: { code?: string; name: string; type?: HubType; city: string; state?: string; pincode?: string; address?: string; lat?: number; lng?: number; mapsUrl?: string }): VgmfHub {
  const store = readLogisticsStore();
  if (!hub.name.trim() || !hub.city.trim()) {
    throw new Error("Hub name and city are required.");
  }
  const rawCode = (hub.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const code = rawCode || generateNextHubCode(hub.city);
  const type: HubType = hub.type || "combined";
  const existing = store.hubs.find((h) => h.code.toUpperCase() === code);
  if (existing) {
    existing.name = hub.name.trim();
    existing.type = type;
    existing.city = hub.city.trim();
    existing.state = hub.state?.trim() || existing.state;
    existing.pincode = hub.pincode?.trim() || existing.pincode;
    existing.address = hub.address?.trim() || existing.address;
    if (Number.isFinite(hub.lat)) existing.lat = hub.lat;
    if (Number.isFinite(hub.lng)) existing.lng = hub.lng;
    existing.mapsUrl = hub.mapsUrl?.trim() || existing.mapsUrl;
    writeLogisticsStore(store);
    return existing;
  }
  const created: VgmfHub = {
    code,
    name: hub.name.trim(),
    type,
    city: hub.city.trim(),
    state: hub.state?.trim() || "Maharashtra",
    pincode: hub.pincode?.trim() || "",
    address: hub.address?.trim() || "",
    lat: Number.isFinite(hub.lat) ? hub.lat : undefined,
    lng: Number.isFinite(hub.lng) ? hub.lng : undefined,
    mapsUrl: hub.mapsUrl?.trim() || (Number.isFinite(hub.lat) && Number.isFinite(hub.lng) ? `https://maps.google.com/?q=${hub.lat},${hub.lng}` : ""),
    executives: [],
  };
  store.hubs.push(created);
  writeLogisticsStore(store);
  return created;
}

export function addHubExecutive(
  hubCode: string,
  exec: { name: string; email: string; phone?: string; role?: HubExecutive["role"]; shift?: string; station?: string; passwordHash?: string }
): VgmfHub {
  const store = readLogisticsStore();
  const hub = findHub(store, hubCode);
  const name = exec.name.trim();
  const email = exec.email.trim().toLowerCase();
  if (!name || !email) throw new Error("Executive name and email/ID are required.");
  const existing = hub.executives.find((e) => e.email.toLowerCase() === email);
  if (existing) {
    existing.name = name;
    existing.phone = exec.phone?.trim() || existing.phone;
    existing.role = exec.role || existing.role;
    existing.shift = exec.shift?.trim() || existing.shift;
    existing.station = exec.station?.trim() || existing.station;
    if (exec.passwordHash) existing.passwordHash = exec.passwordHash;
  } else {
    hub.executives.push({
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name,
      email,
      phone: exec.phone?.trim() || "",
      role: exec.role || "delivery_executive",
      shift: exec.shift?.trim() || "Morning (08:00–16:00)",
      station: exec.station?.trim() || "General",
      ...(exec.passwordHash ? { passwordHash: exec.passwordHash } : {}),
      addedAt: new Date().toISOString(),
    });
  }
  writeLogisticsStore(store);
  return hub;
}

export function removeHubExecutive(hubCode: string, execId: string): VgmfHub {
  const store = readLogisticsStore();
  const hub = findHub(store, hubCode);
  hub.executives = hub.executives.filter((e) => e.id !== execId);
  writeLogisticsStore(store);
  return hub;
}

const ALLOWED_SELLER_EVENTS = new Set([
  "awb_generated",
  "out_for_pickup",
  "picked_up",
  "pickup_otp_sent",
  "ndr",
  "return_initiated",
  "return_picked_up",
  "return_delivered_seller",
]);

function recordAudit(store: LogisticsStore, hubCode: string, action: string, ref: string, by: string, detail: string) {
  store.auditLog = [
    { id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, at: new Date().toISOString(), hubCode, action, ref, by, detail },
    ...store.auditLog,
  ].slice(0, 500);
}

function recordSellerUpdate(
  store: LogisticsStore,
  entry: Omit<SellerUpdateRecord, "id" | "at"> & { at?: string },
  notifySeller = false,
  extraEmailNote = "",
  whatsAppOtp = ""
) {
  const at = entry.at || new Date().toISOString();
  const rec: SellerUpdateRecord = {
    id: `su-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at,
    ...entry,
  };
  // Only record & send seller updates for pickup, out-for-pickup, picked-up, failed attempts (NDR), and return handovers — NO in-transit updates to seller!
  if (ALLOWED_SELLER_EVENTS.has(entry.event)) {
    store.sellerUpdates = [rec, ...store.sellerUpdates].slice(0, 500);
  }
  if (notifySeller && ALLOWED_SELLER_EVENTS.has(entry.event)) {
    const sellerEmail = process.env.VGMF_SELLER_EMAIL || "orders@vaidyagogate.org";
    void sendMobileEmail(
      sellerEmail,
      `[VGMF Delivery] ${rec.title} · Order #${rec.orderId} (AWB ${rec.awb})`,
      `${rec.title}\n\nOrder ID: #${rec.orderId}\n12-Digit VGMF AWB: ${rec.awb}\nDetails: ${rec.message}${extraEmailNote ? `\n\n${extraEmailNote}` : ""}\nUpdated By: ${rec.by}\nTime: ${new Date(at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
    ).catch(() => undefined);
    const sellerPhone = process.env.VGMF_SELLER_PHONE || readLogisticsSettings().current.general?.supportPhone || "";
    if (whatsAppOtp && sellerPhone) {
      void import("@/lib/server/whatsapp-inbox")
        .then(({ sendWhatsAppAlert }) => sendWhatsAppAlert("otp", { phone: sellerPhone, name: "VGMF Store", params: [whatsAppOtp] }))
        .catch(() => false);
    }
  }
  return rec;
}


export function isVgmfOwnShipment(s: { provider?: string; courier?: string; awb?: string } | null | undefined) {
  if (!s) return false;
  return s.provider === "local" || /vgmf express|vaidya gogate memorial foundation/i.test(String(s.courier || "")) || /^8[89]\d{10}$/.test(String(s.awb || ""));
}

export function findShipmentByCode(code: string) {
  const clean = String(code || "").trim();
  if (!clean) return null;
  const upper = clean.toUpperCase();
  const all = listShopShipments();
  return (
    all.find((s) => String(s.awb || "").toUpperCase() === upper) ||
    all.find((s) => String(s.orderId || "").toUpperCase() === upper) ||
    all.find((s) => String(s.id || "").toUpperCase() === upper) ||
    null
  );
}

/** Generates a strict 12-digit numeric AWB (e.g. 882611211001) + 6-digit Pickup & Delivery OTPs. */
export function generateVgmfAwb(orderId: string, hubCode: string, by: string) {
  const order = findShopOrder(orderId);
  if (!order) throw new Error(`Order #${orderId} not found.`);
  const store = readLogisticsStore();
  const hub = findHub(store, hubCode);

  const existing = findShopShipment(order.id);
  if (existing && existing.provider === "local" && /^\d{12}$/.test(String(existing.awb || ""))) {
    return { shipment: existing, alreadyExists: true };
  }

  store.seq.awb += 1;
  const seq4 = String(store.seq.awb % 10000).padStart(4, "0");
  const awb = `88${yymmdd()}${seq4}`; // Strictly 12 digits: 88 + YYMMDD + 4-digit seq
  const at = new Date().toISOString();
  const pickupOtp = sixDigitOtp();
  const deliveryOtp = sixDigitOtp();

  const shipment = {
    id: `vgmf-${Date.now()}`,
    orderId: order.id,
    courier: "Vaidya Gogate Memorial Foundation",
    provider: "local" as const,
    awb,
    charges: Number(order.shipping || 0),
    toAddress: order.deliveryAddress,
    items: (order.items || []).map((i) => ({
      sku: i.sku || i.bookId,
      title: i.title,
      quantity: i.quantity,
    })),
    status: "Booked" as const,
    generatedAt: at,
    live: true,
    pickupOtp,
    deliveryOtp,
    originHubCode: hub.code,
    currentHubCode: hub.code,
    hideAgentLocation: true,
    trackingUrl: `https://vaidyagogate.org/track-shipment?awb=${encodeURIComponent(awb)}`,
    note: `VGMF Internal Courier · 12-Digit AWB · Origin ${hub.name} (${hub.code})`,
    tracking: [
      {
        at,
        status: `VGMF 12-Digit AWB Generated (${hub.code})`,
        location: hub.city,
      },
    ],
  };

  upsertShopShipment(shipment as unknown as Parameters<typeof upsertShopShipment>[0]);
  patchShopOrder(order.id, {
    courierName: "Vaidya Gogate Memorial Foundation",
    trackingId: awb,
    history: [
      ...(order.history ?? []),
      { at, status: order.status, by, note: `Vaidya Gogate Memorial Foundation 12-digit AWB generated: ${awb} (${hub.name})` },
    ],
  });

  recordSellerUpdate(
    store,
    {
      at,
      orderId: order.id,
      awb,
      event: "awb_generated",
      title: "VGMF 12-Digit AWB Generated",
      message: `12-digit AWB ${awb} generated at ${hub.name}. 6-digit Seller Pickup OTP: ${pickupOtp}.`,
      hubCode: hub.code,
      by,
    },
    true,
    `Your 6-Digit Seller Pickup OTP for Order #${order.id} (AWB ${awb}) is: ${pickupOtp}\nShare this OTP with the VGMF Pickup Executive after they scan the parcel barcode.`,
    pickupOtp
  );
  writeLogisticsStore(store);
  return { shipment, alreadyExists: false };
}

/** Delivery agent scans a parcel to assign it to their own ID and add it to their Runsheet (+ sends 6-digit Customer Delivery OTP). */
export function assignParcelToAgent(input: {
  code: string;
  agentEmail: string;
  agentName: string;
  agentPhone?: string;
  hubCode: string;
}) {
  const store = readLogisticsStore();
  const hub = findHub(store, input.hubCode);
  const shipment = findShipmentByCode(input.code);
  if (!shipment) throw new Error(`No shipment found for barcode "${input.code}".`);
  const order = findShopOrder(shipment.orderId);
  const at = new Date().toISOString();
  const raw = shipment as unknown as Record<string, unknown>;
  const deliveryOtp = /^\d{6}$/.test(String(raw.deliveryOtp || "")) ? String(raw.deliveryOtp) : sixDigitOtp();
  const runsheetId = `RS-${hub.code}-${yymmdd()}-${input.agentEmail.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
  const tracking = Array.isArray(shipment.tracking) ? [...shipment.tracking] : [];
  tracking.push({
    at,
    status: `Out for Delivery · Assigned to ${input.agentName} (Runsheet ${runsheetId})`,
    location: order?.deliveryAddress?.city ? `${order.deliveryAddress.city}, ${order.deliveryAddress.state || "India"}` : hub.city,
  });

  const updated = {
    ...shipment,
    status: "Out for Delivery" as const,
    agentName: input.agentName,
    agentPhone: input.agentPhone || shipment.agentPhone,
    assignedAgentEmail: input.agentEmail.toLowerCase(),
    assignedAgentName: input.agentName,
    runsheetId,
    deliveryOtp,
    currentHubCode: hub.code,
    outwardHubCode: hub.code,
    hideAgentLocation: true,
    tracking,
  };
  upsertShopShipment(updated as unknown as Parameters<typeof upsertShopShipment>[0]);

  if (order) {
    patchShopOrder(order.id, {
      status: "Out for Delivery",
      history: [
        ...(order.history ?? []),
        { at, status: "Out for Delivery", by: input.agentName, note: `Assigned to ${input.agentName} (Runsheet ${runsheetId}) · 6-digit Delivery OTP sent to customer` },
      ],
    });
    const custEmail = order.deliveryAddress?.email || order.accountEmail;
    if (custEmail) {
      void sendMobileEmail(
        custEmail,
        `Out for Delivery · 6-Digit Delivery OTP for Order #${order.id}: ${deliveryOtp}`,
        `Namaste ${order.deliveryAddress?.fullName || "Customer"},\n\nYour VGMF Order #${order.id} (AWB ${shipment.awb}) is Out for Delivery today.\n\nYour mandatory 6-digit Delivery OTP is: ${deliveryOtp}\n\nPlease share this OTP with our VGMF Delivery Executive when receiving your parcel.`
      ).catch(() => undefined);
    }
  }

  recordSellerUpdate(store, {
    at,
    orderId: shipment.orderId,
    awb: String(shipment.awb || shipment.orderId),
    event: "out_for_delivery",
    title: "Assigned to Delivery Runsheet (OFD)",
    message: `Scanned & assigned to ${input.agentName} (${runsheetId}). 6-digit Delivery OTP sent to customer.`,
    hubCode: hub.code,
    by: input.agentName,
  });
  writeLogisticsStore(store);
  return { shipment: updated, runsheetId, deliveryOtp };
}

export function resendDeliveryOrPickupOtp(code: string, target: "seller_pickup" | "customer_delivery", by: string) {
  const shipment = findShipmentByCode(code);
  if (!shipment) throw new Error(`Shipment "${code}" not found.`);
  const order = findShopOrder(shipment.orderId);
  const raw = shipment as unknown as Record<string, unknown>;
  const store = readLogisticsStore();

  if (target === "seller_pickup") {
    const otp = /^\d{6}$/.test(String(raw.pickupOtp || "")) ? String(raw.pickupOtp) : sixDigitOtp();
    upsertShopShipment({ ...shipment, pickupOtp: otp } as unknown as Parameters<typeof upsertShopShipment>[0]);
    recordSellerUpdate(
      store,
      {
        orderId: shipment.orderId,
        awb: String(shipment.awb || shipment.orderId),
        event: "pickup_otp_sent",
        title: "6-Digit Seller Pickup OTP Sent",
        message: `6-digit Seller Pickup OTP resent for Order #${shipment.orderId} (AWB ${shipment.awb}): ${otp}`,
        by,
      },
      true,
      `6-Digit Seller Pickup OTP for Order #${shipment.orderId} (AWB ${shipment.awb}): ${otp}`,
      otp
    );
    writeLogisticsStore(store);
    return { message: "6-digit Seller Pickup OTP sent to Seller.", otpSent: true };
  }

  const otp = /^\d{6}$/.test(String(raw.deliveryOtp || "")) ? String(raw.deliveryOtp) : sixDigitOtp();
  upsertShopShipment({ ...shipment, deliveryOtp: otp } as unknown as Parameters<typeof upsertShopShipment>[0]);
  const custEmail = order?.deliveryAddress?.email || order?.accountEmail;
  if (custEmail) {
    void sendMobileEmail(
      custEmail,
      `Your 6-Digit Delivery OTP for VGMF Order #${shipment.orderId}: ${otp}`,
      `Namaste ${order?.deliveryAddress?.fullName || "Customer"},\n\nYour mandatory 6-digit Delivery OTP for Order #${shipment.orderId} (AWB ${shipment.awb}) is: ${otp}\n\nPlease share this OTP with the VGMF Delivery Executive upon delivery.`
    ).catch(() => undefined);
  }
  return { message: "6-digit Delivery OTP sent to Customer.", otpSent: true };
}

export function applyDeliveryScanEvent(input: {
  code: string;
  scannedCode?: string;
  event: "out_for_pickup" | "picked_up" | "hub_inscan" | "out_for_delivery" | "delivered" | "ndr";
  hubCode?: string;
  by: string;
  agentEmail?: string;
  riderName?: string;
  riderPhone?: string;
  recipientName?: string;
  otp?: string;
  codCollected?: boolean;
  reason?: string;
  photoUrl?: string;
}) {
  const store = readLogisticsStore();
  const hub = findHub(store, input.hubCode);
  let shipment = findShipmentByCode(input.code);
  if (!shipment) {
    const order = findShopOrder(input.code.trim());
    if (order && (input.event === "out_for_pickup" || input.event === "picked_up")) {
      const created = generateVgmfAwb(order.id, hub.code, input.by);
      shipment = created.shipment as unknown as typeof shipment;
    }
  }
  if (!shipment) {
    throw new Error(`No shipment or order found for barcode "${input.code}".`);
  }

  const raw = shipment as unknown as Record<string, unknown>;
  const order = findShopOrder(shipment.orderId);
  const at = new Date().toISOString();
  const awb = String(shipment.awb || shipment.orderId);
  const rider = input.riderName?.trim() || input.by;
  const tracking = Array.isArray(shipment.tracking) ? [...shipment.tracking] : [];

  // Ensure 6-digit OTPs exist
  const pickupOtp = /^\d{6}$/.test(String(raw.pickupOtp || "")) ? String(raw.pickupOtp) : sixDigitOtp();
  const deliveryOtp = /^\d{6}$/.test(String(raw.deliveryOtp || "")) ? String(raw.deliveryOtp) : sixDigitOtp();

  let nextShipmentStatus = shipment.status || "In Transit";
  let nextOrderStatus = order?.status;
  let scanStatus = "";
  let scanLocation = hub.city;
  let sellerTitle = "";
  let sellerMsg = "";
  let notifySeller = false;
  let extraEmailNote = "";
  let inwardHubCode = raw.inwardHubCode as string | undefined;
  let outwardHubCode = raw.outwardHubCode as string | undefined;

  if (input.event === "out_for_pickup") {
    nextShipmentStatus = "Booked";
    scanStatus = `Out for Pickup · Executive ${rider}`;
    sellerTitle = "Out for Pickup (6-Digit Pickup OTP Sent)";
    sellerMsg = `VGMF Pickup Executive ${rider} is Out for Pickup for Order #${shipment.orderId} (AWB ${awb}). 6-digit Seller Pickup OTP: ${pickupOtp}.`;
    notifySeller = true;
    extraEmailNote = `Mandatory 6-Digit Seller Pickup OTP: ${pickupOtp}\nThe executive must scan AWB ${awb} AND enter this 6-digit OTP to complete pickup.`;
  } else if (input.event === "picked_up") {
    // MANDATORY barcode scan + MANDATORY 6-digit Seller Pickup OTP
    const scanned = String(input.scannedCode || "").trim().toUpperCase();
    if (!scanned || (scanned !== awb.toUpperCase() && scanned !== shipment.orderId.toUpperCase())) {
      throw new Error(`Barcode scan mandatory! Scan AWB "${awb}" (or Order #${shipment.orderId}) before completing pickup.`);
    }
    const enteredOtp = String(input.otp || "").replace(/\D/g, "").trim();
    if (enteredOtp.length !== 6) {
      throw new Error("Mandatory 6-digit Seller Pickup OTP is required to confirm pickup.");
    }
    if (enteredOtp !== pickupOtp) {
      throw new Error("Incorrect 6-digit Seller Pickup OTP. Please verify the OTP sent to the Seller.");
    }
    nextShipmentStatus = "Picked Up";
    nextOrderStatus = "Shipped";
    inwardHubCode = hub.code;
    scanStatus = `Pickup From Seller (Barcode + 6-Digit OTP Verified) · ${hub.name}`;
    sellerTitle = "Picked Up from Seller (OTP & Scan Verified)";
    sellerMsg = `Parcel picked up from seller by ${rider} for Order #${shipment.orderId} (AWB ${awb}).`;
    notifySeller = true;
  } else if (input.event === "hub_inscan") {
    nextShipmentStatus = "In Transit";
    inwardHubCode = hub.code;
    scanStatus = `Inward Scan at ${hub.name} (${hub.code})`;
    sellerTitle = "Hub Inward Scan";
    sellerMsg = `Parcel scanned inward at ${hub.name} (${hub.city}) by ${rider}.`;
  } else if (input.event === "out_for_delivery") {
    nextShipmentStatus = "Out for Delivery";
    nextOrderStatus = "Out for Delivery";
    outwardHubCode = hub.code;
    scanStatus = `Out for Delivery · Executive ${rider}`;
    scanLocation = order?.deliveryAddress?.city ? `${order.deliveryAddress.city}, ${order.deliveryAddress.state || "India"}` : hub.city;
    sellerTitle = "Out for Delivery (6-Digit Delivery OTP Sent)";
    sellerMsg = `Executive ${rider} is Out for Delivery for Order #${shipment.orderId} (AWB ${awb}). 6-digit Delivery OTP sent to customer.`;
    const custEmail = order?.deliveryAddress?.email || order?.accountEmail;
    if (custEmail) {
      void sendMobileEmail(
        custEmail,
        `Out for Delivery · 6-Digit Delivery OTP for Order #${shipment.orderId}: ${deliveryOtp}`,
        `Namaste ${order?.deliveryAddress?.fullName || "Customer"},\n\nYour VGMF Order #${shipment.orderId} (AWB ${awb}) is Out for Delivery.\n\nYour mandatory 6-digit Delivery OTP is: ${deliveryOtp}\n\nPlease share this OTP with our VGMF Delivery Executive upon delivery.`
      ).catch(() => undefined);
    }
  } else if (input.event === "delivered") {
    // MANDATORY barcode scan + MANDATORY 6-digit Customer Delivery OTP
    const scanned = String(input.scannedCode || "").trim().toUpperCase();
    if (!scanned || (scanned !== awb.toUpperCase() && scanned !== shipment.orderId.toUpperCase())) {
      throw new Error(`Barcode scan mandatory! Scan AWB "${awb}" before completing delivery.`);
    }
    const enteredOtp = String(input.otp || "").replace(/\D/g, "").trim();
    if (enteredOtp.length !== 6) {
      throw new Error("Mandatory 6-digit Customer Delivery OTP is required to complete delivery.");
    }
    if (enteredOtp !== deliveryOtp) {
      throw new Error("Incorrect 6-digit Customer Delivery OTP. Please verify the OTP sent to the Customer.");
    }
    nextShipmentStatus = "Delivered";
    nextOrderStatus = "Delivered";
    const recName = input.recipientName?.trim() || order?.deliveryAddress?.fullName || "Customer";
    scanStatus = `Delivered to ${recName} (Barcode + 6-Digit OTP Verified)${input.codCollected ? " · COD Collected" : ""}`;
    scanLocation = order?.deliveryAddress?.city ? `${order.deliveryAddress.city}, ${order.deliveryAddress.state || "India"}` : hub.city;
    sellerTitle = "Delivered (OTP & Scan Verified)";
    sellerMsg = `Order #${shipment.orderId} (AWB ${awb}) delivered to ${recName} by ${rider}.${input.codCollected ? " COD collected." : ""}`;
    notifySeller = true;
  } else if (input.event === "ndr") {
    nextShipmentStatus = "In Transit";
    const reason = input.reason?.trim() || "Customer unavailable";
    scanStatus = `Delivery Attempt Failed — ${reason}`;
    scanLocation = order?.deliveryAddress?.city ? `${order.deliveryAddress.city}, ${order.deliveryAddress.state || "India"}` : hub.city;
    sellerTitle = "Delivery Attempt Failed (NDR)";
    sellerMsg = `Delivery attempt failed for Order #${shipment.orderId} (AWB ${awb}): ${reason}.`;
    notifySeller = true;
  }

  tracking.push({
    at,
    status: scanStatus,
    location: scanLocation,
  });

  const updatedShipment = {
    ...shipment,
    status: nextShipmentStatus,
    agentName: input.event === "out_for_delivery" || input.event === "out_for_pickup" ? rider : shipment.agentName,
    agentPhone: input.riderPhone || shipment.agentPhone,
    assignedAgentEmail: input.event === "out_for_delivery" && input.agentEmail ? input.agentEmail.toLowerCase() : raw.assignedAgentEmail,
    assignedAgentName: input.event === "out_for_delivery" ? rider : raw.assignedAgentName,
    pickupOtp,
    deliveryOtp,
    currentHubCode: hub.code,
    inwardHubCode,
    outwardHubCode,
    hideAgentLocation: true,
    podPhoto: input.event === "delivered" && input.photoUrl ? input.photoUrl : raw.podPhoto,
    pickupPhoto: input.event === "picked_up" && input.photoUrl ? input.photoUrl : raw.pickupPhoto,
    tracking,
  };

  upsertShopShipment(updatedShipment as unknown as Parameters<typeof upsertShopShipment>[0]);

  if (order) {
    const patch: Record<string, unknown> = {
      history: [
        ...(order.history ?? []),
        {
          at,
          status: nextOrderStatus || order.status,
          by: rider,
          note: `${sellerTitle}: ${scanStatus}`,
        },
      ],
    };
    if (nextOrderStatus && nextOrderStatus !== order.status) {
      patch.status = nextOrderStatus;
    }
    if (input.event === "delivered" && input.codCollected && order.paymentStatus !== "Paid") {
      patch.paymentStatus = "Paid";
      patch.amountPaid = order.total;
      patch.paidAt = at;
    }
    patchShopOrder(order.id, patch);
  }

  const sellerUpdate = recordSellerUpdate(
    store,
    {
      at,
      orderId: shipment.orderId,
      awb,
      event: input.event,
      title: sellerTitle,
      message: sellerMsg,
      hubCode: hub.code,
      by: rider,
      photoUrl: input.photoUrl,
    },
    notifySeller,
    extraEmailNote,
    input.event === "out_for_pickup" ? pickupOtp : ""
  );
  writeLogisticsStore(store);

  return { shipment: updatedShipment, sellerUpdate };
}

export function createBag(originHubCode: string, destHubCode: string, by: string, sealNo?: string) {
  const store = readLogisticsStore();
  const origin = findHub(store, originHubCode);
  const dest = findHub(store, destHubCode);
  store.seq.bag += 1;
  const bag: VgmfBag = {
    id: `BAG-VGMF-${yymmdd()}-${String(store.seq.bag).padStart(4, "0")}`,
    originHub: origin.code,
    destHub: dest.code,
    sealNo: sealNo?.trim() || "",
    status: "Open",
    awbs: [],
    createdAt: new Date().toISOString(),
    createdBy: by,
  };
  store.bags = [bag, ...store.bags].slice(0, 300);
  writeLogisticsStore(store);
  return bag;
}

export function addAwbToBag(bagId: string, code: string, by: string) {
  const store = readLogisticsStore();
  const bag = store.bags.find((b) => b.id.toUpperCase() === bagId.trim().toUpperCase());
  if (!bag) throw new Error(`Bag ${bagId} not found.`);
  if (bag.status !== "Open") throw new Error(`Bag ${bag.id} is already ${bag.status}.`);
  const shipment = findShipmentByCode(code);
  if (!shipment) throw new Error(`Shipment / Order "${code}" not found.`);
  const awb = String(shipment.awb || shipment.orderId);
  if (!bag.awbs.includes(awb)) {
    bag.awbs.push(awb);
  }
  const hub = findHub(store, bag.originHub);
  const at = new Date().toISOString();
  const tracking = Array.isArray(shipment.tracking) ? [...shipment.tracking] : [];
  tracking.push({
    at,
    status: `Bagged in ${bag.id} at ${hub.name}`,
    location: hub.city,
  });
  upsertShopShipment({
    ...shipment,
    status: "In Transit",
    currentHubCode: hub.code,
    outwardHubCode: hub.code,
    tracking,
  } as unknown as Parameters<typeof upsertShopShipment>[0]);
  recordSellerUpdate(store, {
    at,
    orderId: shipment.orderId,
    awb,
    event: "bagged",
    title: "Internal Bagging",
    message: `Parcel ${awb} added to Bag ${bag.id} at ${hub.name} (Dest: ${bag.destHub}).`,
    hubCode: hub.code,
    by,
  });
  writeLogisticsStore(store);
  return { bag, awb };
}

export function sealBag(bagId: string, sealNo: string, by: string) {
  const store = readLogisticsStore();
  const bag = store.bags.find((b) => b.id.toUpperCase() === bagId.trim().toUpperCase());
  if (!bag) throw new Error(`Bag ${bagId} not found.`);
  if (!bag.awbs.length) throw new Error("Scan at least one parcel into the bag before sealing.");
  const at = new Date().toISOString();
  bag.sealNo = sealNo?.trim() || bag.sealNo || `SEAL-${Date.now().toString().slice(-6)}`;
  bag.status = "Sealed";
  bag.sealedAt = at;
  const hub = findHub(store, bag.originHub);
  for (const awb of bag.awbs) {
    const shipment = findShipmentByCode(awb);
    if (!shipment) continue;
    const tracking = Array.isArray(shipment.tracking) ? [...shipment.tracking] : [];
    tracking.push({
      at,
      status: `Bag ${bag.id} Sealed (Seal ${bag.sealNo}) at ${hub.name}`,
      location: hub.city,
    });
    upsertShopShipment({ ...shipment, outwardHubCode: hub.code, tracking } as unknown as Parameters<typeof upsertShopShipment>[0]);
  }
  writeLogisticsStore(store);
  return bag;
}

export function dispatchBagTransfer(bagId: string, destHubCode: string, by: string, vehicleNo?: string, driverName?: string) {
  const store = readLogisticsStore();
  const bag = store.bags.find((b) => b.id.toUpperCase() === bagId.trim().toUpperCase());
  if (!bag) throw new Error(`Bag ${bagId} not found.`);
  if (!bag.awbs.length) throw new Error("Bag is empty.");
  const origin = findHub(store, bag.originHub);
  const dest = findHub(store, destHubCode || bag.destHub);
  const at = new Date().toISOString();
  bag.destHub = dest.code;
  bag.status = "In Transit";
  bag.dispatchedAt = at;
  bag.vehicleNo = vehicleNo?.trim() || bag.vehicleNo;
  bag.driverName = driverName?.trim() || bag.driverName || by;

  for (const awb of bag.awbs) {
    const shipment = findShipmentByCode(awb);
    if (!shipment) continue;
    const tracking = Array.isArray(shipment.tracking) ? [...shipment.tracking] : [];
    tracking.push({
      at,
      status: `Dispatched to ${dest.name} (Bag ${bag.id})`,
      location: origin.city,
    });
    upsertShopShipment({
      ...shipment,
      status: "In Transit",
      outwardHubCode: origin.code,
      inwardHubCode: dest.code,
      tracking,
    } as unknown as Parameters<typeof upsertShopShipment>[0]);
    recordSellerUpdate(store, {
      at,
      orderId: shipment.orderId,
      awb,
      event: "hub_transfer_dispatched",
      title: "Hub Transfer Dispatched",
      message: `Dispatched from ${origin.name} to ${dest.name} in Bag ${bag.id}.`,
      hubCode: origin.code,
      by,
    });
  }
  writeLogisticsStore(store);
  return bag;
}

export function receiveBagTransfer(bagId: string, hubCode: string, by: string) {
  const store = readLogisticsStore();
  const bag = store.bags.find((b) => b.id.toUpperCase() === bagId.trim().toUpperCase());
  if (!bag) throw new Error(`Bag ${bagId} not found.`);
  const dest = findHub(store, hubCode || bag.destHub);
  const at = new Date().toISOString();
  bag.status = "Debagged";
  bag.receivedAt = at;
  bag.receivedBy = by;

  for (const awb of bag.awbs) {
    const shipment = findShipmentByCode(awb);
    if (!shipment) continue;
    const tracking = Array.isArray(shipment.tracking) ? [...shipment.tracking] : [];
    tracking.push({
      at,
      status: `Received at ${dest.name} (Debagged from ${bag.id})`,
      location: dest.city,
    });
    upsertShopShipment({
      ...shipment,
      status: "In Transit",
      currentHubCode: dest.code,
      inwardHubCode: dest.code,
      tracking,
    } as unknown as Parameters<typeof upsertShopShipment>[0]);
    recordSellerUpdate(store, {
      at,
      orderId: shipment.orderId,
      awb,
      event: "hub_transfer_received",
      title: "Hub Transfer Received",
      message: `Arrived & debagged at ${dest.name} (${dest.city}) from Bag ${bag.id}.`,
      hubCode: dest.code,
      by,
    });
  }
  writeLogisticsStore(store);
  return bag;
}

/* ==================== RETURN MANAGEMENT (RTO & CUSTOMER RETURNS) ==================== */

export function createReturnShipmentRecord(input: {
  code: string;
  kind: "customer_return" | "rto";
  reason: string;
  hubCode: string;
  by: string;
}) {
  const store = readLogisticsStore();
  const hub = findHub(store, input.hubCode);
  const shipment = findShipmentByCode(input.code);
  const order = shipment ? findShopOrder(shipment.orderId) : findShopOrder(input.code.trim());
  if (!order) throw new Error(`Order / AWB "${input.code}" not found.`);

  store.seq.returnAwb += 1;
  const seq4 = String(store.seq.returnAwb % 10000).padStart(4, "0");
  const returnAwb = `89${yymmdd()}${seq4}`; // 12-digit Return AWB
  const returnPickupOtp = sixDigitOtp();
  const sellerHandoverOtp = sixDigitOtp();
  const at = new Date().toISOString();

  const rec: VgmfReturnRecord = {
    id: returnAwb,
    returnAwb,
    originalOrderId: order.id,
    originalAwb: shipment?.awb || order.trackingId || "",
    kind: input.kind,
    reason: input.reason.trim() || (input.kind === "rto" ? "RTO — Undelivered" : "Customer return requested"),
    status: "Initiated",
    returnPickupOtp,
    sellerHandoverOtp,
    hubCode: hub.code,
    customerName: order.deliveryAddress?.fullName || "Customer",
    customerPhone: order.deliveryAddress?.phone || "",
    customerEmail: order.deliveryAddress?.email || order.accountEmail || "",
    address: order.deliveryAddress?.line1 || "",
    city: order.deliveryAddress?.city || "",
    pincode: order.deliveryAddress?.pincode || "",
    tracking: [
      {
        at,
        status: `${input.kind === "rto" ? "RTO" : "Customer Return"} Initiated · 12-Digit Return AWB ${returnAwb}`,
        location: hub.city,
      },
    ],
    createdAt: at,
    createdBy: input.by,
  };

  store.returns = [rec, ...store.returns].slice(0, 300);

  if (rec.customerEmail && input.kind === "customer_return") {
    void sendMobileEmail(
      rec.customerEmail,
      `Return Pickup Initiated · 6-Digit Return OTP for Order #${order.id}: ${returnPickupOtp}`,
      `Namaste ${rec.customerName},\n\nYour return for VGMF Order #${order.id} has been initiated (Return AWB: ${returnAwb}).\n\nYour mandatory 6-digit Return Pickup OTP is: ${returnPickupOtp}\nShare this OTP with our VGMF Executive during return pickup.`
    ).catch(() => undefined);
  }

  recordSellerUpdate(
    store,
    {
      at,
      orderId: order.id,
      awb: returnAwb,
      event: "return_initiated",
      title: input.kind === "rto" ? "RTO Initiated" : "Customer Return Initiated",
      message: `12-digit Return AWB ${returnAwb} created for Order #${order.id} (${rec.reason}). Seller Handover OTP: ${sellerHandoverOtp}.`,
      hubCode: hub.code,
      by: input.by,
    },
    true,
    `6-Digit Seller Return Handover OTP for Return AWB ${returnAwb}: ${sellerHandoverOtp}`
  );
  writeLogisticsStore(store);
  return rec;
}

export function applyReturnEvent(input: {
  returnAwb: string;
  scannedCode?: string;
  event:
    | "out_for_return_pickup"
    | "return_picked_up"
    | "return_hub_inscan"
    | "return_in_transit"
    | "return_dest_hub_inscan"
    | "return_out_for_seller"
    | "return_delivered_seller";
  hubCode: string;
  otp?: string;
  agentEmail?: string;
  by: string;
}) {
  const store = readLogisticsStore();
  const hub = findHub(store, input.hubCode);
  const rec = store.returns.find(
    (r) => r.returnAwb.toUpperCase() === input.returnAwb.trim().toUpperCase() || r.id.toUpperCase() === input.returnAwb.trim().toUpperCase()
  );
  if (!rec) throw new Error(`Return AWB "${input.returnAwb}" not found.`);

  const at = new Date().toISOString();
  let scanText = "";

  if (input.event === "out_for_return_pickup") {
    rec.status = "Out for Return Pickup";
    rec.assignedAgentEmail = input.agentEmail?.toLowerCase() || rec.assignedAgentEmail;
    rec.assignedAgentName = input.by;
    scanText = `Out for Return Pickup · Executive ${input.by}`;
    if (rec.customerEmail) {
      void sendMobileEmail(
        rec.customerEmail,
        `Out for Return Pickup · 6-Digit Return OTP: ${rec.returnPickupOtp}`,
        `Namaste ${rec.customerName},\n\nVGMF Executive ${input.by} is Out for Return Pickup for Order #${rec.originalOrderId} (Return AWB ${rec.returnAwb}).\n\nMandatory 6-digit Return Pickup OTP: ${rec.returnPickupOtp}`
      ).catch(() => undefined);
    }
  } else if (input.event === "return_picked_up") {
    const scanned = String(input.scannedCode || "").trim().toUpperCase();
    if (!scanned || (scanned !== rec.returnAwb.toUpperCase() && scanned !== rec.originalOrderId.toUpperCase() && scanned !== (rec.originalAwb || "").toUpperCase())) {
      throw new Error(`Barcode scan mandatory! Scan Return AWB "${rec.returnAwb}" before confirming return pickup.`);
    }
    if (rec.kind === "customer_return") {
      const entered = String(input.otp || "").replace(/\D/g, "").trim();
      if (entered.length !== 6 || entered !== rec.returnPickupOtp) {
        throw new Error("Incorrect or missing 6-digit Customer Return Pickup OTP.");
      }
    }
    rec.status = "Return Picked Up";
    scanText = `Shipment picked up from customer by Vaidya Gogate Memorial Foundation (${input.by})`;
  } else if (input.event === "return_hub_inscan") {
    rec.status = "At Return Hub";
    rec.hubCode = hub.code;
    scanText = `Shipment arrived at origin facility - ${hub.name} (${hub.code})`;
  } else if (input.event === "return_in_transit") {
    rec.status = "In Transit";
    rec.hubCode = hub.code;
    scanText = `Shipment in transit / transferred from ${hub.name} (${hub.code})`;
  } else if (input.event === "return_dest_hub_inscan") {
    rec.status = "At Destination Hub";
    rec.hubCode = hub.code;
    scanText = `Shipment arrived at destination return hub - ${hub.name} (${hub.code})`;
  } else if (input.event === "return_out_for_seller") {
    rec.status = "Out for Seller Delivery";
    rec.assignedAgentEmail = input.agentEmail?.toLowerCase() || rec.assignedAgentEmail;
    rec.assignedAgentName = input.by;
    scanText = `Out for delivery to Seller / Foundation Warehouse (${input.by})`;
  } else if (input.event === "return_delivered_seller") {
    const scanned = String(input.scannedCode || "").trim().toUpperCase();
    if (!scanned || scanned !== rec.returnAwb.toUpperCase()) {
      throw new Error(`Barcode scan mandatory! Scan Return AWB "${rec.returnAwb}" before handing over to Seller.`);
    }
    const entered = String(input.otp || "").replace(/\D/g, "").trim();
    if (entered.length !== 6 || entered !== rec.sellerHandoverOtp) {
      throw new Error("Incorrect or missing 6-digit Seller Return Handover OTP.");
    }
    rec.status = "Returned to Seller";
    scanText = `Delivered to Seller / Foundation Warehouse (Verified)`;
  }

  rec.tracking.push({ at, status: scanText, location: hub.city });

  const order = findShopOrder(rec.originalOrderId);
  if (order) {
    let nextReturnReq = order.returnRequest;
    let nextReturnShip = order.returnShipment;
    if (nextReturnShip) {
      nextReturnShip = {
        ...nextReturnShip,
        note: `${rec.status} · ${scanText}`,
        ...(input.event === "return_delivered_seller" ? { deliveredAt: at } : {}),
      };
    }
    if (nextReturnReq) {
      const stages = [...(nextReturnReq.stages || [])];
      if (["return_picked_up", "return_hub_inscan", "return_in_transit", "return_dest_hub_inscan", "return_out_for_seller"].includes(input.event)) {
        for (let i = 0; i < stages.length; i++) {
          if (["requested", "review", "decision", "return-label", "return-pickup", "pickup"].includes(stages[i].id)) {
            stages[i] = {
              ...stages[i],
              reached: true,
              at: stages[i].at || at,
              ...(["return-pickup", "pickup"].includes(stages[i].id) ? { at, detail: scanText } : {}),
            };
          }
        }
        nextReturnReq = {
          ...nextReturnReq,
          status: "Picked Up",
          stages,
        };
      } else if (input.event === "return_delivered_seller") {
        for (let i = 0; i < stages.length; i++) {
          if (["requested", "review", "decision", "return-label", "return-pickup", "pickup", "inspected"].includes(stages[i].id)) {
            stages[i] = {
              ...stages[i],
              reached: true,
              at: stages[i].at || at,
              ...(stages[i].id === "inspected" ? { at, detail: "Returned item delivered to Seller & received at Foundation." } : {}),
            };
          }
        }
        nextReturnReq = {
          ...nextReturnReq,
          status: "Picked Up",
          inspection: nextReturnReq.inspection || {
            at,
            condition: "Good",
            restock: false,
            note: "Delivered to Seller via Vaidya Gogate Memorial Foundation (Return AWB verified).",
            by: input.by,
          },
          stages,
        };
      }
    }
    patchShopOrder(order.id, {
      ...(nextReturnReq ? { returnRequest: nextReturnReq } : {}),
      ...(nextReturnShip ? { returnShipment: nextReturnShip } : {}),
      history: [...(order.history ?? []), { at, status: order.status, by: input.by, note: `Return ${rec.returnAwb}: ${scanText}` }],
    });
  }

  recordSellerUpdate(
    store,
    {
      at,
      orderId: rec.originalOrderId,
      awb: rec.returnAwb,
      event: input.event,
      title: `Return Update · ${rec.status}`,
      message: `${scanText} (Order #${rec.originalOrderId}, Return AWB ${rec.returnAwb})`,
      hubCode: hub.code,
      by: input.by,
    },
    input.event === "return_picked_up" || input.event === "return_delivered_seller"
  );
  writeLogisticsStore(store);
  return rec;
}

export function createVgmfManifest(input: {
  type: VgmfManifest["type"];
  hubCode: string;
  destHubCode?: string;
  riderName: string;
  riderPhone?: string;
  vehicleNo?: string;
  awbs: string[];
  bagIds?: string[];
  notes?: string;
  by: string;
}) {
  const store = readLogisticsStore();
  const hub = findHub(store, input.hubCode);
  const bagIds = Array.isArray(input.bagIds) ? input.bagIds.filter(Boolean) : [];
  const awbSet = new Set<string>((input.awbs || []).map((a) => a.trim()).filter(Boolean));
  for (const bId of bagIds) {
    const bag = store.bags.find((b) => b.id === bId);
    if (bag) bag.awbs.forEach((a) => awbSet.add(a));
  }
  const awbs = [...awbSet];
  if (!awbs.length && !bagIds.length) {
    throw new Error("Select at least one AWB or Bag to generate a manifest.");
  }
  store.seq.manifest += 1;
  const manifest: VgmfManifest = {
    id: `MAN-VGMF-${yymmdd()}-${String(store.seq.manifest).padStart(4, "0")}`,
    type: input.type,
    hubCode: hub.code,
    destHubCode: input.destHubCode ? findHub(store, input.destHubCode).code : undefined,
    riderName: input.riderName.trim() || input.by,
    riderPhone: input.riderPhone?.trim() || "",
    vehicleNo: input.vehicleNo?.trim() || "",
    awbs,
    bagIds,
    createdAt: new Date().toISOString(),
    createdBy: input.by,
    notes: input.notes?.trim() || "",
  };
  store.manifests = [manifest, ...store.manifests].slice(0, 300);
  writeLogisticsStore(store);
  return manifest;
}

export function buildDeliveryDashboard(agentEmail = "", selectedHubCode = "") {
  const store = readLogisticsStore();
  const orders = listShopOrders();
  const shipments = listShopShipments();
  const shipByOrder = new Map<string, (typeof shipments)[number]>();
  for (const s of shipments) {
    if (s.orderId) shipByOrder.set(s.orderId, s);
  }
  const activeHub = findHub(store, selectedHubCode);
  const emailLower = agentEmail.trim().toLowerCase();

  const firstMile = orders
    .filter((o) => {
      if (o.deliveryMode === "store_pickup") return false;
      if (o.status === "Delivered" || o.status === "Cancelled" || o.status === "Failed") return false;
      const s = shipByOrder.get(o.id);
      if (!s) return /vgmf express|vaidya gogate memorial foundation/i.test(String(o.courierName || "")) && ["Packed", "Ready to Ship"].includes(o.status);
      return isVgmfOwnShipment(s) && s.status === "Booked";
    })
    .slice(0, 80)
    .map((o) => {
      const s = shipByOrder.get(o.id);
      return {
        orderId: o.id,
        date: o.date,
        orderStatus: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        total: o.total,
        customerName: o.deliveryAddress?.fullName || "Customer",
        customerPhone: o.deliveryAddress?.phone || "",
        city: o.deliveryAddress?.city || "",
        state: o.deliveryAddress?.state || "",
        pincode: o.deliveryAddress?.pincode || "",
        address: o.deliveryAddress?.line1 || "",
        itemsCount: (o.items || []).reduce((sum, i) => sum + i.quantity, 0),
        itemsSummary: (o.items || []).map((i) => `${i.title} ×${i.quantity}`).join(", "),
        awb: s?.awb || "",
        courier: s?.courier || "",
        provider: s?.provider || "",
        shipmentStatus: s?.status || "Awaiting 12-Digit AWB",
        tracking: s?.tracking || [],
      };
    });

  const vgmfShipments = shipments.filter((s) => isVgmfOwnShipment(s));
  const activeShipments = vgmfShipments
    .filter((s) => s.status !== "Failed" && s.status !== "Delivered")
    .slice(0, 140)
    .map((s) => {
      const o = orders.find((x) => x.id === s.orderId);
      const raw = s as unknown as Record<string, unknown>;
      return {
        shipmentId: s.id,
        orderId: s.orderId,
        awb: s.awb || s.orderId,
        courier: s.courier || "Vaidya Gogate Memorial Foundation",
        provider: s.provider || "local",
        status: s.status || "In Transit",
        agentName: s.agentName || (raw.assignedAgentName as string) || "",
        assignedAgentEmail: (raw.assignedAgentEmail as string) || "",
        runsheetId: (raw.runsheetId as string) || "",
        currentHubCode: (raw.currentHubCode as string) || (raw.originHubCode as string) || "",
        inwardHubCode: (raw.inwardHubCode as string) || "",
        outwardHubCode: (raw.outwardHubCode as string) || "",
        customerName: o?.deliveryAddress?.fullName || s.toAddress?.fullName || "Customer",
        customerPhone: o?.deliveryAddress?.phone || s.toAddress?.phone || "",
        address: o?.deliveryAddress?.line1 || s.toAddress?.line1 || "",
        city: o?.deliveryAddress?.city || s.toAddress?.city || "",
        state: o?.deliveryAddress?.state || s.toAddress?.state || "",
        pincode: o?.deliveryAddress?.pincode || s.toAddress?.pincode || "",
        paymentMethod: o?.paymentMethod || "",
        paymentStatus: o?.paymentStatus || "",
        total: o?.total || 0,
        itemsSummary: (o?.items || s.items || []).map((i) => `${i.title} ×${i.quantity}`).join(", "),
        tracking: s.tracking || [],
      };
    });

  // Personal Agent Runsheet (parcels scanned & assigned to this executive's ID)
  const myRunsheet = emailLower
    ? activeShipments.filter((s) => s.assignedAgentEmail.toLowerCase() === emailLower)
    : [];

  // Unique Per-Hub Dashboard (Inward & Outward Shipments + Bags for activeHub)
  const hubInwardShipments = activeShipments.filter(
    (s) => s.inwardHubCode === activeHub.code || s.currentHubCode === activeHub.code
  );
  const hubOutwardShipments = activeShipments.filter(
    (s) => s.outwardHubCode === activeHub.code || (s.status === "Out for Delivery" && s.currentHubCode === activeHub.code)
  );
  const hubInwardBags = store.bags.filter((b) => b.destHub === activeHub.code);
  const hubOutwardBags = store.bags.filter((b) => b.originHub === activeHub.code);

  const deliveredToday = vgmfShipments.filter((s) => {
    if (s.status !== "Delivered") return false;
    const last = (s.tracking || [])[(s.tracking || []).length - 1]?.at || "";
    return last.slice(0, 10) === new Date().toISOString().slice(0, 10);
  }).length;

  return {
    hubs: store.hubs,
    hubDashboard: {
      hub: activeHub,
      inwardShipments: hubInwardShipments,
      outwardShipments: hubOutwardShipments,
      inwardBags: hubInwardBags.slice(0, 25),
      outwardBags: hubOutwardBags.slice(0, 25),
    },
    firstMile,
    activeShipments,
    myRunsheet,
    bags: store.bags.slice(0, 50),
    manifests: store.manifests.slice(0, 50),
    returns: store.returns.slice(0, 60),
    sellerUpdates: store.sellerUpdates.slice(0, 60),
    stats: {
      awaitingPickup: firstMile.length,
      inTransit: activeShipments.filter((s) => ["Picked Up", "In Transit"].includes(s.status)).length,
      outForDelivery: activeShipments.filter((s) => s.status === "Out for Delivery").length,
      myRunsheetCount: myRunsheet.length,
      openBags: store.bags.filter((b) => b.status === "Open" || b.status === "Sealed").length,
      inTransitBags: store.bags.filter((b) => b.status === "In Transit").length,
      activeReturns: store.returns.filter((r) => r.status !== "Returned to Seller").length,
      deliveredToday,
    },
  };
}

export function lookupInternalTracking(code: string) {
  const store = readLogisticsStore();
  const clean = code.trim();
  const ret = store.returns.find((r) => r.returnAwb.toUpperCase() === clean.toUpperCase() || r.id.toUpperCase() === clean.toUpperCase());
  if (ret) {
    return { kind: "return" as const, returnRecord: ret };
  }
  const bag = store.bags.find((b) => b.id.toUpperCase() === clean.toUpperCase());
  if (bag) {
    return {
      kind: "bag" as const,
      bag,
      shipments: bag.awbs.map((awb) => findShipmentByCode(awb)).filter(Boolean),
    };
  }
  const shipment = findShipmentByCode(clean);
  if (!shipment) return null;
  const order = findShopOrder(shipment.orderId);
  const relatedBags = store.bags.filter((b) => b.awbs.includes(String(shipment.awb || "")));
  const sellerUpdates = store.sellerUpdates.filter(
    (u) => u.orderId === shipment.orderId || u.awb === shipment.awb
  );
  return {
    kind: "shipment" as const,
    shipment,
    order: order
      ? {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.total,
          customerName: order.deliveryAddress?.fullName,
          customerPhone: order.deliveryAddress?.phone,
          city: order.deliveryAddress?.city,
          pincode: order.deliveryAddress?.pincode,
          items: order.items,
        }
      : null,
    bags: relatedBags,
    sellerUpdates,
  };
}

const CODE128_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112"
];

export function code128Svg(text: string, height = 56): string {
  const clean = String(text || "880000000000").replace(/[^\x20-\x7E]/g, "");
  const codes: number[] = [104];
  let checksum = 104;
  for (let i = 0; i < clean.length; i++) {
    const val = clean.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(106);

  let x = 10;
  const rects: string[] = [];
  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]) * 2;
      if (i % 2 === 0) {
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#111827" />`);
      }
      x += w;
    }
  }
  const totalWidth = x + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet">${rects.join("")}</svg>`;
}

export function setParcelRackBin(code: string, rackBin: string, hubCode: string, by: string) {
  const store = readLogisticsStore();
  const hub = findHub(store, hubCode);
  const shipment = findShipmentByCode(code);
  if (!shipment) throw new Error(`Shipment "${code}" not found.`);
  const cleanBin = rackBin.trim() || "Rack A1";
  const at = new Date().toISOString();
  const tracking = Array.isArray(shipment.tracking) ? [...shipment.tracking] : [];
  tracking.push({ at, status: `Sorted to ${cleanBin} at ${hub.name}`, location: hub.city });
  upsertShopShipment({
    ...shipment,
    rackBin: cleanBin,
    currentHubCode: hub.code,
    tracking,
  } as unknown as Parameters<typeof upsertShopShipment>[0]);
  recordAudit(store, hub.code, "SORT_RACK_BIN", String(shipment.awb || shipment.orderId), by, `Allocated to ${cleanBin}`);
  writeLogisticsStore(store);
  return { awb: String(shipment.awb || shipment.orderId), rackBin: cleanBin };
}

export function reopenBagWithAudit(bagId: string, reason: string, by: string) {
  const store = readLogisticsStore();
  const bag = store.bags.find((b) => b.id.toUpperCase() === bagId.trim().toUpperCase());
  if (!bag) throw new Error(`Bag ${bagId} not found.`);
  if (!reason.trim()) throw new Error("Supervisor reason is mandatory to reopen a sealed bag.");
  bag.status = "Open";
  recordAudit(store, bag.originHub, "BAG_SUPERVISOR_REOPEN", bag.id, by, `Reopened sealed bag: ${reason.trim()}`);
  writeLogisticsStore(store);
  return bag;
}

export function createHubTransfer(input: {
  originHub: string;
  destHub: string;
  bagIds: string[];
  vehicleNo: string;
  driverName: string;
  driverPhone?: string;
  by: string;
}) {
  const store = readLogisticsStore();
  const origin = findHub(store, input.originHub);
  const dest = findHub(store, input.destHub);
  if (!input.bagIds.length) throw new Error("Select at least one sealed bag for hub transfer.");
  if (!input.vehicleNo.trim()) throw new Error("Vehicle number is required for hub transfer.");

  store.seq.transfer += 1;
  const id = `TRF-${String(store.seq.transfer).padStart(6, "0")}`;
  let parcelCount = 0;
  for (const bId of input.bagIds) {
    const bag = store.bags.find((b) => b.id === bId);
    if (bag) {
      parcelCount += bag.awbs.length;
    }
  }
  const trf: HubTransferRecord = {
    id,
    originHub: origin.code,
    destHub: dest.code,
    bagIds: input.bagIds,
    parcelCount,
    vehicleNo: input.vehicleNo.trim().toUpperCase(),
    driverName: input.driverName.trim() || input.by,
    driverPhone: input.driverPhone?.trim() || "",
    status: "In Transit",
    departedAt: new Date().toISOString(),
    createdBy: input.by,
  };
  store.transfers = [trf, ...store.transfers].slice(0, 300);
  recordAudit(store, origin.code, "TRANSFER_DISPATCHED", id, input.by, `${origin.code} → ${dest.code} · ${input.bagIds.length} bags · ${trf.vehicleNo}`);
  writeLogisticsStore(store);

  // Also dispatch each bag inside the transfer
  for (const bId of input.bagIds) {
    try {
      dispatchBagTransfer(bId, dest.code, input.by, trf.vehicleNo, trf.driverName);
    } catch {
      /* ignore if already dispatched */
    }
  }
  return trf;
}

export function receiveHubTransfer(transferId: string, hubCode: string, by: string) {
  const store = readLogisticsStore();
  const trf = store.transfers.find((t) => t.id.toUpperCase() === transferId.trim().toUpperCase());
  if (!trf) throw new Error(`Transfer ${transferId} not found.`);
  const hub = findHub(store, hubCode || trf.destHub);
  trf.status = "Received";
  trf.receivedAt = new Date().toISOString();
  trf.receivedBy = by;
  recordAudit(store, hub.code, "TRANSFER_RECEIVED", trf.id, by, `Reconciled ${trf.bagIds.length} bags (${trf.parcelCount} parcels) at ${hub.code}`);
  writeLogisticsStore(store);
  for (const bId of trf.bagIds) {
    try {
      receiveBagTransfer(bId, hub.code, by);
    } catch {
      /* ignore */
    }
  }
  return trf;
}

export function logGateEntry(input: {
  hubCode: string;
  vehicleNo: string;
  driverName: string;
  driverPhone?: string;
  purpose: string;
  transferId?: string;
  bagCount: number;
  securityBy: string;
}) {
  if (!input.vehicleNo.trim() || !input.driverName.trim()) {
    throw new Error("Vehicle number and driver name are required.");
  }
  const store = readLogisticsStore();
  const hub = findHub(store, input.hubCode);
  const entry: GateRegisterEntry = {
    id: `GATE-${Date.now().toString().slice(-6)}`,
    hubCode: hub.code,
    vehicleNo: input.vehicleNo.trim().toUpperCase(),
    driverName: input.driverName.trim(),
    driverPhone: input.driverPhone?.trim() || "",
    purpose: input.purpose.trim() || "Hub Transfer",
    transferId: input.transferId?.trim() || "",
    bagCount: Number(input.bagCount || 0),
    entryAt: new Date().toISOString(),
    securityBy: input.securityBy,
  };
  store.gateEntries = [entry, ...store.gateEntries].slice(0, 300);
  recordAudit(store, hub.code, "GATE_ENTRY", entry.vehicleNo, input.securityBy, `${entry.purpose} · ${entry.bagCount} bags`);
  writeLogisticsStore(store);
  return entry;
}

export function logGateExit(entryId: string, by: string) {
  const store = readLogisticsStore();
  const entry = store.gateEntries.find((g) => g.id === entryId);
  if (!entry) throw new Error("Gate entry not found.");
  entry.exitAt = new Date().toISOString();
  entry.exitBy = by;
  recordAudit(store, entry.hubCode, "GATE_EXIT", entry.vehicleNo, by, `Vehicle exited hub`);
  writeLogisticsStore(store);
  return entry;
}

export function createHubException(input: {
  hubCode: string;
  code: string;
  category: HubExceptionRecord["category"];
  notes: string;
  cctvRef?: string;
  by: string;
}) {
  const store = readLogisticsStore();
  const hub = findHub(store, input.hubCode);
  store.seq.exc += 1;
  const exc: HubExceptionRecord = {
    id: `EXC-${String(store.seq.exc).padStart(5, "0")}`,
    hubCode: hub.code,
    code: input.code.trim() || "UNKNOWN",
    category: input.category,
    status: "Open",
    notes: input.notes.trim() || "Flagged by hub operator",
    cctvRef: input.cctvRef?.trim() || "",
    createdAt: new Date().toISOString(),
    createdBy: input.by,
  };
  store.exceptions = [exc, ...store.exceptions].slice(0, 300);
  recordAudit(store, hub.code, "EXCEPTION_OPENED", exc.id, input.by, `${exc.category} on ${exc.code}`);
  writeLogisticsStore(store);
  return exc;
}

export function resolveHubException(caseId: string, resolution: string, by: string) {
  const store = readLogisticsStore();
  const exc = store.exceptions.find((e) => e.id.toUpperCase() === caseId.trim().toUpperCase());
  if (!exc) throw new Error(`Exception ${caseId} not found.`);
  exc.status = "Resolved";
  exc.resolution = resolution.trim() || "Verified and closed by supervisor";
  exc.resolvedAt = new Date().toISOString();
  exc.resolvedBy = by;
  recordAudit(store, exc.hubCode, "EXCEPTION_RESOLVED", exc.id, by, exc.resolution);
  writeLogisticsStore(store);
  return exc;
}

export function getFullHubOperationsData(hubCode = "", agentEmail = "") {
  const base = buildDeliveryDashboard(agentEmail, hubCode);
  const store = readLogisticsStore();
  const activeHub = base.hubDashboard.hub;

  // Sorting summary grouped by destination city
  const sortGroupsMap = new Map<string, { destination: string; pincodes: Set<string>; count: number; awbs: string[]; codCount: number }>();
  for (const s of base.activeShipments) {
    const dest = (s.city || "Other").trim() || "Other";
    const entry = sortGroupsMap.get(dest) || { destination: dest, pincodes: new Set<string>(), count: 0, awbs: [], codCount: 0 };
    entry.count += 1;
    entry.awbs.push(s.awb);
    if (s.pincode) entry.pincodes.add(s.pincode);
    if (/cod|cash on delivery/i.test(s.paymentMethod || "") && s.paymentStatus !== "Paid") entry.codCount += 1;
    sortGroupsMap.set(dest, entry);
  }
  const sortingGroups = [...sortGroupsMap.values()]
    .map((g) => ({ destination: g.destination, count: g.count, awbs: g.awbs, codCount: g.codCount, pincodes: [...g.pincodes].slice(0, 5) }))
    .sort((a, b) => b.count - a.count);

  // Delivery partner runsheet summary
  const partnerMap = new Map<string, { partner: string; email: string; assigned: number; pending: number; delivered: number }>();
  for (const s of base.activeShipments) {
    if (!s.agentName && !s.assignedAgentEmail) continue;
    const key = (s.assignedAgentEmail || s.agentName).toLowerCase();
    const row = partnerMap.get(key) || { partner: s.agentName || s.assignedAgentEmail, email: s.assignedAgentEmail, assigned: 0, pending: 0, delivered: 0 };
    row.assigned += 1;
    row.pending += 1;
    partnerMap.set(key, row);
  }

  // Aging alerts (shipments stuck > 48h without delivery)
  const now = Date.now();
  const agingAlerts = base.activeShipments
    .map((s) => {
      const lastAt = s.tracking?.[s.tracking.length - 1]?.at || "";
      const hours = lastAt ? Math.round((now - Date.parse(lastAt)) / 3600000) : 0;
      return { awb: s.awb, orderId: s.orderId, city: s.city, status: s.status, hoursStuck: hours };
    })
    .filter((a) => a.hoursStuck >= 48)
    .sort((a, b) => b.hoursStuck - a.hoursStuck)
    .slice(0, 20);

  return {
    ...base,
    sortingGroups,
    partnerSummary: [...partnerMap.values()],
    transfers: store.transfers.slice(0, 60),
    gateEntries: store.gateEntries.filter((g) => !hubCode || g.hubCode === activeHub.code).slice(0, 60),
    exceptions: store.exceptions.filter((e) => !hubCode || e.hubCode === activeHub.code).slice(0, 60),
    auditLog: store.auditLog.slice(0, 80),
    agentEnrollments: store.agentEnrollments.slice(0, 100),
    agingAlerts,
  };
}

export function getAgentEnrollment(email: string, role = "") {
  const clean = email.trim().toLowerCase();
  const isAdmin = /^(admin|superadmin|owner)$/i.test(role.trim());
  const store = readLogisticsStore();
  const rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === clean);
  if (rec) return { ...rec, isAdmin };
  if (isAdmin) {
    return {
      email: clean,
      name: "Admin",
      hubCode: store.hubs[0]?.code || "",
      status: "approved" as const,
      requestedAt: new Date().toISOString(),
      isAdmin: true,
    };
  }
  return { email: clean, name: "", hubCode: "", status: "unassigned" as const, requestedAt: "", isAdmin: false };
}

export function requestAgentHubEnrollment(input: { email: string; name: string; phone?: string; vehicleNo?: string; hubCode: string }) {
  const store = readLogisticsStore();
  const hub = store.hubs.find((h) => h.code.toUpperCase() === input.hubCode.trim().toUpperCase());
  if (!hub) throw new Error("Selected hub not found. Ask Admin to configure the hub first.");
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Agent email is required.");
  const existing = store.agentEnrollments.find((a) => a.email.toLowerCase() === email);
  const now = new Date().toISOString();
  if (existing) {
    existing.name = input.name.trim() || existing.name;
    existing.phone = input.phone?.trim() || existing.phone;
    existing.vehicleNo = input.vehicleNo?.trim().toUpperCase() || existing.vehicleNo;
    existing.hubCode = hub.code;
    existing.status = "pending";
    existing.requestedAt = now;
    existing.rejectReason = undefined;
  } else {
    store.agentEnrollments.unshift({
      email,
      name: input.name.trim() || email,
      phone: input.phone?.trim() || "",
      vehicleNo: input.vehicleNo?.trim().toUpperCase() || "",
      hubCode: hub.code,
      status: "pending",
      requestedAt: now,
    });
  }
  recordAudit(store, hub.code, "AGENT_HUB_REQUEST", email, input.name || email, `Requested activation for hub ${hub.code}`);
  writeLogisticsStore(store);
  return store.agentEnrollments.find((a) => a.email.toLowerCase() === email)!;
}

export function reviewAgentHubEnrollment(input: { email: string; approve: boolean; role?: HubExecutive["role"]; reason?: string; by: string }) {
  const store = readLogisticsStore();
  const rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === input.email.trim().toLowerCase());
  if (!rec) throw new Error("Agent enrollment request not found.");
  const now = new Date().toISOString();
  rec.status = input.approve ? "approved" : "rejected";
  rec.role = input.role || rec.role || "delivery_executive";
  rec.reviewedAt = now;
  rec.reviewedBy = input.by;
  rec.rejectReason = input.approve ? undefined : (input.reason?.trim() || "Rejected by Hub Admin");

  if (input.approve) {
    // Automatically add approved executive to their hub's executives list
    const hub = store.hubs.find((h) => h.code.toUpperCase() === rec.hubCode.toUpperCase());
    if (hub) {
      const ex = hub.executives.find((e) => e.email.toLowerCase() === rec.email.toLowerCase());
      if (ex) {
        ex.role = rec.role || ex.role;
      } else {
        hub.executives.push({
          id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: rec.name,
          email: rec.email,
          phone: rec.phone || "",
          role: rec.role || "delivery_executive",
          shift: "Morning (08:00–16:00)",
          station: "Field Delivery",
          addedAt: now,
        });
      }
    }
  }
  recordAudit(store, rec.hubCode, input.approve ? "AGENT_APPROVED" : "AGENT_REJECTED", rec.email, input.by, input.approve ? `Activated for deliveries at ${rec.hubCode}` : (rec.rejectReason || "Rejected"));
  writeLogisticsStore(store);
  return rec;
}

export function ensureAgentEnrollmentOnSignup(input: { email: string; name: string; phone?: string }) {
  const store = readLogisticsStore();
  const email = input.email.trim().toLowerCase();
  if (!email) return null;
  let rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === email);
  if (!rec) {
    rec = {
      email,
      name: input.name.trim() || email,
      phone: input.phone?.trim() || "",
      hubCode: "",
      status: "pending",
      requestedAt: new Date().toISOString(),
    };
    store.agentEnrollments.unshift(rec);
    writeLogisticsStore(store);
  }
  return rec;
}

export function allotAgentToHub(input: { email: string; hubCode: string; role?: HubExecutive["role"]; by: string }) {
  const store = readLogisticsStore();
  const hub = store.hubs.find((h) => h.code.toUpperCase() === input.hubCode.trim().toUpperCase());
  if (!hub) throw new Error(`Hub "${input.hubCode}" not found.`);
  const cleanEmail = input.email.trim().toLowerCase();
  const rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === cleanEmail);
  if (!rec) throw new Error(`Executive "${cleanEmail}" not found.`);

  const oldHubCode = rec.hubCode;
  rec.hubCode = hub.code;
  if (input.role) rec.role = input.role;

  // Remove from old hub if reassigned
  if (oldHubCode && oldHubCode !== hub.code) {
    const oldHub = store.hubs.find((h) => h.code.toUpperCase() === oldHubCode.toUpperCase());
    if (oldHub) {
      oldHub.executives = oldHub.executives.filter((e) => e.email.toLowerCase() !== cleanEmail);
    }
  }
  // Ensure executive is in target hub's executives list
  const existing = hub.executives.find((e) => e.email.toLowerCase() === cleanEmail);
  if (existing) {
    existing.role = input.role || existing.role;
  } else {
    hub.executives.push({
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: rec.name || cleanEmail,
      email: cleanEmail,
      phone: rec.phone || "",
      role: input.role || rec.role || "delivery_executive",
      shift: "Morning (08:00–16:00)",
      station: "Field Delivery",
      addedAt: new Date().toISOString(),
    });
  }
  recordAudit(store, hub.code, "AGENT_HUB_ALLOTTED", cleanEmail, input.by, `Allotted ${rec.name} to ${hub.code}${oldHubCode ? ` (from ${oldHubCode})` : ""}`);
  writeLogisticsStore(store);
  return { agent: rec, hub };
}


export function deleteAgentEnrollment(email: string, by: string) {
  const cleanEmail = email.trim().toLowerCase();
  const store = readLogisticsStore();
  const before = store.agentEnrollments.length;
  store.agentEnrollments = store.agentEnrollments.filter((a) => a.email.toLowerCase() !== cleanEmail);
  for (const h of store.hubs) {
    h.executives = h.executives.filter((e) => e.email.toLowerCase() !== cleanEmail);
  }
  recordAudit(store, store.hubs[0]?.code || "ADMIN", "AGENT_ACCOUNT_DELETED", cleanEmail, by, `Deleted delivery agent account ${cleanEmail}`);
  writeLogisticsStore(store);
  return { removedEnrollment: before !== store.agentEnrollments.length };
}

export function updateAgentLocation(input: { email: string; lat: number; lng: number; accuracy?: number; note?: string }) {
  const clean = input.email.trim().toLowerCase();
  if (!clean || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return null;
  const store = readLogisticsStore();
  const rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === clean);
  if (!rec) return null;
  rec.lastLocation = {
    lat: input.lat,
    lng: input.lng,
    accuracy: input.accuracy,
    at: new Date().toISOString(),
    note: input.note,
  };
  writeLogisticsStore(store);
  return rec.lastLocation;
}

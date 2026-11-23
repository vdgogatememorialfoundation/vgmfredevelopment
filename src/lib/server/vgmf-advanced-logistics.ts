import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";
import { findShopOrder, patchShopOrder } from "@/lib/server/shop-orders";
import { listShopShipments, upsertShopShipment } from "@/lib/server/shop-shipments";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import {
  createHubException,
  findShipmentByCode,
  isVgmfOwnShipment,
  readLogisticsStore,
  writeLogisticsStore,
} from "@/lib/server/vgmf-logistics";

export type ServiceModeChoice = "normal" | "hyperlocal" | "both";
export type HyperlocalRouteMode = "direct_seller_to_customer" | "micro_hub";

export type ShiftTemplate = {
  id: string;
  name: string;
  startTime: string; // "07:00"
  endTime: string;   // "11:00"
  purpose: string;
  maxParcelsPerExec: number;
  hubCode?: string;
  active: boolean;
};

export type DeliverySlotConfig = {
  id: string;
  label: string; // "07:00 AM – 10:00 AM"
  startTime: string;
  endTime: string;
  hyperlocalEnabled: boolean;
  normalEnabled: boolean;
  plannedCapacity: number;
  confirmedCount: number;
  reservedCount: number;
  cutoffMinutesBefore: number;
  fee: number;
};

export type ExecutiveAttendance = {
  email: string;
  name: string;
  hubCode: string;
  serviceMode: ServiceModeChoice;
  shiftId: string;
  shiftName: string;
  status: "checked_in" | "on_break" | "checked_out";
  checkedInAt: string;
  checkedOutAt?: string;
  maxParcels: number;
  activeTasks: number;
};

export type PickupManifestRecord = {
  id: string; // PM-HUB-YYMMDD-001
  hubCode: string;
  executiveEmail: string;
  executiveName: string;
  shiftWindow: string;
  expectedAwbs: string[];
  scannedAwbs: string[];
  missingDiscrepancies: { awb: string; reason: string }[];
  status: "Assigned" | "In Progress" | "Partially Collected" | "Completed";
  createdAt: string;
  completedAt?: string;
  autoAllocated: boolean;
};

export type OpenBoxQuestion = {
  id: string;
  text: string;
  options: string[];
  required: boolean;
};

export type OpenBoxSettings = {
  enabled: boolean;
  applicableMode: ServiceModeChoice;
  hyperlocalRouteMode: HyperlocalRouteMode;
  requireLast4Mobile: boolean;
  requireSeparateOpenBoxOtp: boolean;
  requireInspectionPhotos: boolean;
  requireQuestionnaire: boolean;
  allowCustomerRefusal: boolean;
  questions: OpenBoxQuestion[];
};

export type OpenBoxSessionRecord = {
  id: string;
  awb: string;
  orderId: string;
  executiveEmail: string;
  executiveName: string;
  maskedPhone: string;
  last4Verified: boolean;
  openBoxOtpHash: string;
  openBoxOtpVerified: boolean;
  finalDeliveryOtpHash: string;
  finalDeliveryOtpVerified: boolean;
  answers: Record<string, string>;
  remarks?: string;
  photos: { category: "before_open" | "after_open" | "product_condition" | "damage_evidence"; url: string; at: string }[];
  customerDecision?: "accepted" | "damaged" | "wrong_product" | "missing_item" | "refused";
  exceptionCaseId?: string;
  status: "Started" | "Authorized" | "Inspected" | "Delivered" | "Exception";
  createdAt: string;
  updatedAt: string;
};

type AdvancedStore = {
  shiftTemplates: ShiftTemplate[];
  deliverySlots: DeliverySlotConfig[];
  attendance: ExecutiveAttendance[];
  pickupManifests: PickupManifestRecord[];
  openBoxSettings: OpenBoxSettings;
  openBoxSessions: OpenBoxSessionRecord[];
  allocationLogs: { id: string; at: string; type: string; ref: string; executive: string; reason: string; by: string }[];
  seq: { pm: number; ob: number };
};

const DEFAULT_SHIFTS: ShiftTemplate[] = [
  { id: "shift-morning", name: "Morning", startTime: "07:00", endTime: "11:00", purpose: "Morning pickups & deliveries", maxParcelsPerExec: 15, active: true },
  { id: "shift-midday", name: "Midday", startTime: "11:00", endTime: "15:00", purpose: "Regular deliveries", maxParcelsPerExec: 20, active: true },
  { id: "shift-evening", name: "Evening", startTime: "15:00", endTime: "19:00", purpose: "Afternoon & evening deliveries", maxParcelsPerExec: 20, active: true },
  { id: "shift-night", name: "Night", startTime: "19:00", endTime: "22:00", purpose: "Eligible late deliveries", maxParcelsPerExec: 10, active: true },
];

const DEFAULT_SLOTS: DeliverySlotConfig[] = [
  { id: "slot-7-10", label: "7:00 AM – 10:00 AM", startTime: "07:00", endTime: "10:00", hyperlocalEnabled: true, normalEnabled: true, plannedCapacity: 40, confirmedCount: 0, reservedCount: 0, cutoffMinutesBefore: 60, fee: 0 },
  { id: "slot-10-13", label: "10:00 AM – 1:00 PM", startTime: "10:00", endTime: "13:00", hyperlocalEnabled: true, normalEnabled: true, plannedCapacity: 40, confirmedCount: 0, reservedCount: 0, cutoffMinutesBefore: 60, fee: 0 },
  { id: "slot-13-16", label: "1:00 PM – 4:00 PM", startTime: "13:00", endTime: "16:00", hyperlocalEnabled: true, normalEnabled: true, plannedCapacity: 32, confirmedCount: 0, reservedCount: 0, cutoffMinutesBefore: 60, fee: 0 },
  { id: "slot-16-19", label: "4:00 PM – 7:00 PM", startTime: "16:00", endTime: "19:00", hyperlocalEnabled: true, normalEnabled: true, plannedCapacity: 40, confirmedCount: 0, reservedCount: 0, cutoffMinutesBefore: 60, fee: 0 },
  { id: "slot-19-22", label: "7:00 PM – 10:00 PM", startTime: "19:00", endTime: "22:00", hyperlocalEnabled: true, normalEnabled: false, plannedCapacity: 20, confirmedCount: 0, reservedCount: 0, cutoffMinutesBefore: 60, fee: 0 },
];

const DEFAULT_OPEN_BOX: OpenBoxSettings = {
  enabled: true,
  applicableMode: "both",
  hyperlocalRouteMode: "direct_seller_to_customer",
  requireLast4Mobile: true,
  requireSeparateOpenBoxOtp: true,
  requireInspectionPhotos: true,
  requireQuestionnaire: true,
  allowCustomerRefusal: true,
  questions: [
    { id: "q1", text: "Is the outer packaging intact?", options: ["Yes", "No"], required: true },
    { id: "q2", text: "Is the product the correct item?", options: ["Yes", "No"], required: true },
    { id: "q3", text: "Is the quantity correct?", options: ["Yes", "No"], required: true },
    { id: "q4", text: "Is there any visible damage?", options: ["No damage", "Damaged"], required: true },
    { id: "q5", text: "Are all included accessories/books present?", options: ["Yes", "No", "Not applicable"], required: true },
  ],
};

function storePath() {
  return dataFile("vgmf-advanced-logistics.json");
}

function hashOtp(otp: string) {
  return createHash("sha256").update(`vgmf-ob-otp:${otp}`).digest("hex");
}

function sixDigitOtp() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function maskPhone(phone?: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) return "******";
  return `******${digits.slice(-4)}`;
}

export function readAdvancedStore(): AdvancedStore {
  try {
    const raw = JSON.parse(readFileSync(storePath(), "utf8")) as Partial<AdvancedStore>;
    return {
      shiftTemplates: Array.isArray(raw.shiftTemplates) && raw.shiftTemplates.length ? raw.shiftTemplates : DEFAULT_SHIFTS,
      deliverySlots: Array.isArray(raw.deliverySlots) && raw.deliverySlots.length ? raw.deliverySlots : DEFAULT_SLOTS,
      attendance: Array.isArray(raw.attendance) ? raw.attendance : [],
      pickupManifests: Array.isArray(raw.pickupManifests) ? raw.pickupManifests : [],
      openBoxSettings: { ...DEFAULT_OPEN_BOX, ...(raw.openBoxSettings || {}), questions: raw.openBoxSettings?.questions?.length ? raw.openBoxSettings.questions : DEFAULT_OPEN_BOX.questions },
      openBoxSessions: Array.isArray(raw.openBoxSessions) ? raw.openBoxSessions : [],
      allocationLogs: Array.isArray(raw.allocationLogs) ? raw.allocationLogs : [],
      seq: { pm: Number(raw.seq?.pm || 100), ob: Number(raw.seq?.ob || 100) },
    };
  } catch {
    return {
      shiftTemplates: DEFAULT_SHIFTS,
      deliverySlots: DEFAULT_SLOTS,
      attendance: [],
      pickupManifests: [],
      openBoxSettings: DEFAULT_OPEN_BOX,
      openBoxSessions: [],
      allocationLogs: [],
      seq: { pm: 100, ob: 100 },
    };
  }
}

export function writeAdvancedStore(store: AdvancedStore) {
  const f = storePath();
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(store, null, 2), "utf8");
}

/** Executive Shift Check-In / Break / Check-Out + Service Mode (Normal / Hyperlocal / Both) */
export function updateExecutiveShiftStatus(input: {
  email: string;
  name: string;
  hubCode: string;
  serviceMode?: ServiceModeChoice;
  shiftId?: string;
  status: "checked_in" | "on_break" | "checked_out";
}) {
  const store = readAdvancedStore();
  const email = input.email.trim().toLowerCase();
  const shift = store.shiftTemplates.find((s) => s.id === input.shiftId) || store.shiftTemplates[0];
  const existing = store.attendance.find((a) => a.email.toLowerCase() === email);
  const now = new Date().toISOString();

  // Also persist executive's preferred serviceMode on their enrollment record
  if (input.serviceMode) {
    const logStore = readLogisticsStore();
    const enr = logStore.agentEnrollments.find((e) => e.email.toLowerCase() === email);
    if (enr) {
      (enr as unknown as { serviceMode?: ServiceModeChoice }).serviceMode = input.serviceMode;
      writeLogisticsStore(logStore);
    }
  }

  if (existing) {
    existing.status = input.status;
    existing.hubCode = input.hubCode || existing.hubCode;
    existing.shiftId = shift.id;
    existing.shiftName = `${shift.name} (${shift.startTime}–${shift.endTime})`;
    existing.maxParcels = shift.maxParcelsPerExec;
    if (input.serviceMode) existing.serviceMode = input.serviceMode;
    if (input.status === "checked_in") existing.checkedInAt = now;
    if (input.status === "checked_out") existing.checkedOutAt = now;
  } else {
    store.attendance.unshift({
      email,
      name: input.name || email,
      hubCode: input.hubCode,
      serviceMode: input.serviceMode || "both",
      shiftId: shift.id,
      shiftName: `${shift.name} (${shift.startTime}–${shift.endTime})`,
      status: input.status,
      checkedInAt: now,
      maxParcels: shift.maxParcelsPerExec,
      activeTasks: 0,
    });
  }
  writeAdvancedStore(store);
  return store.attendance.find((a) => a.email.toLowerCase() === email)!;
}

export function setExecutiveServiceMode(email: string, serviceMode: ServiceModeChoice, by: string) {
  const clean = email.trim().toLowerCase();
  const logStore = readLogisticsStore();
  const enr = logStore.agentEnrollments.find((e) => e.email.toLowerCase() === clean);
  if (enr) {
    (enr as unknown as { serviceMode?: ServiceModeChoice }).serviceMode = serviceMode;
    writeLogisticsStore(logStore);
  }
  const adv = readAdvancedStore();
  const att = adv.attendance.find((a) => a.email.toLowerCase() === clean);
  if (att) att.serviceMode = serviceMode;
  adv.allocationLogs.unshift({
    id: `al-${Date.now()}`,
    at: new Date().toISOString(),
    type: "SERVICE_MODE_UPDATED",
    ref: clean,
    executive: clean,
    reason: `Service mode set to ${serviceMode}`,
    by,
  });
  writeAdvancedStore(adv);
  return { email: clean, serviceMode };
}

/** Auto-allocate ready VGMF shipments into a Pickup Manifest for a checked-in executive with remaining capacity. */
type PickupRider = { email: string; name: string; hubCode: string; onDuty: boolean };

function onDutyRiderEmails() {
  try {
    const raw = JSON.parse(readFileSync(dataFile("rider-ops.json"), "utf8")) as { bookings?: { email: string; name?: string; status: string; mode: string }[] };
    return new Map((raw.bookings ?? []).filter((b) => b.status === "on_duty" && b.mode !== "hyperlocal").map((b) => [b.email.toLowerCase(), b.name || b.email]));
  } catch {
    return new Map<string, string>();
  }
}

/** Riders who can take pickups: activated delivery partners, with the ones on duty right now first. */
export function pickupRiders(): PickupRider[] {
  const onDuty = onDutyRiderEmails();
  const rows = new Map<string, PickupRider>();
  for (const e of readLogisticsStore().agentEnrollments) {
    if (e.status !== "approved") continue;
    rows.set(e.email.toLowerCase(), { email: e.email.toLowerCase(), name: e.name || e.email, hubCode: e.hubCode, onDuty: onDuty.has(e.email.toLowerCase()) });
  }
  for (const [email, name] of onDuty) if (!rows.has(email)) rows.set(email, { email, name, hubCode: "", onDuty: true });
  return [...rows.values()].sort((x, y) => Number(y.onDuty) - Number(x.onDuty) || x.name.localeCompare(y.name));
}

/** Own-logistics shipments booked and waiting to be picked up from the seller. */
export function pendingPickupShipments() {
  return listShopShipments()
    .filter((s) => isVgmfOwnShipment(s) && s.status === "Booked" && s.awb)
    .map((s) => {
      const raw = s as unknown as Record<string, unknown>;
      return {
        awb: String(s.awb),
        orderId: s.orderId,
        bookedAt: String(raw.createdAt || raw.bookedAt || ""),
        assignedTo: String(raw.assignedAgentEmail || ""),
        runsheetId: String(raw.runsheetId || ""),
      };
    });
}

/** Assigns pickups to one rider: creates a pickup runsheet and puts every parcel on the rider's app. */
export function assignPickups(input: { awbs: string[]; executiveEmail: string; hubCode?: string; shiftWindow?: string; by: string; auto?: boolean }) {
  const email = input.executiveEmail.trim().toLowerCase();
  if (!email) throw new Error("Choose the rider who should pick up these parcels.");
  const wanted = new Set(input.awbs.map((a) => a.trim()).filter(Boolean));
  const shipments = listShopShipments().filter((s) => wanted.has(String(s.awb || "")) && isVgmfOwnShipment(s) && s.status === "Booked");
  if (!shipments.length) throw new Error("None of the selected parcels are waiting for pickup. Only our own-logistics shipments in Booked status can be assigned.");
  const rider = pickupRiders().find((r) => r.email === email);
  const adv = readAdvancedStore();
  const awbs = shipments.map((s) => String(s.awb));
  const busy = new Set(adv.pickupManifests.filter((m) => m.status === "Assigned" || m.status === "In Progress").map((m) => m.id));
  for (const m of adv.pickupManifests) {
    if (!busy.has(m.id) || m.executiveEmail.toLowerCase() === email) continue;
    m.expectedAwbs = m.expectedAwbs.filter((awb) => !awbs.includes(awb));
  }
  adv.seq.pm += 1;
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const hubCode = input.hubCode || rider?.hubCode || "VGMF";
  const pm: PickupManifestRecord = {
    id: `PM-${hubCode.replace(/[^A-Z0-9]/gi, "").slice(0, 6)}-${ymd}-${String(adv.seq.pm).padStart(3, "0")}`,
    hubCode,
    executiveEmail: email,
    executiveName: rider?.name || email,
    shiftWindow: input.shiftWindow || "Current shift",
    expectedAwbs: awbs,
    scannedAwbs: [],
    missingDiscrepancies: [],
    status: "Assigned",
    createdAt: d.toISOString(),
    autoAllocated: Boolean(input.auto),
  };
  adv.pickupManifests.unshift(pm);
  adv.allocationLogs.unshift({
    id: `al-${Date.now()}`,
    at: d.toISOString(),
    type: pm.autoAllocated ? "AUTO_PICKUP_ALLOCATED" : "MANUAL_PICKUP_ALLOCATED",
    ref: pm.id,
    executive: email,
    reason: `${awbs.length} pickup parcel(s) assigned to ${pm.executiveName}.`,
    by: input.by,
  });
  writeAdvancedStore(adv);
  for (const s of shipments) upsertShopShipment({ ...s, assignedAgentEmail: email, runsheetId: pm.id } as Parameters<typeof upsertShopShipment>[0]);
  return pm;
}

export function autoAllocatePickupManifest(input: { hubCode: string; shiftWindow?: string; by: string; executiveEmail?: string }) {
  const waiting = pendingPickupShipments().filter((p) => !p.assignedTo);
  if (!waiting.length) throw new Error("There are no unassigned pickups. Every booked own-logistics parcel already has a rider.");
  const riders = pickupRiders().filter((r) => !input.hubCode || !r.hubCode || r.hubCode === input.hubCode);
  const chosen = input.executiveEmail?.trim().toLowerCase() || riders.find((r) => r.onDuty)?.email;
  if (!chosen) throw new Error("No rider is on duty for this hub right now. Choose a rider from the list and assign the pickups manually.");
  return assignPickups({ awbs: waiting.map((p) => p.awb), executiveEmail: chosen, hubCode: input.hubCode, shiftWindow: input.shiftWindow, by: input.by, auto: !input.executiveEmail });
}

export function scanIntoPickupManifest(manifestId: string, awb: string) {
  const adv = readAdvancedStore();
  const pm = adv.pickupManifests.find((m) => m.id === manifestId);
  if (!pm) throw new Error("Pickup manifest not found.");
  const clean = awb.trim();
  if (!pm.expectedAwbs.includes(clean)) {
    throw new Error(`AWB ${clean} is not in Pickup Manifest ${pm.id}.`);
  }
  if (!pm.scannedAwbs.includes(clean)) pm.scannedAwbs.push(clean);
  pm.status = pm.scannedAwbs.length >= pm.expectedAwbs.length ? "Completed" : "In Progress";
  if (pm.status === "Completed") pm.completedAt = new Date().toISOString();
  writeAdvancedStore(adv);
  return pm;
}

export function reconcilePickupManifest(manifestId: string, missingReasons: Record<string, string>) {
  const adv = readAdvancedStore();
  const pm = adv.pickupManifests.find((m) => m.id === manifestId);
  if (!pm) throw new Error("Pickup manifest not found.");
  const missing = pm.expectedAwbs.filter((a) => !pm.scannedAwbs.includes(a));
  if (missing.length > 0) {
    for (const awb of missing) {
      if (!missingReasons[awb]?.trim()) {
        throw new Error(`Declare a reason for missing AWB ${awb} before closing Pickup Manifest ${pm.id}.`);
      }
    }
    pm.missingDiscrepancies = missing.map((awb) => ({ awb, reason: missingReasons[awb].trim() }));
    pm.status = "Partially Collected";
  } else {
    pm.status = "Completed";
  }
  pm.completedAt = new Date().toISOString();
  writeAdvancedStore(adv);
  return pm;
}

/* ==================== 3-LAYER OPEN-BOX DELIVERY ENGINE ==================== */

export function startOpenBoxSession(input: { awb: string; executiveEmail: string; executiveName: string }) {
  const shipment = findShipmentByCode(input.awb);
  if (!shipment) throw new Error(`Shipment "${input.awb}" not found.`);
  const order = findShopOrder(shipment.orderId);
  const phone = order?.deliveryAddress?.phone || shipment.toAddress?.phone || "";
  const email = order?.deliveryAddress?.email || order?.accountEmail || "";

  const adv = readAdvancedStore();
  adv.seq.ob += 1;
  const openBoxOtp = sixDigitOtp();
  const finalOtp = sixDigitOtp();
  const now = new Date().toISOString();

  const session: OpenBoxSessionRecord = {
    id: `OB-${Date.now().toString().slice(-6)}-${adv.seq.ob}`,
    awb: String(shipment.awb || shipment.orderId),
    orderId: shipment.orderId,
    executiveEmail: input.executiveEmail.toLowerCase(),
    executiveName: input.executiveName,
    maskedPhone: maskPhone(phone),
    last4Verified: false,
    openBoxOtpHash: hashOtp(openBoxOtp),
    openBoxOtpVerified: false,
    finalDeliveryOtpHash: hashOtp(finalOtp),
    finalDeliveryOtpVerified: false,
    answers: {},
    photos: [],
    status: "Started",
    createdAt: now,
    updatedAt: now,
  };
  adv.openBoxSessions.unshift(session);
  writeAdvancedStore(adv);

  if (email) {
    void sendMobileEmail(
      email,
      `Open-Box Delivery Authorization OTP for Order #${shipment.orderId}: ${openBoxOtp}`,
      `Namaste ${order?.deliveryAddress?.fullName || "Customer"},\n\nOur VGMF Delivery Executive is at your doorstep for Open-Box Delivery of Order #${shipment.orderId} (AWB ${session.awb}).\n\n1. Open-Box Authorization OTP (to open & inspect parcel): ${openBoxOtp}\n2. Final Delivery Confirmation OTP (share ONLY after inspecting and accepting the product): ${finalOtp}`
    ).catch(() => undefined);
  }

  return {
    sessionId: session.id,
    maskedPhone: session.maskedPhone,
    questions: adv.openBoxSettings.questions,
    requireLast4Mobile: adv.openBoxSettings.requireLast4Mobile,
    requireSeparateOpenBoxOtp: adv.openBoxSettings.requireSeparateOpenBoxOtp,
    message: `Open-Box session ${session.id} started. Masked mobile: ${session.maskedPhone}. Authorization & Final OTPs sent to customer.`,
  };
}

export function authorizeOpenBoxSession(input: { sessionId: string; last4Digits: string; openBoxOtp: string }) {
  const adv = readAdvancedStore();
  const sess = adv.openBoxSessions.find((s) => s.id === input.sessionId);
  if (!sess) throw new Error("Open-Box session not found.");
  const shipment = findShipmentByCode(sess.awb);
  const order = shipment ? findShopOrder(shipment.orderId) : null;
  const fullDigits = String(order?.deliveryAddress?.phone || shipment?.toAddress?.phone || "").replace(/\D/g, "");
  const expectedLast4 = fullDigits.slice(-4);

  if (adv.openBoxSettings.requireLast4Mobile && expectedLast4) {
    const enteredLast4 = String(input.last4Digits || "").replace(/\D/g, "").trim();
    if (enteredLast4 !== expectedLast4) {
      throw new Error("Last 4 digits of registered customer mobile number do not match.");
    }
    sess.last4Verified = true;
  }

  if (adv.openBoxSettings.requireSeparateOpenBoxOtp) {
    const enteredOtp = String(input.openBoxOtp || "").replace(/\D/g, "").trim();
    if (enteredOtp.length !== 6 || hashOtp(enteredOtp) !== sess.openBoxOtpHash) {
      throw new Error("Incorrect 6-digit Open-Box Authorization OTP.");
    }
    sess.openBoxOtpVerified = true;
  }

  sess.status = "Authorized";
  sess.updatedAt = new Date().toISOString();
  writeAdvancedStore(adv);
  return { session: sess, message: "Customer verified! You may now open the parcel and complete the inspection questionnaire." };
}

export function completeOpenBoxSession(input: {
  sessionId: string;
  answers: Record<string, string>;
  remarks?: string;
  photos?: { category: "before_open" | "after_open" | "product_condition" | "damage_evidence"; url: string }[];
  decision: "accepted" | "damaged" | "wrong_product" | "missing_item" | "refused";
  finalDeliveryOtp?: string;
  recipientName?: string;
  codCollected?: boolean;
  hubCode?: string;
}) {
  const adv = readAdvancedStore();
  const sess = adv.openBoxSessions.find((s) => s.id === input.sessionId);
  if (!sess) throw new Error("Open-Box session not found.");
  if (sess.status !== "Authorized" && sess.status !== "Inspected") {
    throw new Error("Authorize Open-Box inspection (Last 4 digits + Open-Box OTP) before completing delivery.");
  }

  const now = new Date().toISOString();
  sess.answers = input.answers || {};
  sess.remarks = input.remarks?.trim() || "";
  if (Array.isArray(input.photos) && input.photos.length) {
    sess.photos = input.photos.map((p) => ({ ...p, at: now }));
  }
  sess.customerDecision = input.decision;
  sess.updatedAt = now;

  // If customer reported issue or refused -> block delivery completion & auto-create Exception Case!
  if (input.decision !== "accepted") {
    const catMap: Record<string, "damaged_parcel" | "wrong_hub" | "missing_shipment"> = {
      damaged: "damaged_parcel",
      wrong_product: "damaged_parcel",
      missing_item: "missing_shipment",
      refused: "damaged_parcel",
    };
    const exc = createHubException({
      hubCode: input.hubCode || "VGMF",
      code: sess.awb,
      category: catMap[input.decision] || "damaged_parcel",
      notes: `Open-Box ${input.decision.toUpperCase()} (${sess.id}): ${sess.remarks || "Customer reported issue during open-box inspection."}`,
      by: sess.executiveName,
    });
    sess.exceptionCaseId = exc.id;
    sess.status = "Exception";
    writeAdvancedStore(adv);
    return {
      delivered: false,
      exceptionCaseId: exc.id,
      session: sess,
      message: `Delivery blocked (${input.decision}). Exception Case ${exc.id} opened for supervisor/RTO review.`,
    };
  }

  // Customer accepted -> verify mandatory 6-digit Final Delivery OTP!
  const enteredFinal = String(input.finalDeliveryOtp || "").replace(/\D/g, "").trim();
  if (enteredFinal.length !== 6 || hashOtp(enteredFinal) !== sess.finalDeliveryOtpHash) {
    throw new Error("Incorrect 6-digit Final Delivery Confirmation OTP.");
  }
  sess.finalDeliveryOtpVerified = true;
  sess.status = "Delivered";
  writeAdvancedStore(adv);

  // Mark shipment & order Delivered
  const shipment = findShipmentByCode(sess.awb);
  if (shipment) {
    const tracking = Array.isArray(shipment.tracking) ? [...shipment.tracking] : [];
    tracking.push({
      at: now,
      status: `Open-Box Delivered to ${input.recipientName || "Customer"} (Last-4 + 2-Step OTP + Inspection Verified)`,
      location: shipment.toAddress?.city || "",
    });
    upsertShopShipment({ ...shipment, status: "Delivered", tracking } as unknown as Parameters<typeof upsertShopShipment>[0]);
    const order = findShopOrder(shipment.orderId);
    if (order) {
      patchShopOrder(order.id, {
        status: "Delivered",
        ...(input.codCollected ? { paymentStatus: "Paid", amountPaid: order.total, paidAt: now } : {}),
        history: [
          ...(order.history ?? []),
          { at: now, status: "Delivered", by: sess.executiveName, note: `Open-Box Delivery completed (${sess.id}) · Inspection passed & OTP verified` },
        ],
      });
    }
  }

  return {
    delivered: true,
    session: sess,
    message: `Open-Box Delivery completed & verified (${sess.id})!`,
  };
}

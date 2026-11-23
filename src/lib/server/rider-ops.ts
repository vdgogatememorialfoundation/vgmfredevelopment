import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";
import { findShopOrder, listShopOrders, patchShopOrder } from "@/lib/server/shop-orders";
import { listShopShipments } from "@/lib/server/shop-shipments";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { readAdvancedStore } from "@/lib/server/vgmf-advanced-logistics";
import {
  applyDeliveryScanEvent,
  applyReturnEvent,
  findShipmentByCode,
  getAgentEnrollment,
  isVgmfOwnShipment,
  readLogisticsStore,
} from "@/lib/server/vgmf-logistics";
import type { Order } from "@/types";

export type RiderMode = "courier" | "hyperlocal";
export type JobKind = "delivery" | "pickup" | "return" | "obd" | "replacement";

export type ShiftBooking = {
  id: string;
  email: string;
  name: string;
  date: string;
  shiftId: string;
  shiftName: string;
  start: string;
  end: string;
  mode: RiderMode;
  status: "booked" | "on_duty" | "completed" | "cancelled";
  bookedAt: string;
  checkInAt?: string;
  endedAt?: string;
};

export type Attempt = {
  id: string;
  email: string;
  bookingId: string;
  awb: string;
  orderId: string;
  kind: JobKind | "hyperlocal";
  result: "success" | "failed";
  reason?: string;
  payMode?: "prepaid" | "cash" | "qr";
  amount?: number;
  answers?: Record<string, string>;
  photos?: string[];
  at: string;
};

export type CashHandover = {
  id: string;
  email: string;
  name: string;
  bookingId: string;
  hubCode: string;
  expected: number;
  declared: number;
  difference: number;
  denominations?: Record<string, number>;
  note?: string;
  status: "submitted" | "verified" | "disputed";
  submittedAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
};

export type WalletTxn = {
  id: string;
  email: string;
  at: string;
  type: "delivery" | "pickup" | "return" | "obd" | "replacement" | "hyperlocal" | "surge" | "incentive" | "payout" | "adjustment";
  amount: number;
  ref: string;
  note: string;
};

export type HyperJob = {
  id: string;
  orderId: string;
  email: string;
  name: string;
  status: "accepted" | "picked" | "out_for_delivery" | "arrived" | "delivered" | "failed";
  orderScanned?: string;
  shelfScanned?: string;
  itemsChecked?: boolean;
  photos: string[];
  openBox: boolean;
  otpHash: string;
  answers?: Record<string, string>;
  reason?: string;
  payMode?: "prepaid" | "cash" | "qr";
  timeline: { at: string; status: string }[];
  acceptedAt: string;
  updatedAt: string;
};

export type RiderSettings = {
  rates: Record<JobKind | "hyperlocal", number>;
  surge: Record<string, number>;
  openBoxThreshold: number;
  checkInGraceMinutes: number;
  failReasons: string[];
  obdQuestions: { id: string; text: string; options: string[] }[];
  returnQuestions: { id: string; text: string; options: string[] }[];
};

type Store = {
  locations?: Record<string, { lat: number; lng: number; at: string }>;
  bookings: ShiftBooking[];
  attempts: Attempt[];
  handovers: CashHandover[];
  wallet: WalletTxn[];
  hyperJobs: HyperJob[];
  acceptedRunsheets: Record<string, string>;
  groupOtps: { key: string; hash: string; awbs: string[]; expires: number }[];
  settings: RiderSettings;
  seq: number;
};

const DEFAULT_SETTINGS: RiderSettings = {
  rates: { delivery: 25, pickup: 20, return: 25, obd: 35, replacement: 30, hyperlocal: 35 },
  surge: {},
  openBoxThreshold: 2000,
  checkInGraceMinutes: 15,
  failReasons: [
    "Customer not available",
    "Customer asked to reschedule",
    "Customer refused the parcel",
    "Address not found / incomplete",
    "Customer phone switched off / not reachable",
    "Cash not ready (COD)",
    "Premises closed",
    "Out of time in shift",
  ],
  obdQuestions: [
    { id: "pack", text: "Is the outer packaging intact?", options: ["Yes", "No"] },
    { id: "item", text: "Is it the correct product (title and language)?", options: ["Yes", "No"] },
    { id: "qty", text: "Is the quantity correct?", options: ["Yes", "No"] },
    { id: "damage", text: "Any damage, torn pages or stains?", options: ["No damage", "Damaged"] },
  ],
  returnQuestions: [
    { id: "item", text: "Is it the same product that was delivered?", options: ["Yes", "No"] },
    { id: "qty", text: "Is the quantity correct?", options: ["Yes", "No"] },
    { id: "condition", text: "Condition of the product", options: ["Unused", "Used", "Damaged"] },
    { id: "parts", text: "Are all parts / inserts included?", options: ["Yes", "No", "Not applicable"] },
  ],
};

const file = () => dataFile("rider-ops.json");

function read(): Store {
  let raw: Partial<Store> = {};
  try {
    raw = JSON.parse(readFileSync(file(), "utf8")) as Partial<Store>;
  } catch {
    raw = {};
  }
  return {
    bookings: raw.bookings ?? [],
    attempts: raw.attempts ?? [],
    handovers: raw.handovers ?? [],
    wallet: raw.wallet ?? [],
    hyperJobs: raw.hyperJobs ?? [],
    acceptedRunsheets: raw.acceptedRunsheets ?? {},
    groupOtps: (raw.groupOtps ?? []).filter((row) => row.expires > Date.now()),
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}), rates: { ...DEFAULT_SETTINGS.rates, ...(raw.settings?.rates ?? {}) } },
    seq: raw.seq ?? 0,
  };
}

function write(store: Store) {
  const path = file();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  renameSync(tmp, path);
}

const hash = (value: string) => createHash("sha256").update(`vgmf-rider:${value}`).digest("hex");
const otp6 = () => String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
const lower = (value: string) => value.trim().toLowerCase();

function istNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function nextId(store: Store, prefix: string) {
  store.seq += 1;
  const { date } = istNow();
  return `${prefix}-${date.slice(2).replace(/-/g, "")}-${String(store.seq).padStart(4, "0")}`;
}

export function riderSettings() {
  return read().settings;
}

export function saveRiderSettings(patch: Partial<RiderSettings>) {
  const store = read();
  store.settings = { ...store.settings, ...patch, rates: { ...store.settings.rates, ...(patch.rates ?? {}) } };
  write(store);
  return store.settings;
}

export function shiftOptions(hubCode = "") {
  const { date, minutes } = istNow();
  const surge = read().settings.surge;
  return readAdvancedStore()
    .shiftTemplates.filter((shift) => shift.active && (!shift.hubCode || !hubCode || shift.hubCode === hubCode))
    .map((shift) => ({
      ...shift,
      date,
      surge: surge[shift.id] ?? 1,
      bookable: toMinutes(shift.endTime) > minutes,
      live: toMinutes(shift.startTime) <= minutes && minutes < toMinutes(shift.endTime),
    }));
}

export function myBookings(email: string) {
  const { date } = istNow();
  return read().bookings.filter((row) => lower(row.email) === lower(email) && row.date >= date && row.status !== "cancelled");
}

export function activeBooking(email: string, store = read()) {
  const { date, minutes } = istNow();
  const grace = store.settings.checkInGraceMinutes;
  return (
    store.bookings.find(
      (row) =>
        lower(row.email) === lower(email) &&
        row.date === date &&
        row.status === "on_duty" &&
        minutes >= toMinutes(row.start) - grace &&
        minutes < toMinutes(row.end) + grace
    ) ?? null
  );
}

function requireDuty(email: string, store: Store, mode?: RiderMode) {
  const booking = activeBooking(email, store);
  if (!booking) throw new Error("You are not on duty. Check in to a booked shift first; duty works only during your shift time.");
  if (mode && booking.mode !== mode) throw new Error(`Your current shift is for ${booking.mode === "hyperlocal" ? "Hyperlocal" : "Courier"} duty.`);
  return booking;
}

function requireActivated(email: string, role: string) {
  const enrollment = getAgentEnrollment(email, role);
  if (enrollment.status !== "approved") throw new Error("Your ID is not activated yet. Complete KYC and get activated at your hub / dark store first.");
  return enrollment;
}

export function bookShift(input: { email: string; name: string; role: string; shiftId: string; mode: RiderMode }) {
  requireActivated(input.email, input.role);
  const store = read();
  const shift = shiftOptions().find((row) => row.id === input.shiftId);
  if (!shift) throw new Error("That shift is not available.");
  if (!shift.bookable) throw new Error("That shift has already ended for today.");
  const { date } = istNow();
  const clash = store.bookings.find(
    (row) => lower(row.email) === lower(input.email) && row.date === date && row.shiftId === shift.id && row.status !== "cancelled"
  );
  if (clash) return clash;
  const booking: ShiftBooking = {
    id: nextId(store, "SHF"),
    email: lower(input.email),
    name: input.name,
    date,
    shiftId: shift.id,
    shiftName: shift.name,
    start: shift.startTime,
    end: shift.endTime,
    mode: input.mode,
    status: "booked",
    bookedAt: new Date().toISOString(),
  };
  store.bookings.unshift(booking);
  write(store);
  return booking;
}

export function cancelShift(email: string, bookingId: string) {
  const store = read();
  const row = store.bookings.find((item) => item.id === bookingId && lower(item.email) === lower(email));
  if (!row) throw new Error("Booking not found.");
  if (row.status !== "booked") throw new Error("Only a shift you haven't started can be cancelled.");
  row.status = "cancelled";
  write(store);
  return row;
}

export function checkIn(input: { email: string; role: string; bookingId: string }) {
  requireActivated(input.email, input.role);
  const store = read();
  const row = store.bookings.find((item) => item.id === input.bookingId && lower(item.email) === lower(input.email));
  if (!row) throw new Error("Shift booking not found.");
  const { date, minutes } = istNow();
  const grace = store.settings.checkInGraceMinutes;
  if (row.date !== date || minutes < toMinutes(row.start) - grace || minutes >= toMinutes(row.end)) {
    throw new Error(`You can check in only during your shift (${row.start}–${row.end}), up to ${grace} minutes early.`);
  }
  for (const other of store.bookings) {
    if (other !== row && lower(other.email) === lower(input.email) && other.status === "on_duty") {
      other.status = "completed";
      other.endedAt = new Date().toISOString();
    }
  }
  row.status = "on_duty";
  row.checkInAt = new Date().toISOString();
  write(store);
  return row;
}

export function endShift(email: string) {
  const store = read();
  const row = store.bookings.find((item) => lower(item.email) === lower(email) && item.status === "on_duty");
  if (!row) throw new Error("You have no shift on duty.");
  const handover = store.handovers.find((item) => item.bookingId === row.id);
  if (shiftCashExpected(store, row.id) > 0 && !handover) throw new Error("Submit your cash handover before ending the shift.");
  row.status = "completed";
  row.endedAt = new Date().toISOString();
  write(store);
  return row;
}

function shiftCashExpected(store: Store, bookingId: string) {
  return store.attempts
    .filter((row) => row.bookingId === bookingId && row.result === "success" && row.payMode === "cash")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function balanceDue(order?: Order | null) {
  if (!order) return 0;
  if (order.paymentStatus === "Paid") return 0;
  return Math.max(0, Math.round((Number(order.total || 0) - Number(order.amountPaid || 0)) * 100) / 100);
}

function jobKind(order: Order | undefined, status: string, settings: RiderSettings): JobKind {
  if (status === "Booked") return "pickup";
  if (order?.replacementOf) return "replacement";
  if (order?.openBoxDelivery || Number(order?.total || 0) >= settings.openBoxThreshold) return "obd";
  return "delivery";
}

/** Runsheets: own-logistics parcels and return pickups assigned to this rider, grouped by runsheet ID. */
export function riderRunsheets(email: string) {
  const store = read();
  const me = lower(email);
  const orders = new Map(listShopOrders().map((order) => [order.id, order]));
  const jobs: ReturnType<typeof jobCard>[] = [];
  for (const shipment of listShopShipments()) {
    const raw = shipment as unknown as Record<string, unknown>;
    if (!isVgmfOwnShipment(shipment) || lower(String(raw.assignedAgentEmail || "")) !== me) continue;
    if (["Delivered", "Failed", "Cancelled", "Returned"].includes(shipment.status)) continue;
    const order = orders.get(shipment.orderId);
    jobs.push(jobCard(store, String(raw.runsheetId || "RS-UNSORTED"), jobKind(order, shipment.status, store.settings), String(shipment.awb || shipment.orderId), shipment.orderId, order, shipment.status, raw));
  }
  for (const ret of readLogisticsStore().returns) {
    if (lower(ret.assignedAgentEmail || "") !== me || !["Initiated", "Out for Return Pickup"].includes(ret.status)) continue;
    const order = orders.get(ret.originalOrderId);
    jobs.push({
      ...jobCard(store, `RS-RET-${ret.hubCode}`, "return", ret.returnAwb, ret.originalOrderId, order, ret.status, {}),
      customerName: ret.customerName,
      phone: ret.customerPhone || "",
      address: [ret.address, ret.city, ret.pincode].filter(Boolean).join(", "),
      amountToCollect: 0,
    });
  }
  const sheets = new Map<string, typeof jobs>();
  for (const job of jobs) sheets.set(job.runsheetId, [...(sheets.get(job.runsheetId) ?? []), job]);
  return [...sheets.entries()].map(([id, list]) => {
    const done = store.attempts.filter((row) => row.email === me && list.some((job) => job.awb === row.awb));
    return {
      id,
      accepted: Boolean(store.acceptedRunsheets[`${me}|${id}`]),
      total: list.length,
      counts: {
        pickup: list.filter((job) => job.kind === "pickup").length,
        delivery: list.filter((job) => job.kind === "delivery").length,
        obd: list.filter((job) => job.kind === "obd").length,
        return: list.filter((job) => job.kind === "return").length,
        replacement: list.filter((job) => job.kind === "replacement").length,
      },
      priority: list.filter((job) => job.priority).length,
      failed: done.filter((row) => row.result === "failed").length,
      cashToCollect: list.reduce((sum, job) => sum + job.amountToCollect, 0),
      jobs: list,
    };
  });
}

function jobCard(store: Store, runsheetId: string, kind: JobKind, awb: string, orderId: string, order: Order | undefined, status: string, raw: Record<string, unknown>) {
  const address = order?.deliveryAddress;
  const failedTries = store.attempts.filter((row) => row.awb === awb && row.result === "failed").length;
  return {
    runsheetId,
    kind,
    awb,
    orderId,
    status,
    customerName: address?.fullName || "Customer",
    phone: address?.phone || "",
    address: [address?.line1, address?.landmark, address?.city, address?.state, address?.pincode].filter(Boolean).join(", "),
    pincode: address?.pincode || "",
    items: (order?.items ?? []).map((item) => ({ title: item.title, quantity: item.quantity })),
    payment: balanceDue(order) > 0 ? "COD" : "Prepaid",
    amountToCollect: kind === "pickup" ? 0 : balanceDue(order),
    priority: Boolean(raw.priority === "high" || Number(order?.total || 0) >= store.settings.openBoxThreshold),
    failedTries,
  };
}

export function acceptRunsheet(email: string, runsheetId: string) {
  const store = read();
  requireDuty(email, store, "courier");
  store.acceptedRunsheets[`${lower(email)}|${runsheetId}`] = new Date().toISOString();
  write(store);
  return { runsheetId };
}

export function recordArrival(email: string, awb: string, lat?: number, lng?: number) {
  const store = read();
  requireDuty(email, store);
  const shipment = findShipmentByCode(awb);
  const order = shipment ? findShopOrder(shipment.orderId) : null;
  const phone = String(order?.deliveryAddress?.phone || "");
  const sameCustomer = phone
    ? riderRunsheets(email)
        .flatMap((sheet) => sheet.jobs)
        .filter((job) => job.phone === phone && job.kind !== "pickup")
        .map((job) => job.awb)
    : [awb];
  return { awb, lat, lng, shipments: sameCustomer.length ? sameCustomer : [awb] };
}

/** One OTP for all of a customer's parcels on this stop. */
export async function sendGroupOtp(email: string, awbs: string[]) {
  const store = read();
  requireDuty(email, store);
  const shipment = findShipmentByCode(awbs[0] ?? "");
  const order = shipment ? findShopOrder(shipment.orderId) : null;
  if (!order) throw new Error("Shipment not found.");
  const code = otp6();
  const key = `${lower(email)}|${[...awbs].sort().join(",")}`;
  store.groupOtps = store.groupOtps.filter((row) => row.key !== key);
  store.groupOtps.push({ key, hash: hash(code), awbs, expires: Date.now() + 30 * 60_000 });
  write(store);
  const to = order.deliveryAddress?.email || order.accountEmail;
  if (to) {
    await sendMobileEmail(
      to,
      `${code} is your delivery OTP for ${awbs.length} parcel${awbs.length > 1 ? "s" : ""}`,
      `Namaste ${order.deliveryAddress?.fullName || ""},\n\nOur delivery executive is at your door with ${awbs.length} parcel${awbs.length > 1 ? "s" : ""} (${awbs.join(", ")}).\n\nShare this OTP only after you receive them: ${code}\n\nVaidya Gogate Memorial Foundation`
    ).catch(() => false);
  }
  const digits = String(order.deliveryAddress?.phone || "").replace(/\D/g, "");
  return { sentTo: to ? to.replace(/(.{2}).*(@.*)/, "$1***$2") : "", maskedPhone: digits ? `******${digits.slice(-4)}` : "" };
}

function checkOtp(store: Store, email: string, awbs: string[], code: string) {
  const key = `${lower(email)}|${[...awbs].sort().join(",")}`;
  const group = store.groupOtps.find((row) => row.key === key);
  if (group && group.hash === hash(code)) return true;
  if (awbs.length === 1) {
    const shipment = findShipmentByCode(awbs[0]);
    const own = String((shipment as unknown as Record<string, unknown> | null)?.deliveryOtp || "");
    if (own && own === code) return true;
  }
  return false;
}

function credit(store: Store, email: string, booking: ShiftBooking, kind: WalletTxn["type"], ref: string) {
  const base = Number(store.settings.rates[kind as JobKind | "hyperlocal"] ?? 0);
  if (!base) return;
  const at = new Date().toISOString();
  store.wallet.unshift({ id: nextId(store, "TXN"), email: lower(email), at, type: kind, amount: base, ref, note: `${kind[0].toUpperCase()}${kind.slice(1)} · ${ref}` });
  const multiplier = Number(store.settings.surge[booking.shiftId] ?? 1);
  if (multiplier > 1) {
    const extra = Math.round(base * (multiplier - 1) * 100) / 100;
    store.wallet.unshift({ id: nextId(store, "TXN"), email: lower(email), at, type: "surge", amount: extra, ref, note: `Surge ×${multiplier} (${booking.shiftName})` });
  }
}

export function completeDeliveries(input: {
  email: string;
  name: string;
  awbs: string[];
  otp: string;
  last4?: string;
  payMode: "prepaid" | "cash" | "qr";
  answers?: Record<string, Record<string, string>>;
  photos?: string[];
  recipientName?: string;
}) {
  const store = read();
  const booking = requireDuty(input.email, store, "courier");
  if (!input.awbs.length) throw new Error("Scan at least one shipment.");
  if (!checkOtp(store, input.email, input.awbs, input.otp.replace(/\D/g, ""))) throw new Error("Incorrect delivery OTP.");
  const done: string[] = [];
  for (const awb of input.awbs) {
    const shipment = findShipmentByCode(awb);
    if (!shipment) throw new Error(`Shipment ${awb} not found.`);
    const order = findShopOrder(shipment.orderId);
    const kind = jobKind(order ?? undefined, shipment.status, store.settings);
    if (kind === "obd") {
      const digits = String(order?.deliveryAddress?.phone || "").replace(/\D/g, "");
      if (!input.last4 || digits.slice(-4) !== input.last4.replace(/\D/g, "")) throw new Error("Last 4 digits of the customer's mobile number don't match.");
    }
    const due = balanceDue(order);
    const raw = shipment as unknown as Record<string, unknown>;
    applyDeliveryScanEvent({
      code: awb,
      scannedCode: String(shipment.awb || awb),
      event: "delivered",
      by: input.name,
      agentEmail: input.email,
      riderName: input.name,
      recipientName: input.recipientName,
      otp: String(raw.deliveryOtp || ""),
      codCollected: due > 0,
      photoUrl: input.photos?.[0],
    });
    if (order && due > 0) {
      patchShopOrder(order.id, {
        paymentMethod: input.payMode === "cash" ? "Cash on delivery" : order.paymentMethod,
        history: [...(findShopOrder(order.id)?.history ?? []), { at: new Date().toISOString(), status: "Paid", by: input.name, note: `₹${due} collected at the door by ${input.payMode === "cash" ? "cash" : "UPI QR"}` }],
      });
    }
    store.attempts.unshift({
      id: nextId(store, "ATT"),
      email: lower(input.email),
      bookingId: booking.id,
      awb,
      orderId: shipment.orderId,
      kind,
      result: "success",
      payMode: due > 0 ? input.payMode : "prepaid",
      amount: due,
      answers: input.answers?.[awb],
      photos: input.photos,
      at: new Date().toISOString(),
    });
    credit(store, input.email, booking, kind, awb);
    done.push(awb);
  }
  write(store);
  return { delivered: done };
}

export function failJob(input: { email: string; name: string; awb: string; kind: JobKind; reason: string; note?: string }) {
  const store = read();
  const booking = requireDuty(input.email, store);
  const reason = [input.reason, input.note].filter(Boolean).join(" — ");
  if (input.kind === "return") {
    store.attempts.unshift({ id: nextId(store, "ATT"), email: lower(input.email), bookingId: booking.id, awb: input.awb, orderId: "", kind: "return", result: "failed", reason, at: new Date().toISOString() });
  } else {
    const res = applyDeliveryScanEvent({ code: input.awb, event: "ndr", by: input.name, agentEmail: input.email, riderName: input.name, reason });
    store.attempts.unshift({ id: nextId(store, "ATT"), email: lower(input.email), bookingId: booking.id, awb: input.awb, orderId: res.shipment.orderId, kind: input.kind, result: "failed", reason, at: new Date().toISOString() });
  }
  write(store);
  return { awb: input.awb, reason };
}

export function completePickup(input: { email: string; name: string; awb: string; otp: string; photos?: string[] }) {
  const store = read();
  const booking = requireDuty(input.email, store, "courier");
  const res = applyDeliveryScanEvent({ code: input.awb, scannedCode: input.awb, event: "picked_up", by: input.name, agentEmail: input.email, riderName: input.name, otp: input.otp, photoUrl: input.photos?.[0] });
  store.attempts.unshift({ id: nextId(store, "ATT"), email: lower(input.email), bookingId: booking.id, awb: input.awb, orderId: res.shipment.orderId, kind: "pickup", result: "success", photos: input.photos, at: new Date().toISOString() });
  credit(store, input.email, booking, "pickup", input.awb);
  write(store);
  return { awb: input.awb };
}

export function completeReturnPickup(input: { email: string; name: string; returnAwb: string; otp: string; answers: Record<string, string>; photos?: string[]; hubCode?: string }) {
  const store = read();
  const booking = requireDuty(input.email, store, "courier");
  const missing = store.settings.returnQuestions.filter((q) => !input.answers[q.id]);
  if (missing.length) throw new Error("Answer every return check question.");
  applyReturnEvent({ returnAwb: input.returnAwb, scannedCode: input.returnAwb, event: "return_picked_up", hubCode: input.hubCode || "", otp: input.otp, agentEmail: input.email, by: input.name });
  store.attempts.unshift({ id: nextId(store, "ATT"), email: lower(input.email), bookingId: booking.id, awb: input.returnAwb, orderId: "", kind: "return", result: "success", answers: input.answers, photos: input.photos, at: new Date().toISOString() });
  credit(store, input.email, booking, "return", input.returnAwb);
  write(store);
  return { returnAwb: input.returnAwb };
}

export function shiftSummary(email: string) {
  const store = read();
  const booking = store.bookings.find((row) => lower(row.email) === lower(email) && row.status === "on_duty") ?? null;
  if (!booking) return { booking: null };
  const rows = store.attempts.filter((row) => row.bookingId === booking.id);
  const byMode = (mode: Attempt["payMode"]) => rows.filter((row) => row.result === "success" && row.payMode === mode);
  return {
    booking,
    delivered: rows.filter((row) => row.result === "success" && row.kind !== "pickup" && row.kind !== "return").length,
    pickups: rows.filter((row) => row.result === "success" && row.kind === "pickup").length,
    returns: rows.filter((row) => row.result === "success" && row.kind === "return").length,
    failed: rows.filter((row) => row.result === "failed").length,
    cashExpected: shiftCashExpected(store, booking.id),
    qrCollected: byMode("qr").reduce((sum, row) => sum + Number(row.amount || 0), 0),
    cashOrders: byMode("cash").map((row) => ({ awb: row.awb, orderId: row.orderId, amount: row.amount ?? 0 })),
    handover: store.handovers.find((row) => row.bookingId === booking.id) ?? null,
  };
}

export function submitHandover(input: { email: string; name: string; role: string; declared: number; denominations?: Record<string, number>; note?: string }) {
  const store = read();
  const booking = store.bookings.find((row) => lower(row.email) === lower(input.email) && row.status === "on_duty");
  if (!booking) throw new Error("You have no shift on duty.");
  const expected = shiftCashExpected(store, booking.id);
  const existing = store.handovers.find((row) => row.bookingId === booking.id);
  const record: CashHandover = {
    id: existing?.id ?? nextId(store, "HO"),
    email: lower(input.email),
    name: input.name,
    bookingId: booking.id,
    hubCode: getAgentEnrollment(input.email, input.role).hubCode || "",
    expected,
    declared: Number(input.declared || 0),
    difference: Math.round((Number(input.declared || 0) - expected) * 100) / 100,
    denominations: input.denominations,
    note: input.note,
    status: "submitted",
    submittedAt: new Date().toISOString(),
  };
  store.handovers = [record, ...store.handovers.filter((row) => row.id !== record.id)];
  write(store);
  return record;
}

export function verifyHandover(id: string, ok: boolean, by: string) {
  const store = read();
  const row = store.handovers.find((item) => item.id === id);
  if (!row) throw new Error("Handover not found.");
  row.status = ok ? "verified" : "disputed";
  row.verifiedBy = by;
  row.verifiedAt = new Date().toISOString();
  write(store);
  return row;
}

export function listHandovers() {
  return read().handovers.slice(0, 200);
}

export function saveRiderLocation(email: string, lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Invalid location.");
  const store = read();
  store.locations = { ...(store.locations ?? {}), [email]: { lat, lng, at: new Date().toISOString() } };
  write(store);
  return { saved: true };
}

export function riderWallet(email: string) {
  const store = read();
  const rows = store.wallet.filter((row) => lower(row.email) === lower(email));
  const { date } = istNow();
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
  const sum = (list: WalletTxn[]) => Math.round(list.reduce((total, row) => total + row.amount, 0) * 100) / 100;
  const today = rows.filter((row) => day(row.at) === date);
  const weekAgo = Date.now() - 7 * 86400_000;
  return {
    balance: sum(rows),
    today: sum(today.filter((row) => row.type !== "payout")),
    todaySurge: sum(today.filter((row) => row.type === "surge")),
    todayJobs: today.filter((row) => row.type !== "surge" && row.type !== "payout" && row.type !== "incentive").length,
    week: sum(rows.filter((row) => Date.parse(row.at) >= weekAgo && row.type !== "payout")),
    paidOut: -sum(rows.filter((row) => row.type === "payout")),
    rates: store.settings.rates,
    surge: store.settings.surge,
    transactions: rows.slice(0, 150),
  };
}

export function walletEntry(input: { email: string; type: "payout" | "adjustment" | "incentive"; amount: number; note: string; by: string }) {
  const store = read();
  const amount = input.type === "payout" ? -Math.abs(input.amount) : input.amount;
  const row: WalletTxn = { id: nextId(store, "TXN"), email: lower(input.email), at: new Date().toISOString(), type: input.type, amount, ref: input.by, note: input.note };
  store.wallet.unshift(row);
  write(store);
  return row;
}

/* ---------- Hyperlocal (own riders, dark store) ---------- */

const HYPER_PROVIDERS = new Set(["vgmf-hyperlocal"]);

function isOwnHyperOrder(order: Order) {
  const provider = String(order.courierChoice?.provider || "");
  return HYPER_PROVIDERS.has(provider) || /vaidya gogate memorial foundation hyperlocal|vgmf express hyperlocal/i.test(String(order.courierName || ""));
}

export function hyperlocalOffers(email: string) {
  const store = read();
  const taken = new Set(store.hyperJobs.filter((job) => job.status !== "failed").map((job) => job.orderId));
  const mine = store.hyperJobs.filter((job) => lower(job.email) === lower(email) && !["delivered", "failed"].includes(job.status));
  if (mine.length) return { offers: [], active: mine.map((job) => hyperJobView(job)) };
  const offers = listShopOrders()
    .filter((order) => isOwnHyperOrder(order) && !taken.has(order.id) && ["Packed", "Ready to Ship", "Paid", "Ordered", "Accepted"].includes(order.status))
    .slice(0, 5)
    .map((order) => ({
      orderId: order.id,
      customerName: order.deliveryAddress?.fullName || "Customer",
      address: [order.deliveryAddress?.line1, order.deliveryAddress?.city, order.deliveryAddress?.pincode].filter(Boolean).join(", "),
      amount: order.total,
      payment: balanceDue(order) > 0 ? "COD" : "Prepaid",
      items: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
      earning: store.settings.rates.hyperlocal,
    }));
  return { offers, active: [] };
}

function hyperJobView(job: HyperJob) {
  const order = findShopOrder(job.orderId);
  const address = order?.deliveryAddress;
  return {
    ...job,
    otpHash: undefined,
    customerName: address?.fullName || "Customer",
    phone: address?.phone || "",
    address: [address?.line1, address?.landmark, address?.city, address?.pincode].filter(Boolean).join(", "),
    items: (order?.items ?? []).map((item) => ({ title: item.title, quantity: item.quantity, sku: item.sku })),
    amountToCollect: balanceDue(order),
    payment: balanceDue(order) > 0 ? "COD" : "Prepaid",
    pickupFrom: getAgentEnrollment(job.email).hubCode || "",
  };
}

export async function acceptHyperOrder(input: { email: string; name: string; role: string; orderId: string }) {
  requireActivated(input.email, input.role);
  const store = read();
  requireDuty(input.email, store, "hyperlocal");
  if (store.hyperJobs.some((job) => job.orderId === input.orderId && job.status !== "failed")) throw new Error("Another rider has already accepted this order.");
  const order = findShopOrder(input.orderId);
  if (!order) throw new Error("Order not found.");
  const code = otp6();
  const at = new Date().toISOString();
  const job: HyperJob = {
    id: nextId(store, "HL"),
    orderId: order.id,
    email: lower(input.email),
    name: input.name,
    status: "accepted",
    photos: [],
    openBox: Boolean(order.openBoxDelivery) || Number(order.total || 0) >= store.settings.openBoxThreshold,
    otpHash: hash(code),
    timeline: [{ at, status: "Accepted" }],
    acceptedAt: at,
    updatedAt: at,
  };
  store.hyperJobs.unshift(job);
  write(store);
  const to = order.deliveryAddress?.email || order.accountEmail;
  if (to) {
    void sendMobileEmail(to, `Delivery OTP ${code} for order ${order.id}`, `Namaste ${order.deliveryAddress?.fullName || ""},\n\n${input.name} will deliver your order ${order.id} shortly.\nShare this OTP only when you receive it: ${code}\n\nVaidya Gogate Memorial Foundation`).catch(() => false);
  }
  return hyperJobView(job);
}

export function hyperStep(input: {
  email: string;
  name: string;
  jobId: string;
  step: "scan_order" | "scan_shelf" | "picked" | "out_for_delivery" | "arrived" | "photo" | "delivered" | "failed";
  code?: string;
  photo?: string;
  otp?: string;
  last4?: string;
  answers?: Record<string, string>;
  reason?: string;
  payMode?: "prepaid" | "cash" | "qr";
}) {
  const store = read();
  const booking = requireDuty(input.email, store, "hyperlocal");
  const job = store.hyperJobs.find((row) => row.id === input.jobId && lower(row.email) === lower(input.email));
  if (!job) throw new Error("Job not found.");
  const order = findShopOrder(job.orderId);
  if (!order) throw new Error("Order not found.");
  const at = new Date().toISOString();
  const log = (status: string) => job.timeline.push({ at, status });
  switch (input.step) {
    case "scan_order":
      if (String(input.code || "").trim().toUpperCase() !== order.id.toUpperCase()) throw new Error("This QR is not for this order.");
      job.orderScanned = at;
      log("Order QR scanned");
      break;
    case "scan_shelf":
      if (!String(input.code || "").trim()) throw new Error("Scan the shelf QR.");
      job.shelfScanned = String(input.code).trim();
      log(`Shelf ${job.shelfScanned} scanned`);
      break;
    case "picked":
      if (!job.orderScanned || !job.shelfScanned) throw new Error("Scan the order QR and the shelf QR first.");
      job.itemsChecked = true;
      job.status = "picked";
      log("Picked from dark store");
      patchShopOrder(order.id, { status: "Packed", history: [...(order.history ?? []), { at, status: "Packed", by: input.name, note: "Picked from dark store by rider" }] });
      break;
    case "out_for_delivery":
      if (job.status !== "picked") throw new Error("Mark the order as picked first.");
      job.status = "out_for_delivery";
      log("Out for delivery");
      patchShopOrder(order.id, { status: "Out for Delivery", history: [...(order.history ?? []), { at, status: "Out for Delivery", by: input.name, note: `Rider ${input.name}` }] });
      break;
    case "arrived":
      job.status = "arrived";
      log("Arrived at customer");
      break;
    case "photo":
      if (input.photo) job.photos.push(input.photo);
      break;
    case "delivered": {
      if (job.status !== "arrived") throw new Error("Mark arrived first.");
      if (!job.photos.length) throw new Error("Take a photo of the shipment first.");
      if (job.openBox) {
        const digits = String(order.deliveryAddress?.phone || "").replace(/\D/g, "");
        if (!input.last4 || digits.slice(-4) !== input.last4.replace(/\D/g, "")) throw new Error("Last 4 digits of the customer's mobile number don't match.");
        const missing = store.settings.obdQuestions.filter((q) => !input.answers?.[q.id]);
        if (missing.length) throw new Error("Answer every open-box question.");
      }
      if (hash(String(input.otp || "").replace(/\D/g, "")) !== job.otpHash) throw new Error("Incorrect delivery OTP.");
      const due = balanceDue(order);
      job.status = "delivered";
      job.answers = input.answers;
      job.payMode = due > 0 ? input.payMode || "cash" : "prepaid";
      log("Delivered");
      patchShopOrder(order.id, {
        status: "Delivered",
        ...(due > 0 ? { paymentStatus: "Paid" as const, amountPaid: order.total, paidAt: at } : {}),
        history: [...(order.history ?? []), { at, status: "Delivered", by: input.name, note: `Delivered by rider ${input.name}${due > 0 ? ` · ₹${due} collected by ${job.payMode === "cash" ? "cash" : "UPI QR"}` : ""}` }],
      });
      store.attempts.unshift({ id: nextId(store, "ATT"), email: lower(input.email), bookingId: booking.id, awb: order.id, orderId: order.id, kind: "hyperlocal", result: "success", payMode: job.payMode, amount: due, answers: input.answers, photos: job.photos, at });
      credit(store, input.email, booking, "hyperlocal", order.id);
      break;
    }
    case "failed":
      if (!input.reason) throw new Error("Pick a reason.");
      job.status = "failed";
      job.reason = input.reason;
      log(`Failed: ${input.reason}`);
      patchShopOrder(order.id, { history: [...(order.history ?? []), { at, status: order.status, by: input.name, note: `Hyperlocal delivery failed: ${input.reason}` }] });
      store.attempts.unshift({ id: nextId(store, "ATT"), email: lower(input.email), bookingId: booking.id, awb: order.id, orderId: order.id, kind: "hyperlocal", result: "failed", reason: input.reason, at });
      break;
  }
  job.updatedAt = at;
  write(store);
  return hyperJobView(job);
}

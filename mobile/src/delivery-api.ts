import { callPortal } from "./portal-api";

export type JobKind = "delivery" | "pickup" | "return" | "obd" | "replacement";

export type ShiftOption = { id: string; name: string; startTime: string; endTime: string; purpose: string; surge: number; bookable: boolean; live: boolean; date: string };
export type ShiftBooking = { id: string; date: string; shiftId: string; shiftName: string; start: string; end: string; mode: "courier" | "hyperlocal"; status: "booked" | "on_duty" | "completed" | "cancelled"; checkInAt?: string };
export type Question = { id: string; text: string; options: string[] };
export type RiderSettings = { rates: Record<string, number>; surge: Record<string, number>; openBoxThreshold: number; failReasons: string[]; obdQuestions: Question[]; returnQuestions: Question[] };
export type Enrollment = { status: "unassigned" | "pending" | "approved" | "rejected"; hubCode?: string; kycPipeline?: { id: string; title: string; reached: boolean }[] };

export type Job = {
  runsheetId: string;
  kind: JobKind;
  awb: string;
  orderId: string;
  status: string;
  customerName: string;
  phone: string;
  address: string;
  pincode: string;
  items: { title: string; quantity: number }[];
  payment: "COD" | "Prepaid";
  amountToCollect: number;
  priority: boolean;
  failedTries: number;
};

export type Runsheet = {
  id: string;
  accepted: boolean;
  total: number;
  counts: Record<JobKind, number>;
  priority: number;
  failed: number;
  cashToCollect: number;
  jobs: Job[];
};

export type ShiftSummary = {
  booking: ShiftBooking | null;
  delivered?: number;
  pickups?: number;
  returns?: number;
  failed?: number;
  cashExpected?: number;
  qrCollected?: number;
  cashOrders?: { awb: string; orderId: string; amount: number }[];
  handover?: { id: string; declared: number; expected: number; difference: number; status: string } | null;
};

export type HyperOffer = { orderId: string; customerName: string; address: string; amount: number; payment: string; items: number; earning: number };
export type HyperJob = {
  id: string;
  orderId: string;
  status: "accepted" | "picked" | "out_for_delivery" | "arrived" | "delivered" | "failed";
  orderScanned?: string;
  shelfScanned?: string;
  photos: string[];
  openBox: boolean;
  customerName: string;
  phone: string;
  address: string;
  items: { title: string; quantity: number; sku?: string }[];
  amountToCollect: number;
  payment: string;
  pickupFrom: string;
  timeline: { at: string; status: string }[];
};

export type Wallet = {
  balance: number;
  today: number;
  todaySurge: number;
  todayJobs: number;
  week: number;
  paidOut: number;
  rates: Record<string, number>;
  surge: Record<string, number>;
  transactions: { id: string; at: string; type: string; amount: number; ref: string; note: string }[];
};

export const rider = {
  home: () => callPortal<{ enrollment: Enrollment; shifts: ShiftOption[]; bookings: ShiftBooking[]; active: ShiftBooking | null; summary: ShiftSummary; settings: RiderSettings }>("rider-home"),
  bookShift: (shiftId: string, mode: "courier" | "hyperlocal") => callPortal<{ booking: ShiftBooking }>("rider-book-shift", { shiftId, mode }),
  cancelShift: (bookingId: string) => callPortal("rider-cancel-shift", { bookingId }),
  checkIn: (bookingId: string) => callPortal<{ booking: ShiftBooking }>("rider-check-in", { bookingId }),
  endShift: () => callPortal("rider-end-shift"),
  runsheets: () => callPortal<{ runsheets: Runsheet[] }>("rider-runsheets"),
  acceptRunsheet: (runsheetId: string) => callPortal("rider-accept-runsheet", { runsheetId }),
  arrive: (awb: string, lat?: number, lng?: number) => callPortal<{ shipments: string[] }>("rider-arrive", { awb, lat, lng }),
  sendOtp: (awbs: string[]) => callPortal<{ sentTo: string; maskedPhone: string }>("rider-send-otp", { awbs }),
  deliver: (input: { awbs: string[]; otp: string; last4?: string; payMode: "prepaid" | "cash" | "qr"; answers?: Record<string, Record<string, string>>; photos?: string[] }) => callPortal<{ delivered: string[] }>("rider-deliver", input),
  fail: (awb: string, kind: JobKind, reason: string, note = "") => callPortal("rider-fail", { awb, kind, reason, note }),
  pickup: (awb: string, otp: string, photos: string[] = []) => callPortal("rider-pickup", { awb, otp, photos }),
  returnPickup: (awb: string, otp: string, answers: Record<string, string>, photos: string[] = []) => callPortal("rider-return-pickup", { awb, otp, answers, photos }),
  summary: () => callPortal<{ summary: ShiftSummary }>("rider-shift-summary"),
  handover: (declared: number, denominations: Record<string, number>, note: string) => callPortal("rider-handover", { declared, denominations, note }),
  wallet: () => callPortal<Wallet>("rider-wallet"),
  hyperOffers: () => callPortal<{ offers: HyperOffer[]; active: HyperJob[] }>("rider-hyper-offers"),
  hyperAccept: (orderId: string) => callPortal<{ job: HyperJob }>("rider-hyper-accept", { orderId }),
  hyperStep: (jobId: string, step: string, extra: Record<string, unknown> = {}) => callPortal<{ job: HyperJob }>("rider-hyper-step", { jobId, step, ...extra }),
  uploadPhoto: (dataUrl: string, kind: string) => callPortal<{ url: string }>("delivery-upload-photo", { dataUrl, kind }),
  codQr: (orderId: string) => callPortal<{ qrData: string; paymentUrl: string; amount: number; referenceId: string }>("delivery-cod-qr", { orderId, provider: "razorpay" }),
  codConfirm: (orderId: string, method: "cash" | "razorpay", referenceId?: string) => callPortal("delivery-cod-confirm", { orderId, method, referenceId }),
  kycSubmit: (data: Record<string, unknown>) => callPortal("delivery-kyc-manual-submit", data),
  requestHub: (hubCode: string) => callPortal("delivery-request-hub", { hubCode }),
};

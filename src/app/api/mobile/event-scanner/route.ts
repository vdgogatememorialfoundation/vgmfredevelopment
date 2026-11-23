import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

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
import { bearerToken } from "@/lib/server/mobile-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEMINAR_ORIGIN = "https://seminar.vaidyagogate.org";
const AUTISM_ORIGIN = "https://autism.vaidyagogate.org";
const SESSIONS_FILE = dataFile("event-scanner-sessions.json");
const SYNC_FILE = dataFile("event-scanner-sync.json");

type PortalId = "seminar" | "autism";

type ScannerUserRecord = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  role: string;
  userRole: string;
};

type EventScannerSession = {
  token: string;
  email: string;
  name: string;
  role: string;
  userRole: string;
  seminarUserId: number | null;
  autismUserId: number | null;
  portals: PortalId[];
  createdAt: string;
};

type SyncedScanRecord = {
  id: string;
  portal: PortalId;
  seminarId: number;
  eventTitle: string;
  ticketId: string;
  applicationNo: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  scannedByEmail: string;
  scannedByName: string;
  outcome: "success" | "duplicate" | "failed";
  message: string;
  scanCount: number;
  at: string;
};

type EventSyncStore = {
  updatedAt: string;
  recentScans: SyncedScanRecord[];
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

function readSessions(): EventScannerSession[] {
  return readJson<EventScannerSession[]>(SESSIONS_FILE, []);
}

function writeSessions(list: EventScannerSession[]) {
  writeJson(SESSIONS_FILE, list.slice(0, 400));
}

function readSyncStore(): EventSyncStore {
  return readJson<EventSyncStore>(SYNC_FILE, { updatedAt: "", recentScans: [] });
}

function recordSyncedScan(entry: SyncedScanRecord) {
  const store = readSyncStore();
  store.updatedAt = new Date().toISOString();
  store.recentScans = [entry, ...(store.recentScans || [])].slice(0, 500);
  writeJson(SYNC_FILE, store);
}

function originFor(portal: PortalId) {
  return portal === "autism" ? AUTISM_ORIGIN : SEMINAR_ORIGIN;
}

async function callPortalMobile(portal: PortalId, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${originFor(portal)}/api/scanner/mobile`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, ok: res.ok && Boolean(data.ok), data };
  } catch (e) {
    return { status: 502, ok: false, data: { ok: false, error: (e as Error).message } };
  }
}

async function resolveBothPortalsForEmail(email: string, primaryPortal: PortalId, primaryUser: ScannerUserRecord) {
  const otherPortal: PortalId = primaryPortal === "seminar" ? "autism" : "seminar";
  const otherRes = await callPortalMobile(otherPortal, { action: "resolve-user", email });
  const otherUser = (otherRes.data.user as ScannerUserRecord | undefined) || null;
  const seminarUser = primaryPortal === "seminar" ? primaryUser : otherUser;
  const autismUser = primaryPortal === "autism" ? primaryUser : otherUser;
  const portals: PortalId[] = [];
  if (seminarUser) portals.push("seminar");
  if (autismUser) portals.push("autism");
  return {
    seminarUserId: seminarUser?.id ?? null,
    autismUserId: autismUser?.id ?? null,
    portals,
  };
}

function issueScannerSession(email: string, primaryUser: ScannerUserRecord, resolved: { seminarUserId: number | null; autismUserId: number | null; portals: PortalId[] }) {
  const token = crypto.randomBytes(24).toString("hex");
  const session: EventScannerSession = {
    token,
    email: primaryUser.email || email,
    name: primaryUser.name || email,
    role: primaryUser.role || "staff",
    userRole: primaryUser.userRole || "scanner_portal_user",
    seminarUserId: resolved.seminarUserId,
    autismUserId: resolved.autismUserId,
    portals: resolved.portals.length ? resolved.portals : ["seminar", "autism"],
    createdAt: new Date().toISOString(),
  };
  const rest = readSessions().filter((s) => s.token !== token);
  rest.unshift(session);
  writeSessions(rest);
  return session;
}

function getSession(request: NextRequest, body?: Record<string, unknown> | null): EventScannerSession | null {
  const tok = bearerToken(request.headers.get("authorization")) ?? String(body?.token ?? "").trim();
  if (!tok) return null;
  return readSessions().find((s) => s.token === tok) ?? null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "events").trim();

  // 1. Password Login (checks Seminar Portal and Autism Portal scanner role accounts)
  if (action === "login") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return json({ ok: false, error: "Enter your scanner email and password." }, 400);

    const [semRes, autRes] = await Promise.all([
      callPortalMobile("seminar", { action: "login", email, password }),
      callPortalMobile("autism", { action: "login", email, password }),
    ]);

    if (semRes.ok && semRes.data.user) {
      const user = semRes.data.user as ScannerUserRecord;
      const resolved = await resolveBothPortalsForEmail(email, "seminar", user);
      const session = issueScannerSession(email, user, resolved);
      return json({ ok: true, session });
    }
    if (autRes.ok && autRes.data.user) {
      const user = autRes.data.user as ScannerUserRecord;
      const resolved = await resolveBothPortalsForEmail(email, "autism", user);
      const session = issueScannerSession(email, user, resolved);
      return json({ ok: true, session });
    }

    const errMsg = String(semRes.data.error || autRes.data.error || "Invalid scanner email or password.");
    return json({ ok: false, error: errMsg }, 401);
  }

  // 2. Send Email OTP (checks Seminar Portal first, then Autism Portal)
  if (action === "send-otp") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return json({ ok: false, error: "Enter your scanner account email." }, 400);
    const preferred = String(body.portal || "").toLowerCase();
    const order: PortalId[] = preferred === "autism" ? ["autism", "seminar"] : ["seminar", "autism"];

    for (const p of order) {
      const res = await callPortalMobile(p, { action: "send-otp", email });
      if (res.ok) {
        return json({
          ok: true,
          otpPortal: p,
          sentTo: res.data.sentTo || email,
          ttlMinutes: res.data.ttlMinutes || 10,
        });
      }
    }
    return json({ ok: false, error: "No scanner role account found with this email on seminar.vaidyagogate.org or autism.vaidyagogate.org." }, 404);
  }

  // 3. Verify Email OTP
  if (action === "verify-otp") {
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const otpPortal: PortalId = String(body.otpPortal || "seminar") === "autism" ? "autism" : "seminar";
    if (!email || !code) return json({ ok: false, error: "Enter the 6-digit OTP code from your email." }, 400);

    const res = await callPortalMobile(otpPortal, { action: "verify-otp", email, code });
    if (!res.ok || !res.data.user) {
      return json({ ok: false, error: String(res.data.error || "Invalid or expired OTP code.") }, 400);
    }
    const user = res.data.user as ScannerUserRecord;
    const resolved = await resolveBothPortalsForEmail(email, otpPortal, user);
    const session = issueScannerSession(email, user, resolved);
    return json({ ok: true, session });
  }

  // Require scanner session for authenticated actions
  const session = getSession(request, body);
  if (!session) {
    return json({ ok: false, error: "Please sign in with a Scanner role account from seminar.vaidyagogate.org or autism.vaidyagogate.org." }, 401);
  }

  // 4. List all events from both seminar.vaidyagogate.org and autism.vaidyagogate.org
  if (action === "events") {
    const [semRes, autRes] = await Promise.all([
      callPortalMobile("seminar", { action: "events" }),
      callPortalMobile("autism", { action: "events" }),
    ]);
    const semEvents = (Array.isArray(semRes.data.events) ? semRes.data.events : []).map((ev: Record<string, unknown>) => ({
      ...ev,
      portal: "seminar" as const,
      portalLabel: "Seminar Portal",
      portalHost: "seminar.vaidyagogate.org",
      key: `seminar:${ev.id}`,
    }));
    const autEvents = (Array.isArray(autRes.data.events) ? autRes.data.events : []).map((ev: Record<string, unknown>) => ({
      ...ev,
      portal: "autism" as const,
      portalLabel: "Autism Portal",
      portalHost: "autism.vaidyagogate.org",
      key: `autism:${ev.id}`,
    }));
    const allEvents = [...semEvents, ...autEvents];
    const syncStore = readSyncStore();
    return json({
      ok: true,
      todayYmd: semRes.data.todayYmd || autRes.data.todayYmd || new Date().toISOString().slice(0, 10),
      events: allEvents,
      recentScans: (syncStore.recentScans || []).slice(0, 40),
    });
  }

  // 5. Update Schedule Scanning Date (checkinEnabled + checkinDate) per event
  if (action === "update-schedule") {
    const portal: PortalId = String(body.portal || "seminar") === "autism" ? "autism" : "seminar";
    const seminarId = Number(body.seminarId || 0);
    const checkinEnabled = Boolean(body.checkinEnabled);
    const checkinDate = String(body.checkinDate || "").trim();
    const res = await callPortalMobile(portal, {
      action: "update-schedule",
      seminarId,
      checkinEnabled,
      checkinDate,
    });
    if (!res.ok) return json({ ok: false, error: String(res.data.error || "Could not update schedule scanning date.") }, 400);
    return json({ ok: true, ...res.data });
  }

  // 6. Fetch live Attendance Roster (Checked-In vs Pending) for a specific event
  if (action === "attendance") {
    const portal: PortalId = String(body.portal || "seminar") === "autism" ? "autism" : "seminar";
    const seminarId = Number(body.seminarId || 0);
    const res = await callPortalMobile(portal, { action: "attendance", seminarId });
    if (!res.ok) return json({ ok: false, error: String(res.data.error || "Could not load attendance list.") }, 400);
    const syncStore = readSyncStore();
    const eventScans = (syncStore.recentScans || []).filter((s) => s.portal === portal && s.seminarId === seminarId).slice(0, 50);
    return json({ ok: true, ...res.data, recentScans: eventScans });
  }

  // 7. Dry-Run Verify Ticket QR / 12-Digit Ticket ID / Application No.
  if (action === "verify") {
    const portal: PortalId = String(body.portal || "seminar") === "autism" ? "autism" : "seminar";
    const seminarId = Number(body.seminarId || 0);
    const qrData = String(body.qrData || body.ticketId || "").trim();
    if (!qrData) return json({ ok: false, error: "Scan a QR code or enter a 12-digit Ticket ID / Application No." }, 400);
    const url = `${originFor(portal)}/api/scanner/verify?ticketId=${encodeURIComponent(qrData)}&seminarId=${encodeURIComponent(String(seminarId))}`;
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return json({ ok: res.ok && Boolean(data.valid), status: res.status, portal, seminarId, result: data });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 502);
    }
  }

  // 8. Mark Entry / Check-In (Enforces Schedule Scanning Date per event + syncs across portals)
  if (action === "mark") {
    const portal: PortalId = String(body.portal || "seminar") === "autism" ? "autism" : "seminar";
    const seminarId = Number(body.seminarId || 0);
    const eventId = body.eventId ? Number(body.eventId) : undefined;
    const dayId = body.dayId ? Number(body.dayId) : undefined;
    const qrData = String(body.qrData || body.ticketId || "").trim();
    if (!seminarId) return json({ ok: false, error: "Select an event before scanning tickets." }, 400);
    if (!qrData) return json({ ok: false, error: "Scan a ticket QR code or enter a Ticket ID / Application No." }, 400);

    // Check Schedule Scanning Date gate on the target portal first!
    const evListRes = await callPortalMobile(portal, { action: "events" });
    const eventsList = (Array.isArray(evListRes.data.events) ? evListRes.data.events : []) as Array<Record<string, unknown>>;
    const targetEv = eventsList.find((e) => Number(e.id) === seminarId);
    if (!targetEv) {
      return json({ ok: false, sound: "error", error: "Selected event was not found on " + originFor(portal) }, 404);
    }
    if (!targetEv.checkinEnabled) {
      return json({
        ok: false,
        sound: "error",
        error: `Scanning is currently disabled for "${targetEv.title}". Enable Schedule Scanning in the event settings first.`,
      }, 403);
    }
    if (!targetEv.checkinOpenToday) {
      const schedDate = String(targetEv.checkinDate || targetEv.eventDate || "scheduled date");
      const todayYmd = String(targetEv.todayYmd || new Date().toISOString().slice(0, 10));
      return json({
        ok: false,
        sound: "wrong_date",
        error: `Scanning is locked by Schedule Scanning Date. This event is scheduled for scanning on ${schedDate} (today is ${todayYmd}).`,
      }, 403);
    }

    const scannerUserId = portal === "autism" ? (session.autismUserId || session.seminarUserId || 1) : (session.seminarUserId || session.autismUserId || 1);
    try {
      const res = await fetch(`${originFor(portal)}/api/scanner/mark`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          qrData,
          scannerUserId,
          seminarId,
          ...(eventId ? { eventId } : {}),
          ...(dayId ? { dayId } : {}),
        }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const doctor = (data.doctor ?? {}) as Record<string, unknown>;
      const success = res.ok && Boolean(data.success);
      const isDuplicate = Boolean(data.alreadyScanned) || String(data.sound || "") === "duplicate";

      recordSyncedScan({
        id: `SCAN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        portal,
        seminarId,
        eventTitle: String(targetEv.title || ""),
        ticketId: String(doctor.ticketId || qrData),
        applicationNo: String(doctor.applicationNo || ""),
        attendeeName: String(doctor.name || "Participant"),
        attendeeEmail: String(doctor.email || ""),
        attendeePhone: String(doctor.phone || ""),
        scannedByEmail: session.email,
        scannedByName: session.name,
        outcome: success ? "success" : isDuplicate ? "duplicate" : "failed",
        message: String(data.message || data.error || (success ? "Checked in" : "Scan failed")),
        scanCount: Number(data.scanCount || doctor.scanCount || (success ? 1 : 0)),
        at: new Date().toISOString(),
      });

      return json({
        ok: success,
        status: res.status,
        portal,
        seminarId,
        eventTitle: String(targetEv.title || ""),
        alreadyScanned: isDuplicate,
        sound: success ? "success" : isDuplicate ? "duplicate" : "error",
        message: String(data.message || data.error || ""),
        error: success ? undefined : String(data.error || data.message || "Ticket check-in failed."),
        doctor,
        raw: data,
      }, res.ok ? 200 : res.status);
    } catch (e) {
      return json({ ok: false, sound: "error", error: (e as Error).message }, 502);
    }
  }

  return json({ ok: false, error: "Unknown event-scanner action." }, 400);
}

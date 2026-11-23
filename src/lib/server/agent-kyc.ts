import crypto from "node:crypto";
import { readLogisticsStore, writeLogisticsStore } from "@/lib/server/vgmf-logistics";
import { readLogisticsSettings } from "@/lib/server/vgmf-logistics-settings";
import { sendMobileEmail } from "@/lib/server/mobile-mail";

export type RiderKycEmail = "instructions" | "submitted" | "approved" | "declined" | "reinitiated" | "activated" | "rejected";

/** Emails the delivery agent about a KYC / activation change. Never throws. */
export function emailRiderKyc(email: string, kind: RiderKycEmail, detail = "") {
  const rec = readLogisticsStore().agentEnrollments.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  const name = rec?.name && !rec.name.includes("@") ? rec.name : "";
  const link = (rec as { onboardingLink?: string } | undefined)?.onboardingLink;
  const where = link
    ? `Open your sign-up link: https://vaidyagogate.org/rider/join/${link}`
    : "Open the VGMF Delivery app (https://vaidyagogate.org/apps/vgmf-delivery.apk) and sign in.";
  const steps = `How to complete KYC:\n1. ${where}\n2. Keep your original ID ready (Aadhaar, PAN, driving licence, voter ID or passport).\n3. Allow camera access, photograph your ID, then take a live selfie in good light.\n4. Wait for the result. We email you when it changes.`;
  const content: Record<RiderKycEmail, [string, string]> = {
    instructions: ["Complete your KYC to start delivering", `Thank you for signing up as a delivery partner.\n\n${steps}`],
    submitted: ["Your KYC is under review", `We received your KYC. It is being checked${detail ? ` (${detail})` : ""}. We will email you once it is reviewed.`],
    approved: ["Your KYC is verified", `Your ID has been verified.${rec?.status === "approved" ? "" : ` Hub ${rec?.hubCode || ""} will now activate your account.`}`],
    declined: ["Your KYC could not be verified", `Your KYC could not be verified.${detail ? `\nReason: ${detail}` : ""}\n\nPlease contact your hub, or wait for us to ask you to submit KYC again.`],
    reinitiated: ["Please submit your KYC again", `We need you to complete KYC again.${detail ? `\nReason: ${detail}` : ""}\n\n${steps}`],
    activated: ["Your delivery partner account is active", `Your account is now active at hub ${rec?.hubCode || ""}. Open the VGMF Delivery app, book a shift and check in to get work.`],
    rejected: ["Your delivery partner application was not approved", `Your application was not approved.${detail ? `\nReason: ${detail}` : ""}\n\nContact your hub if you have questions.`],
  };
  const [subject, body] = content[kind];
  void sendMobileEmail(rec?.email || email, `${subject} · VGMF Delivery`, `Namaste${name ? ` ${name}` : ""},\n\n${body}\n\nVaidya Gogate Memorial Foundation`).catch(() => false);
}

export type AgentKycStatus =
  | "Not Started"
  | "In Progress"
  | "In Review"
  | "Approved"
  | "Declined"
  | "Expired";

export type AgentKycEvent = {
  at: string;
  status: string;
  note?: string;
};

export type AgentKycData = {
  provider: "manual" | "accurascan" | "voveid";
  voveStatus?: string;
  sessionId?: string;
  status: AgentKycStatus;
  updatedAt?: string;
  verifiedAt?: string;
  declinedReason?: string;
  documentType?: string;
  documentNumber?: string;
  idPhotoUrl?: string;
  selfiePhotoUrl?: string;
  reviewedBy?: string;
  faceMatchScore?: number;
  livenessScore?: number;
  accuraOcrData?: Record<string, string>;
  events: AgentKycEvent[];
};

export function getEnabledKycProviders() {
  const s = readLogisticsSettings().current;
  const kp = s.kycProviders || {
    manualEnabled: true,
    accuraScanEnabled: true,
    defaultProvider: "manual" as const,
    mandatoryBeforeActivation: true,
  };
  const accuraScanConfigured = Boolean((s.accuraScan?.apiKey || process.env.ACCURASCAN_API_KEY || "").trim());
  const vc = voveConfig();
  return {
    manualEnabled: kp.manualEnabled !== false,
    accuraScanEnabled: kp.accuraScanEnabled !== false,
    voveIdEnabled: kp.voveIdEnabled === true,
    defaultProvider: (kp.defaultProvider === "accurascan" || kp.defaultProvider === "voveid" ? kp.defaultProvider : "manual") as "manual" | "accurascan" | "voveid",
    mandatoryBeforeActivation: kp.mandatoryBeforeActivation !== false,
    accuraScanConfigured,
    voveIdConfigured: Boolean(vc.apiKey && vc.publicKey),
    voveIdEnvironment: vc.environment,
  };
}

/* ---------------- VOVE ID (docs.voveid.com) ---------------- */

function voveConfig() {
  const v = readLogisticsSettings().current.voveId;
  const environment: "Sandbox" | "Production" = v?.environment === "Sandbox" ? "Sandbox" : "Production";
  const tld = environment === "Sandbox" ? "net" : "com";
  return {
    environment,
    apiBase: `https://api.voveid.${tld}`,
    hostedBase: `https://web.voveid.${tld}`,
    apiKey: (v?.apiKey || process.env.VOVE_API_KEY || "").trim(),
    publicKey: (v?.publicKey || process.env.VOVE_PUBLIC_KEY || "").trim(),
    webhookSecret: (v?.webhookSecret || process.env.VOVE_WEBHOOK_SECRET || "").trim(),
    flowId: (v?.flowId || "").trim(),
    autoApproveOnSuccess: v?.autoApproveOnSuccess !== false,
  };
}

export const VOVE_DONE_URL = "https://vaidyagogate.org/kyc/voveid-done";

function voveRefId(email: string) {
  return `vgmf-rider-${crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 20)}`;
}

function findEnrollment(store: ReturnType<typeof readLogisticsStore>, email: string) {
  return store.agentEnrollments.find((a) => a.email.toLowerCase() === email);
}

export async function testVoveIdKey(override?: { apiKey?: string; environment?: string }) {
  const cfg = voveConfig();
  const apiKey = (override?.apiKey || cfg.apiKey).trim();
  if (!apiKey) return { ok: false, message: "No VOVE ID API key is saved yet." };
  const base = override?.environment === "Sandbox" ? "https://api.voveid.net" : override?.environment === "Production" ? "https://api.voveid.com" : cfg.apiBase;
  try {
    const res = await fetch(`${base}/v2/users/${encodeURIComponent("vgmf-key-check")}`, { headers: { "x-api-key": apiKey, accept: "application/json" } });
    if (res.status === 401 || res.status === 403) return { ok: false, message: `VOVE ID rejected this key (HTTP ${res.status}). Check that the key and the Sandbox/Production setting match.` };
    if (res.ok || res.status === 404) return { ok: true, message: "VOVE ID accepted the key." };
    return { ok: false, message: `VOVE ID answered HTTP ${res.status}. Try again in a minute.` };
  } catch {
    return { ok: false, message: "Could not reach VOVE ID from the server." };
  }
}

export async function startVoveIdKyc(input: { email: string; name?: string; documentType?: string; restart?: boolean; returnUrl?: string }) {
  const enabled = getEnabledKycProviders();
  if (!enabled.voveIdEnabled) throw new Error("VOVE ID KYC is switched off in Admin Logistics Settings.");
  const cfg = voveConfig();
  if (!cfg.apiKey || !cfg.publicKey) throw new Error("VOVE ID keys are not set yet. Ask Admin to add them in Logistics Settings -> Delivery Partners.");
  const email = input.email.trim().toLowerCase();
  const refId = voveRefId(email);
  const [firstName, ...rest] = (input.name || "").trim().split(/\s+/);
  const body: Record<string, unknown> = { refId, forceCreation: Boolean(input.restart) };
  if (cfg.flowId) body.flowId = cfg.flowId;
  if (firstName && !firstName.includes("@")) body.user = { firstName, lastName: rest.join(" ") || undefined };
  const res = await fetch(`${cfg.apiBase}/v2/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "x-api-key": cfg.apiKey },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { token?: string; message?: string; error?: string };
  if (!res.ok || !json.token) {
    throw new Error(res.status === 401 || res.status === 403 ? "VOVE ID rejected the API key. Ask Admin to check it." : `VOVE ID could not start verification (${json.message || json.error || `HTTP ${res.status}`}).`);
  }
  const store = readLogisticsStore();
  const now = new Date().toISOString();
  let rec = findEnrollment(store, email);
  if (!rec) {
    rec = { email, name: input.name || email, hubCode: "", status: "pending", requestedAt: now };
    store.agentEnrollments.unshift(rec);
  }
  const prev = (rec as unknown as { kyc?: AgentKycData }).kyc;
  const keep = prev?.provider === "voveid" && prev.status === "Approved" && !input.restart;
  (rec as unknown as { kyc?: AgentKycData }).kyc = keep ? prev : {
    ...(prev?.provider === "voveid" ? prev : {}),
    provider: "voveid",
    sessionId: refId,
    status: "In Progress",
    documentType: input.documentType || prev?.documentType || "Aadhaar Card",
    updatedAt: now,
    events: [...(prev?.events || []), { at: now, status: "VOVE ID verification started" }],
  };
  writeLogisticsStore(store);
  const url = new URL("/", cfg.hostedBase);
  url.searchParams.set("authToken", json.token);
  url.searchParams.set("publicKey", cfg.publicKey);
  url.searchParams.set("environment", cfg.environment);
  url.searchParams.set("lg", "en");
  url.searchParams.set("showUI", "true");
  const doneUrl = input.returnUrl?.startsWith("https://vaidyagogate.org/") ? input.returnUrl : VOVE_DONE_URL;
  url.searchParams.set("redirectURL", doneUrl);
  return { refId, url: url.toString(), doneUrl };
}

/** Reads the authoritative result from VOVE ID (GET /v2/users/{refId}) and updates the rider's KYC. */
export async function syncVoveIdKyc(input: { email?: string; refId?: string; webhookStatus?: string }) {
  const cfg = voveConfig();
  if (!cfg.apiKey) throw new Error("VOVE ID API key is not set.");
  const store = readLogisticsStore();
  const email = input.email?.trim().toLowerCase();
  const rec = email
    ? findEnrollment(store, email)
    : store.agentEnrollments.find((a) => (a as unknown as { kyc?: AgentKycData }).kyc?.sessionId === input.refId);
  if (!rec) return null;
  const refId = input.refId || voveRefId(rec.email);
  const res = await fetch(`${cfg.apiBase}/v2/users/${encodeURIComponent(refId)}`, { headers: { "x-api-key": cfg.apiKey, accept: "application/json" } });
  if (res.status === 404) return (rec as unknown as { kyc?: AgentKycData }).kyc || null;
  if (!res.ok) throw new Error(`VOVE ID result could not be read (HTTP ${res.status}).`);
  const v = (await res.json().catch(() => ({}))) as {
    status?: string;
    documents?: Array<Record<string, unknown>>;
  };
  const voveStatus = String(v.status || "");
  const doc = v.documents?.[0] || {};
  const docData: Record<string, string> = {};
  for (const k of ["type", "fullName", "firstName", "lastName", "idNumber", "dateOfBirth", "issuingCountry", "digitalIDSpoof", "faceOnDocumentSpoof", "textOnDocumentSpoof", "matchLevel"]) {
    const val = doc[k];
    if (val !== undefined && val !== null && String(val).trim()) docData[k] = String(val).trim();
  }
  const prev = (rec as unknown as { kyc?: AgentKycData }).kyc;
  let status: AgentKycStatus;
  let note: string;
  if (voveStatus === "successful" && input.webhookStatus !== "suspected") {
    status = cfg.autoApproveOnSuccess ? "Approved" : "In Review";
    note = cfg.autoApproveOnSuccess ? "Verified by VOVE ID (ID document and liveness passed)." : "VOVE ID passed. Waiting for hub review.";
  } else if (voveStatus === "open" || voveStatus === "in-progress") {
    status = input.webhookStatus === "pending" || input.webhookStatus === "suspected" ? "In Review" : "In Progress";
    note = input.webhookStatus === "suspected" ? "VOVE ID flagged this verification as suspected. Hub must review." : `VOVE ID status: ${voveStatus}.`;
  } else {
    status = "In Review";
    note = `VOVE ID status "${voveStatus || input.webhookStatus || "unknown"}". Sent to the hub for review.`;
  }
  if (prev?.status === status && prev?.voveStatus === voveStatus) return prev;
  const now = new Date().toISOString();
  const kyc: AgentKycData = {
    ...(prev || { events: [] }),
    provider: "voveid",
    sessionId: refId,
    status,
    voveStatus,
    documentNumber: prev?.documentNumber || docData.idNumber || "",
    accuraOcrData: Object.keys(docData).length ? docData : prev?.accuraOcrData,
    updatedAt: now,
    verifiedAt: status === "Approved" ? now : prev?.verifiedAt,
    events: [...(prev?.events || []), { at: now, status: `VOVE ID KYC: ${status}`, note }],
  };
  (rec as unknown as { kyc?: AgentKycData }).kyc = kyc;
  writeLogisticsStore(store);
  if (status !== "In Progress" && prev?.status !== status) emailRiderKyc(rec.email, status === "Approved" ? "approved" : "submitted");
  return kyc;
}

/** Svix signature check for VOVE ID webhooks (svix-id.svix-timestamp.body, HMAC-SHA256). */
export function verifyVoveWebhook(raw: string, headers: { id: string; timestamp: string; signature: string }) {
  const secret = voveConfig().webhookSecret;
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = crypto.createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${raw}`).digest();
  return headers.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
}

export function buildKycPipelineStages(enrollment: {
  status: "unassigned" | "pending" | "approved" | "rejected";
  hubCode?: string;
  requestedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  kyc?: AgentKycData;
}) {
  const kyc = enrollment.kyc;
  const kycStatus: AgentKycStatus = kyc?.status || "Not Started";
  const hasHub = Boolean(enrollment.hubCode && enrollment.status !== "unassigned");
  const submitted = Boolean(kyc?.sessionId || kyc?.documentNumber);
  const inVerification = ["In Progress", "In Review", "Approved", "Declined"].includes(kycStatus);
  const kycApproved = kycStatus === "Approved";
  const kycDeclined = kycStatus === "Declined" || kycStatus === "Expired";
  const activated = enrollment.status === "approved";

  return [
    {
      id: "hub_selected",
      title: "Hub Selected & Application Submitted",
      state: hasHub ? "done" : "current",
      at: enrollment.requestedAt || undefined,
      detail: hasHub ? `Hub ${enrollment.hubCode} selected` : "Select your VGMF Hub to begin",
    },
    {
      id: "kyc_session",
      title: kyc?.provider === "accurascan" ? "AccuraScan AI KYC Submitted" : kyc?.provider === "voveid" ? "VOVE ID Verification Started" : "KYC Documents Submitted",
      state: submitted ? "done" : hasHub ? "current" : "pending",
      at: kyc?.events?.[0]?.at || undefined,
      detail: kyc?.sessionId ? `Ref ${kyc.sessionId}` : "Submit ID & Selfie verification",
    },
    {
      id: "kyc_review",
      title: "Identity & Document Verification",
      state: kycApproved ? "done" : kycDeclined ? "failed" : inVerification ? "current" : "pending",
      at: kyc?.updatedAt || undefined,
      detail:
        kyc?.provider === "accurascan" && (kyc.faceMatchScore !== undefined || kyc.livenessScore !== undefined)
          ? `AccuraScan · Face ${kyc.faceMatchScore ?? "—"}% · Liveness ${kyc.livenessScore ?? "—"}% (${kycStatus})`
          : kyc?.provider === "voveid"
            ? `VOVE ID · ${kyc.voveStatus || "in progress"} (${kycStatus})`
            : kycStatus === "In Review"
            ? "Under Admin verification review"
            : kycStatus,
    },
    {
      id: "kyc_verified",
      title: "KYC Approved",
      state: kycApproved ? "done" : kycDeclined ? "failed" : "pending",
      at: kyc?.verifiedAt || undefined,
      detail: kycApproved ? "Identity verified" : kycDeclined ? (kyc?.declinedReason || "KYC declined — please resubmit") : "Awaiting KYC approval",
    },
    {
      id: "hub_activated",
      title: "Hub Manager Activation",
      state: activated ? "done" : kycApproved ? "current" : "pending",
      at: enrollment.reviewedAt || undefined,
      detail: activated ? `Activated by ${enrollment.reviewedBy || "Hub Manager"}` : "Awaiting final hub activation",
    },
  ];
}

export function submitManualKyc(input: {
  email: string;
  name?: string;
  documentType: string;
  documentNumber: string;
  idPhotoUrl?: string;
  selfiePhotoUrl?: string;
}) {
  if (!getEnabledKycProviders().manualEnabled) {
    throw new Error("Manual KYC is currently disabled in Admin Logistics Settings.");
  }
  const cleanEmail = input.email.trim().toLowerCase();
  if (!input.documentType.trim() || !input.documentNumber.trim()) {
    throw new Error("Document type and document number are required for manual KYC.");
  }
  const store = readLogisticsStore();
  let rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === cleanEmail);
  const now = new Date().toISOString();
  if (!rec) {
    rec = {
      email: cleanEmail,
      name: input.name || cleanEmail,
      hubCode: "",
      status: "pending",
      requestedAt: now,
    };
    store.agentEnrollments.unshift(rec);
  }
  const prevEvents = (rec as unknown as { kyc?: AgentKycData }).kyc?.events || [];
  const kyc: AgentKycData = {
    provider: "manual",
    sessionId: `MAN-KYC-${Date.now().toString().slice(-6)}`,
    status: "In Review",
    documentType: input.documentType.trim(),
    documentNumber: input.documentNumber.trim(),
    idPhotoUrl: input.idPhotoUrl || "",
    selfiePhotoUrl: input.selfiePhotoUrl || "",
    updatedAt: now,
    events: [
      ...prevEvents,
      { at: now, status: "Manual KYC Submitted", note: `${input.documentType.trim()} (${input.documentNumber.trim()})` },
    ],
  };
  (rec as unknown as { kyc?: AgentKycData }).kyc = kyc;
  writeLogisticsStore(store);
  emailRiderKyc(rec.email, "submitted");
  return { kyc, pipeline: buildKycPipelineStages({ ...rec, kyc }) };
}

export function reviewManualKyc(input: { email: string; approve: boolean; reason?: string; by: string }) {
  const cleanEmail = input.email.trim().toLowerCase();
  const store = readLogisticsStore();
  const rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === cleanEmail);
  if (!rec) throw new Error("Agent enrollment not found.");
  const now = new Date().toISOString();
  const prev = (rec as unknown as { kyc?: AgentKycData }).kyc || {
    provider: "manual" as const,
    status: "In Review" as const,
    events: [],
  };
  const nextStatus: AgentKycStatus = input.approve ? "Approved" : "Declined";
  const kyc: AgentKycData = {
    ...prev,
    provider: prev.provider || "manual",
    status: nextStatus,
    updatedAt: now,
    verifiedAt: input.approve ? now : prev.verifiedAt,
    declinedReason: input.approve ? undefined : (input.reason?.trim() || "Declined during KYC review"),
    reviewedBy: input.by,
    events: [
      ...(prev.events || []),
      { at: now, status: input.approve ? "KYC Approved" : "KYC Declined", note: input.approve ? `Verified by ${input.by}` : (input.reason?.trim() || "Declined") },
    ],
  };
  (rec as unknown as { kyc?: AgentKycData }).kyc = kyc;
  writeLogisticsStore(store);
  emailRiderKyc(rec.email, input.approve ? "approved" : "declined", kyc.declinedReason || "");
  return { kyc, pipeline: buildKycPipelineStages({ ...rec, kyc }) };
}

export function reinitiateAgentKyc(input: { email: string; reason?: string; by: string }) {
  const cleanEmail = input.email.trim().toLowerCase();
  const store = readLogisticsStore();
  const rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === cleanEmail);
  if (!rec) throw new Error("Agent enrollment not found.");
  const now = new Date().toISOString();
  const prev = (rec as unknown as { kyc?: AgentKycData }).kyc;
  const enabled = getEnabledKycProviders();
  const kyc: AgentKycData = {
    provider: enabled.defaultProvider,
    status: "Not Started",
    updatedAt: now,
    reviewedBy: input.by,
    events: [
      ...(prev?.events || []),
      {
        at: now,
        status: "KYC Re-initiated by Admin",
        note: input.reason?.trim() || `Fresh KYC requested by ${input.by}`,
      },
    ],
  };
  (rec as unknown as { kyc?: AgentKycData }).kyc = kyc;
  if (enabled.mandatoryBeforeActivation && rec.status === "approved") {
    rec.status = "pending";
  }
  writeLogisticsStore(store);
  emailRiderKyc(rec.email, "reinitiated", input.reason?.trim() || "");
  return { kyc, pipeline: buildKycPipelineStages({ ...rec, kyc }) };
}

function accuraConfig() {
  const s = readLogisticsSettings().current;
  const a = s.accuraScan || {
    apiKey: "",
    apiBaseUrl: "https://api.accurascan.com",
    countryCode: "IND",
    minFaceMatchScore: 70,
    minLivenessScore: 55,
    autoApproveOnPass: true,
  };
  return {
    apiKey: (a.apiKey || process.env.ACCURASCAN_API_KEY || "").trim(),
    apiBaseUrl: (a.apiBaseUrl || "https://api.accurascan.com").trim().replace(/\/+$/, ""),
    countryCode: (a.countryCode || "IND").trim().toUpperCase(),
    minFaceMatchScore: Number(a.minFaceMatchScore || 70),
    minLivenessScore: Number(a.minLivenessScore || 55),
    autoApproveOnPass: a.autoApproveOnPass !== false,
  };
}

async function accuraJpeg(b64: string): Promise<Blob> {
  const original = Buffer.from(b64, "base64");
  let out: Buffer = original;
  try {
    const sharp = (await import("sharp")).default;
    for (const [size, quality] of [[1600, 82], [1280, 74], [1024, 66], [800, 58]] as const) {
      out = await sharp(original).rotate().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).jpeg({ quality }).toBuffer();
      if (out.length < 950_000) break;
    }
  } catch {
    out = original;
  }
  return new Blob([new Uint8Array(out)], { type: "image/jpeg" });
}

function accuraError(json: Record<string, unknown>): string {
  const status = json.status ?? json.Status;
  const message = String(json.message ?? json.Message ?? json.error ?? "").trim();
  if (status === false || String(status).toLowerCase() === "fail" || (json.error !== undefined && status !== true)) {
    return message || "Request failed";
  }
  return "";
}

export async function testAccuraScanKey(apiKeyOverride?: string) {
  const cfg = accuraConfig();
  const apiKey = (apiKeyOverride || cfg.apiKey).trim();
  if (!apiKey) return { ok: false, message: "No AccuraScan API key is saved yet." };
  const sharp = (await import("sharp")).default;
  const img = await sharp({ create: { width: 96, height: 96, channels: 3, background: "#c8a080" } }).jpeg().toBuffer();
  const form = new FormData();
  form.append("liveness_image", new Blob([new Uint8Array(img)], { type: "image/jpeg" }), "test.jpg");
  try {
    const res = await fetch(`${cfg.apiBaseUrl}/v2/api/liveness`, { method: "POST", headers: { "Api-Key": apiKey }, body: form });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const err = accuraError(json);
    if (err && /api ?key|unauthori[sz]ed|forbidden/i.test(err)) {
      return { ok: false, message: `AccuraScan rejected this key: "${err}". Copy the Web API key from your AccuraScan account and save it again.` };
    }
    return { ok: true, message: "AccuraScan accepted the key. Rider KYC will be checked automatically." };
  } catch (e) {
    return { ok: false, message: `Could not reach AccuraScan: ${e instanceof Error ? e.message : "network error"}` };
  }
}

function stripDataUri(b64?: string): string {
  if (!b64) return "";
  return b64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").trim();
}

function mapAccuraCardCode(docType: string): string {
  const v = docType.toLowerCase();
  if (v.includes("passport") || v.includes("mrz")) return "MRZ";
  if (v.includes("pan")) return "PANCARD";
  if (v.includes("driving") || v.includes("dl")) return "INDDLF";
  if (v.includes("voter")) return "INDVID";
  return "AADHARFF";
}

function extractNumericScore(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const val = obj[k];
    if (typeof val === "number" && Number.isFinite(val)) return Math.round(val * 10) / 10;
    if (typeof val === "string" && val.trim() !== "" && Number.isFinite(Number(val.replace(/%/g, "")))) {
      return Math.round(Number(val.replace(/%/g, "")) * 10) / 10;
    }
  }
  const data = obj.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object") {
    for (const k of keys) {
      const val = data[k];
      if (typeof val === "number" && Number.isFinite(val)) return Math.round(val * 10) / 10;
      if (typeof val === "string" && val.trim() !== "" && Number.isFinite(Number(val.replace(/%/g, "")))) {
        return Math.round(Number(val.replace(/%/g, "")) * 10) / 10;
      }
    }
  }
  return undefined;
}

export async function submitAccuraScanKyc(input: {
  email: string;
  name?: string;
  documentType: string;
  documentNumber: string;
  idPhotoBase64?: string;
  selfiePhotoBase64?: string;
  idPhotoUrl?: string;
  selfiePhotoUrl?: string;
}) {
  const enabled = getEnabledKycProviders();
  if (!enabled.accuraScanEnabled) {
    throw new Error("AccuraScan KYC is currently disabled in Admin Logistics Settings.");
  }
  const cfg = accuraConfig();
  if (!cfg.apiKey) {
    throw new Error("AccuraScan API Key is not configured yet. Ask Admin to add it in Logistics Settings -> Delivery Partners -> AccuraScan KYC.");
  }
  const cleanEmail = input.email.trim().toLowerCase();
  const idB64 = stripDataUri(input.idPhotoBase64);
  const selfieB64 = stripDataUri(input.selfiePhotoBase64);
  if (!idB64 && !input.idPhotoUrl) {
    throw new Error("Please capture or upload the ID document photo for AccuraScan OCR.");
  }
  if (!selfieB64 && !input.selfiePhotoUrl) {
    throw new Error("Please capture a live selfie photo for AccuraScan Face Match & Liveness.");
  }

  const cardCode = mapAccuraCardCode(input.documentType || "Aadhaar Card");
  const headers: Record<string, string> = { "Api-Key": cfg.apiKey };

  // 1. Document OCR (POST /api/v4/ocr)
  const ocrForm = new FormData();
  ocrForm.append("country_code", cfg.countryCode);
  ocrForm.append("card_code", cardCode);
  if (idB64) {
    ocrForm.append("scan_image", await accuraJpeg(idB64), "id-document.jpg");
  } else if (input.idPhotoUrl) {
    ocrForm.append("scan_image_url", input.idPhotoUrl);
  }

  let ocrJson: Record<string, unknown> = {};
  let ocrOk = false;
  let extractedPortraitB64 = "";
  const vendorErrors: string[] = [];
  try {
    const ocrRes = await fetch(`${cfg.apiBaseUrl}/api/v4/ocr`, { method: "POST", headers, body: ocrForm });
    ocrJson = (await ocrRes.json().catch(() => ({}))) as Record<string, unknown>;
    const ocrErr = accuraError(ocrJson);
    if (ocrErr) vendorErrors.push(`ID scan: ${ocrErr}`);
    ocrOk = ocrRes.ok && !ocrErr;
    const dataObj = (ocrJson.data || ocrJson) as Record<string, unknown>;
    if (typeof dataObj.face_image === "string") extractedPortraitB64 = stripDataUri(dataObj.face_image);
    else if (typeof dataObj.portrait === "string") extractedPortraitB64 = stripDataUri(dataObj.portrait);
  } catch (e) {
    ocrJson = { error: e instanceof Error ? e.message : "OCR request failed" };
    vendorErrors.push("ID scan: could not reach AccuraScan");
  }

  // 2. Face Liveness (POST /v2/api/liveness)
  let livenessJson: Record<string, unknown> = {};
  let livenessScore: number | undefined;
  try {
    const liveForm = new FormData();
    if (selfieB64) {
      liveForm.append("liveness_image", await accuraJpeg(selfieB64), "selfie.jpg");
    } else if (input.selfiePhotoUrl) {
      liveForm.append("liveness_image", input.selfiePhotoUrl);
    }
    const liveRes = await fetch(`${cfg.apiBaseUrl}/v2/api/liveness`, { method: "POST", headers, body: liveForm });
    livenessJson = (await liveRes.json().catch(() => ({}))) as Record<string, unknown>;
    const liveErr = accuraError(livenessJson);
    if (liveErr) vendorErrors.push(`Liveness: ${liveErr}`);
    else livenessScore = extractNumericScore(livenessJson, ["liveness_score", "score", "livenessScore", "probability"]);
  } catch (e) {
    livenessJson = { error: e instanceof Error ? e.message : "Liveness request failed" };
    vendorErrors.push("Liveness: could not reach AccuraScan");
  }

  // 3. Face Match 1:1 (POST /v2/api/facematch)
  let fmJson: Record<string, unknown> = {};
  let faceMatchScore: number | undefined;
  try {
    const fmForm = new FormData();
    const idSourceB64 = extractedPortraitB64 || idB64;
    if (idSourceB64) {
      fmForm.append("source_file", await accuraJpeg(idSourceB64), "id-face.jpg");
    }
    if (selfieB64) {
      fmForm.append("target_file", await accuraJpeg(selfieB64), "selfie.jpg");
    }
    const fmRes = await fetch(`${cfg.apiBaseUrl}/v2/api/facematch`, { method: "POST", headers, body: fmForm });
    fmJson = (await fmRes.json().catch(() => ({}))) as Record<string, unknown>;
    const fmErr = accuraError(fmJson);
    if (fmErr) vendorErrors.push(`Face match: ${fmErr}`);
    else faceMatchScore = extractNumericScore(fmJson, ["score", "match_score", "face_match_score", "similarity"]);
  } catch (e) {
    fmJson = { error: e instanceof Error ? e.message : "FaceMatch request failed" };
    vendorErrors.push("Face match: could not reach AccuraScan");
  }

  const accuraOcrData: Record<string, string> = {};
  const ocrDataObj = ((ocrJson.data as Record<string, unknown>) || ocrJson) as Record<string, unknown>;
  for (const [k, v] of Object.entries(ocrDataObj)) {
    if (typeof v === "string" && v.trim() && v.length < 180 && !k.toLowerCase().includes("image") && !k.toLowerCase().includes("base64")) {
      accuraOcrData[k] = v.trim();
    }
  }

  const facePassed = faceMatchScore !== undefined && faceMatchScore >= cfg.minFaceMatchScore;
  const livenessPassed = livenessScore !== undefined && livenessScore >= cfg.minLivenessScore;

  let nextStatus: AgentKycStatus = "In Review";
  let note = `AccuraScan OCR (${ocrOk ? "OK" : "Manual Review"}) · Face: ${faceMatchScore ?? "N/A"}% · Liveness: ${livenessScore ?? "N/A"}%`;
  if (vendorErrors.length) {
    note = `AccuraScan could not verify (${Array.from(new Set(vendorErrors)).join("; ")}). Sent to the hub for manual review.`;
  } else if (cfg.autoApproveOnPass && facePassed && livenessPassed) {
    nextStatus = "Approved";
    note = `Auto-approved by AccuraScan AI (Face ${faceMatchScore}% >= ${cfg.minFaceMatchScore}%, Liveness ${livenessScore}% >= ${cfg.minLivenessScore}%)`;
  }

  const store = readLogisticsStore();
  let rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === cleanEmail);
  const now = new Date().toISOString();
  if (!rec) {
    rec = { email: cleanEmail, name: input.name || cleanEmail, hubCode: "", status: "pending", requestedAt: now };
    store.agentEnrollments.unshift(rec);
  }
  const prevEvents = (rec as unknown as { kyc?: AgentKycData }).kyc?.events || [];
  const kyc: AgentKycData = {
    provider: "accurascan",
    sessionId: `ACC-KYC-${Date.now().toString().slice(-6)}`,
    status: nextStatus,
    documentType: input.documentType.trim() || "Aadhaar Card",
    documentNumber: input.documentNumber.trim() || accuraOcrData.document_number || accuraOcrData.card_number || "",
    idPhotoUrl: input.idPhotoUrl || "",
    selfiePhotoUrl: input.selfiePhotoUrl || "",
    faceMatchScore,
    livenessScore,
    accuraOcrData: Object.keys(accuraOcrData).length ? accuraOcrData : undefined,
    updatedAt: now,
    verifiedAt: nextStatus === "Approved" ? now : undefined,
    events: [...prevEvents, { at: now, status: `AccuraScan KYC: ${nextStatus}`, note }],
  };
  (rec as unknown as { kyc?: AgentKycData }).kyc = kyc;
  writeLogisticsStore(store);
  emailRiderKyc(rec.email, nextStatus === "Approved" ? "approved" : "submitted");
  return { kyc, pipeline: buildKycPipelineStages({ ...rec, kyc }), ocrOk, faceMatchScore, livenessScore, vendorErrors };
}

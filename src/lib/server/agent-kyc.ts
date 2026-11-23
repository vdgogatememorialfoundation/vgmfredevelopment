import { readLogisticsStore, writeLogisticsStore } from "@/lib/server/vgmf-logistics";
import { readLogisticsSettings } from "@/lib/server/vgmf-logistics-settings";

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
  provider: "manual" | "accurascan";
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
  return {
    manualEnabled: kp.manualEnabled !== false,
    accuraScanEnabled: kp.accuraScanEnabled !== false,
    defaultProvider: (kp.defaultProvider === "accurascan" ? "accurascan" : "manual") as "manual" | "accurascan",
    mandatoryBeforeActivation: kp.mandatoryBeforeActivation !== false,
    accuraScanConfigured,
  };
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
      title: kyc?.provider === "accurascan" ? "AccuraScan AI KYC Submitted" : "KYC Documents Submitted",
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
    provider: prev.provider === "accurascan" ? "accurascan" : "manual",
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
    provider: enabled.defaultProvider || "manual",
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

function stripDataUri(b64?: string): string {
  if (!b64) return "";
  return b64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").trim();
}

function mapAccuraCardCode(docType: string): string {
  const v = docType.toLowerCase();
  if (v.includes("passport") || v.includes("mrz")) return "MRZ";
  if (v.includes("pan")) return "PAN";
  if (v.includes("driving") || v.includes("dl")) return "DL";
  if (v.includes("voter")) return "VOTER";
  return "AADHAAR";
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
    const idBuf = Buffer.from(idB64, "base64");
    ocrForm.append("scan_image", new Blob([idBuf], { type: "image/jpeg" }), "id-document.jpg");
    ocrForm.append("scan_image_base64", idB64);
  } else if (input.idPhotoUrl) {
    ocrForm.append("scan_image_url", input.idPhotoUrl);
  }

  let ocrJson: Record<string, unknown> = {};
  let ocrOk = false;
  let extractedPortraitB64 = "";
  try {
    const ocrRes = await fetch(`${cfg.apiBaseUrl}/api/v4/ocr`, { method: "POST", headers, body: ocrForm });
    ocrJson = (await ocrRes.json().catch(() => ({}))) as Record<string, unknown>;
    ocrOk = ocrRes.ok && (ocrJson.status === true || ocrJson.status === "success" || ocrJson.status === 200 || Boolean(ocrJson.data));
    const dataObj = (ocrJson.data || ocrJson) as Record<string, unknown>;
    if (typeof dataObj.face_image === "string") extractedPortraitB64 = stripDataUri(dataObj.face_image);
    else if (typeof dataObj.portrait === "string") extractedPortraitB64 = stripDataUri(dataObj.portrait);
  } catch (e) {
    ocrJson = { error: e instanceof Error ? e.message : "OCR request failed" };
  }

  // 2. Face Liveness (POST /v2/api/liveness)
  let livenessJson: Record<string, unknown> = {};
  let livenessScore: number | undefined;
  try {
    const liveForm = new FormData();
    if (selfieB64) {
      liveForm.append("liveness_image", new Blob([Buffer.from(selfieB64, "base64")], { type: "image/jpeg" }), "selfie.jpg");
    } else if (input.selfiePhotoUrl) {
      liveForm.append("liveness_image", input.selfiePhotoUrl);
    }
    const liveRes = await fetch(`${cfg.apiBaseUrl}/v2/api/liveness`, { method: "POST", headers, body: liveForm });
    livenessJson = (await liveRes.json().catch(() => ({}))) as Record<string, unknown>;
    livenessScore = extractNumericScore(livenessJson, ["liveness_score", "score", "livenessScore", "probability"]);
  } catch (e) {
    livenessJson = { error: e instanceof Error ? e.message : "Liveness request failed" };
  }

  // 3. Face Match 1:1 (POST /v2/api/facematch)
  let fmJson: Record<string, unknown> = {};
  let faceMatchScore: number | undefined;
  try {
    const fmForm = new FormData();
    const idSourceB64 = extractedPortraitB64 || idB64;
    if (idSourceB64) {
      fmForm.append("input_image", new Blob([Buffer.from(idSourceB64, "base64")], { type: "image/jpeg" }), "id-face.jpg");
    }
    if (selfieB64) {
      fmForm.append("target_image", new Blob([Buffer.from(selfieB64, "base64")], { type: "image/jpeg" }), "selfie.jpg");
    }
    const fmRes = await fetch(`${cfg.apiBaseUrl}/v2/api/facematch`, { method: "POST", headers, body: fmForm });
    fmJson = (await fmRes.json().catch(() => ({}))) as Record<string, unknown>;
    faceMatchScore = extractNumericScore(fmJson, ["score", "match_score", "face_match_score", "similarity"]);
  } catch (e) {
    fmJson = { error: e instanceof Error ? e.message : "FaceMatch request failed" };
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
  if (cfg.autoApproveOnPass && facePassed && livenessPassed) {
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
  return { kyc, pipeline: buildKycPipelineStages({ ...rec, kyc }), ocrOk, faceMatchScore, livenessScore };
}

import { NextRequest, NextResponse } from "next/server";
import { partnerPortalIds } from "@/lib/partner-labels";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { bearerToken, sessionFromToken } from "@/lib/server/mobile-store";
import { findPortalUser, partnerOrigin } from "@/lib/server/partner-portals";
import type { PartnerPortalId } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_FILE = 8 * 1024 * 1024;

function portalFrom(value: string): PartnerPortalId | null {
  return partnerPortalIds.includes(value as PartnerPortalId) ? (value as PartnerPortalId) : null;
}

function cleanForm(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const clean: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-z0-9_]{1,40}$/i.test(key)) continue;
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") continue;
    clean[key] = String(raw).trim().slice(0, 2000);
  }
  return clean;
}

export async function GET(request: NextRequest) {
  const portal = portalFrom(request.nextUrl.searchParams.get("portal") || "");
  const seminarId = Number(request.nextUrl.searchParams.get("seminarId"));
  if (!portal || !Number.isInteger(seminarId) || seminarId < 1) {
    return NextResponse.json({ ok: false, error: "Choose a portal event." }, { status: 400 });
  }
  const phase = request.nextUrl.searchParams.get("phase") === "pre" ? "pre" : "main";
  const formPath = phase === "pre" && portal === "autism"
    ? `/api/preregistration-form-config?seminarId=${seminarId}`
    : `/api/registration-form-config?seminarId=${seminarId}`;
  try {
    const response = await fetch(`${partnerOrigin(portal)}${formPath}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; fields?: unknown } | null;
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: data?.error || "The registration form is not available." }, { status: response.status });
    }
    return NextResponse.json({ ok: true, portal, seminarId, form: data }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "The portal did not answer." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const cookieViewer = commerceViewer(request);
  const appSession = cookieViewer.email ? null : sessionFromToken(bearerToken(request.headers.get("authorization")));
  const viewer = appSession ? { ...cookieViewer, email: appSession.email.toLowerCase() } : cookieViewer;
  if (!viewer.email) return NextResponse.json({ ok: false, error: "Sign in to register." }, { status: 401 });
  const inbound = await request.formData().catch(() => null);
  if (!inbound) return NextResponse.json({ ok: false, error: "The registration could not be read." }, { status: 400 });
  const portal = portalFrom(String(inbound.get("portal") || ""));
  const seminarId = Number(inbound.get("seminarId"));
  if (!portal || !Number.isInteger(seminarId) || seminarId < 1) {
    return NextResponse.json({ ok: false, error: "Choose a portal event." }, { status: 400 });
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(inbound.get("formData") || "{}"));
  } catch {
    return NextResponse.json({ ok: false, error: "The form could not be read." }, { status: 400 });
  }
  const formData = cleanForm(parsed);
  if (!formData) return NextResponse.json({ ok: false, error: "The form could not be read." }, { status: 400 });
  const person = await findPortalUser(portal, viewer.email, viewer.phone);
  if (!person) {
    return NextResponse.json(
      { ok: false, error: "No account on that portal matches this sign-in. Use the email or phone from your portal registration." },
      { status: 404 }
    );
  }
  const phase = String(inbound.get("phase") || "main") === "pre" ? "pre" : "main";
  const outbound = new FormData();
  outbound.set("userId", String(person.id));
  outbound.set("seminarId", String(seminarId));
  outbound.set("formData", JSON.stringify(formData));
  const file = inbound.get("certificate");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE) return NextResponse.json({ ok: false, error: "The certificate must be 8 MB or smaller." }, { status: 400 });
    if (file.type && !FILE_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Upload the certificate as a PDF or a photo." }, { status: 400 });
    }
    outbound.set("certificate", file, file.name || "certificate");
  }
  try {
    const submitPath = phase === "pre" && portal === "autism" ? "/api/preregistrations/submit" : "/api/applications/submit";
    const response = await fetch(`${partnerOrigin(portal)}${submitPath}`, {
      method: "POST",
      body: outbound,
      signal: AbortSignal.timeout(20000),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; success?: boolean; message?: string; applicationNo?: string; application_no?: string } | null;
    if (!response.ok || data?.success === false) {
      return NextResponse.json({ ok: false, error: data?.error || "The portal did not accept this registration." }, { status: response.status || 502 });
    }
    return NextResponse.json({
      ok: true,
      message: data?.message || "Registered. The application is saved on the portal and listed in My Event Registrations.",
      applicationNo: data?.applicationNo || data?.application_no || "",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "The portal did not answer." }, { status: 502 });
  }
}

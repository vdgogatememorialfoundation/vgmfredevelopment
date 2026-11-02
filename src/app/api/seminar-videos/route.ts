import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { findSeminarViewer, seminarVideoDbConfigured, seminarVideoRequest } from "@/lib/server/seminar-videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function viewerName(request: NextRequest) {
  const raw = request.cookies.get("vgmf_session")?.value || request.cookies.get("vgmf_admin_session")?.value || "";
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    /* already decoded */
  }
  for (const value of candidates) {
    try {
      const parsed = JSON.parse(value) as { firstName?: string; lastName?: string; email?: string; phone?: string };
      if (!parsed?.email) continue;
      return {
        name: [parsed.firstName, parsed.lastName].filter(Boolean).join(" ").trim(),
        email: parsed.email,
        phone: parsed.phone || "",
      };
    } catch {
      /* next */
    }
  }
  return { name: "", email: "", phone: "" };
}

export async function GET(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.email) return NextResponse.json({ ok: false, code: "signin", error: "Sign in to watch seminar videos." }, { status: 401 });
  if (!seminarVideoDbConfigured()) {
    return NextResponse.json({ ok: false, error: "Seminar videos are not connected on this server yet." }, { status: 503 });
  }
  try {
    const person = await findSeminarViewer(viewer.email, viewer.phone);
    if (!person) {
      return NextResponse.json({
        ok: true,
        linked: false,
        error: "No seminar account matches this sign-in. Use the email or phone from your seminar registration.",
      });
    }
    const catalog = await seminarVideoRequest(`/api/doctor/videos?userId=${person.id}`);
    const payments = await seminarVideoRequest("/api/doctor/videos/payment-options");
    const profile = viewerName(request);
    return NextResponse.json(
      {
        ok: catalog.status < 400,
        linked: true,
        volunteer: person.volunteer,
        viewer: { name: profile.name, email: profile.email || person.email, phone: profile.phone || person.phone },
        catalog: catalog.data,
        paymentOptions: Array.isArray(payments.data) ? payments.data : [],
        error: catalog.status >= 400 && catalog.data && typeof catalog.data === "object" && "error" in catalog.data ? String((catalog.data as { error?: string }).error || "") : "",
      },
      { status: catalog.status >= 400 ? catalog.status : 200, headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message || "Seminar videos could not be loaded." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.email) return NextResponse.json({ ok: false, error: "Sign in to watch seminar videos." }, { status: 401 });
  if (!seminarVideoDbConfigured()) {
    return NextResponse.json({ ok: false, error: "Seminar videos are not connected on this server yet." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action || "");
  try {
    const person = await findSeminarViewer(viewer.email, viewer.phone);
    if (!person) return NextResponse.json({ ok: false, error: "No seminar account matches this sign-in." }, { status: 404 });
    const userId = person.id;
    if (action === "session") {
      const videoId = Number(body?.videoId);
      const result = await seminarVideoRequest(`/api/doctor/videos/${videoId}/session`, {
        method: "POST",
        body: { userId, deviceId: String(body?.deviceId || "") },
      });
      const data = result.data && typeof result.data === "object" ? (result.data as { playlistUrl?: string }) : null;
      if (data?.playlistUrl?.startsWith("/video-stream/")) {
        data.playlistUrl = data.playlistUrl.replace("/video-stream/", "/api/seminar-videos/stream/");
      }
      return NextResponse.json(data ?? { error: "Playback did not start." }, { status: result.status });
    }
    if (action === "progress") {
      const videoId = Number(body?.videoId);
      const result = await seminarVideoRequest(`/api/doctor/videos/${videoId}/progress`, {
        method: "POST",
        body: { userId, token: String(body?.token || ""), positionSec: body?.positionSec },
      });
      return NextResponse.json(result.data, { status: result.status });
    }
    if (action === "end") {
      const videoId = Number(body?.videoId);
      const result = await seminarVideoRequest(`/api/doctor/videos/${videoId}/session/end`, {
        method: "POST",
        body: { token: String(body?.token || "") },
      });
      return NextResponse.json(result.data, { status: result.status });
    }
    if (action === "purchase") {
      const result = await seminarVideoRequest("/api/doctor/videos/purchase", {
        method: "POST",
        body: {
          userId,
          videoId: body?.videoId ?? null,
          year: body?.year ?? null,
          mid: String(body?.mid || "razorpay"),
        },
      });
      return NextResponse.json(result.data, { status: result.status });
    }
    if (action === "verify") {
      const purchaseId = Number(body?.purchaseId);
      const result = await seminarVideoRequest(`/api/doctor/videos/purchase/${purchaseId}/verify`, {
        method: "POST",
        body: {
          userId,
          razorpay_order_id: body?.razorpay_order_id,
          razorpay_payment_id: body?.razorpay_payment_id,
          razorpay_signature: body?.razorpay_signature,
        },
      });
      return NextResponse.json(result.data, { status: result.status });
    }
    if (action === "status") {
      const purchaseId = Number(body?.purchaseId);
      const result = await seminarVideoRequest(`/api/doctor/videos/purchase/${purchaseId}/status?userId=${userId}`);
      return NextResponse.json(result.data, { status: result.status });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message || "The seminar video service did not answer." }, { status: 502 });
  }
}

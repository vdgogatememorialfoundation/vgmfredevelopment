import { NextRequest, NextResponse } from "next/server";
import { findSeminarViewer, seminarClientHeaders, seminarDashboardViewer, seminarVideoDbConfigured, seminarVideoRequest } from "@/lib/server/seminar-videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = seminarDashboardViewer(request.cookies);
  if (!viewer.email) return NextResponse.json({ ok: false, code: "signin", error: "Sign in to watch seminar videos." }, { status: 401 });
  if (!seminarVideoDbConfigured()) {
    return NextResponse.json({ ok: false, error: "Seminar videos are not connected on this server yet." }, { status: 503 });
  }
  try {
    const person = await findSeminarViewer(viewer.email, viewer.phone, viewer.accountId);
    if (!person) {
      return NextResponse.json({
        ok: true,
        linked: false,
        error: "No seminar account matches this sign-in. Use the email or phone from your seminar registration.",
      });
    }
    const headers = seminarClientHeaders(request);
    const deviceId = (request.headers.get("x-vgmf-device") || "").toLowerCase();
    const catalog = await seminarVideoRequest(`/api/doctor/videos?userId=${person.id}`, { headers });
    const payments = await seminarVideoRequest("/api/doctor/videos/payment-options", { headers });
    const devices = /^[a-f0-9]{32}$/.test(deviceId)
      ? await seminarVideoRequest(`/api/doctor/videos/devices?userId=${person.id}&deviceId=${deviceId}`, { headers })
      : null;
    return NextResponse.json(
      {
        ok: catalog.status < 400,
        linked: true,
        volunteer: person.volunteer,
        viewer: { name: viewer.name, email: viewer.email || person.email, phone: viewer.phone || person.phone },
        catalog: catalog.data,
        devices: devices && devices.status < 400 ? devices.data : null,
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
  const viewer = seminarDashboardViewer(request.cookies);
  if (!viewer.email) return NextResponse.json({ ok: false, error: "Sign in to watch seminar videos." }, { status: 401 });
  if (!seminarVideoDbConfigured()) {
    return NextResponse.json({ ok: false, error: "Seminar videos are not connected on this server yet." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action || "");
  try {
    const person = await findSeminarViewer(viewer.email, viewer.phone, viewer.accountId);
    if (!person) return NextResponse.json({ ok: false, error: "No seminar account matches this sign-in." }, { status: 404 });
    const userId = person.id;
    const headers = seminarClientHeaders(request);
    if (action === "session") {
      const videoId = Number(body?.videoId);
      const result = await seminarVideoRequest(`/api/doctor/videos/${videoId}/session`, {
        method: "POST",
        headers,
        body: { userId, deviceId: String(body?.deviceId || "").toLowerCase() },
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
        headers,
        body: { userId, token: String(body?.token || ""), positionSec: body?.positionSec },
      });
      return NextResponse.json(result.data, { status: result.status });
    }
    if (action === "end") {
      const videoId = Number(body?.videoId);
      const result = await seminarVideoRequest(`/api/doctor/videos/${videoId}/session/end`, {
        method: "POST",
        headers,
        body: { token: String(body?.token || "") },
      });
      return NextResponse.json(result.data, { status: result.status });
    }
    if (action === "purchase") {
      const result = await seminarVideoRequest("/api/doctor/videos/purchase", {
        method: "POST",
        headers,
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
        headers,
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
      const result = await seminarVideoRequest(`/api/doctor/videos/purchase/${purchaseId}/status?userId=${userId}`, { headers });
      return NextResponse.json(result.data, { status: result.status });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message || "The seminar video service did not answer." }, { status: 502 });
  }
}

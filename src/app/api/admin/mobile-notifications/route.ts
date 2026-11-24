import { NextRequest, NextResponse } from "next/server";
import { portalSessionFrom } from "@/lib/server/portal-auth";
import {
  deleteMobileNotification,
  getOrderStageNotifications,
  listMobileNotifications,
  saveMobileNotification,
  saveOrderStageNotifications,
  type MobileNotification,
  type OrderStageTemplate,
} from "@/lib/server/mobile-notifications";
import { fcmReady, pushToAllDevices, pushToCustomer } from "@/lib/server/fcm";
import { listPushDevices } from "@/lib/server/push-devices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = portalSessionFrom(request);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  return NextResponse.json(
    {
      ok: true,
      notifications: listMobileNotifications(),
      orderStages: getOrderStageNotifications(),
      fcmConfigured: fcmReady(),
      deviceCount: listPushDevices().length,
    },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const session = portalSessionFrom(request);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action || "save");

  if (action === "save-stages") {
    const incoming = Array.isArray(body?.orderStages) ? (body.orderStages as Partial<OrderStageTemplate>[]) : [];
    const saved = saveOrderStageNotifications(incoming);
    return NextResponse.json({ ok: true, orderStages: saved });
  }

  if (action === "delete") {
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Send notification id." }, { status: 400 });
    return NextResponse.json({ ok: true, notifications: deleteMobileNotification(id) });
  }

  if (action === "push") {
    const id = String(body?.id || "").trim();
    const item = listMobileNotifications().find((n) => n.id === id);
    if (!item) return NextResponse.json({ ok: false, error: "Notification not found." }, { status: 404 });
    const count =
      item.target === "all"
        ? await pushToAllDevices({ title: item.title, body: item.body, url: item.href }).catch(() => 0)
        : await pushToCustomer({ email: item.target }, { title: item.title, body: item.body, url: item.href }).catch(() => 0);
    const updated = saveMobileNotification({
      ...item,
      sentAt: new Date().toISOString(),
      pushSentCount: (item.pushSentCount ?? 0) + count,
    });
    return NextResponse.json({ ok: true, notification: updated, pushed: count, notifications: listMobileNotifications() });
  }

  const title = String(body?.title || "").trim();
  const msg = String(body?.body || "").trim();
  if (!title || !msg) return NextResponse.json({ ok: false, error: "Enter both title and message." }, { status: 400 });

  const sendPush = body?.sendPush === true;
  let pushed = 0;
  const target = String(body?.target || "all").trim().toLowerCase() || "all";
  const href = String(body?.href || "/").trim() || "/";
  if (sendPush && body?.active !== false) {
    pushed =
      target === "all"
        ? await pushToAllDevices({ title, body: msg, url: href }).catch(() => 0)
        : await pushToCustomer({ email: target }, { title, body: msg, url: href }).catch(() => 0);
  }

  const saved = saveMobileNotification({
    id: body?.id ? String(body.id) : undefined,
    title,
    body: msg,
    category: (body?.category as MobileNotification["category"]) || "announcement",
    href,
    target,
    active: body?.active !== false,
    pinned: body?.pinned === true,
    createdBy: session.name || session.email,
    ...(sendPush ? { sentAt: new Date().toISOString(), pushSentCount: pushed } : {}),
  });

  return NextResponse.json({
    ok: true,
    notification: saved,
    pushed,
    notifications: listMobileNotifications(),
  });
}

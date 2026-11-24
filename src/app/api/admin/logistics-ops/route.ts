import { NextRequest, NextResponse } from "next/server";
import {
  authorizeOpenBoxSession,
  autoAllocatePickupManifest,
  completeOpenBoxSession,
  readAdvancedStore,
  reconcilePickupManifest,
  scanIntoPickupManifest,
  setExecutiveServiceMode,
  startOpenBoxSession,
  updateExecutiveShiftStatus,
  writeAdvancedStore,
  type ServiceModeChoice, assignPickups, pendingPickupShipments, pickupRiders } from "@/lib/server/vgmf-advanced-logistics";
import { readLogisticsStore } from "@/lib/server/vgmf-logistics";

export async function GET() {
  const adv = readAdvancedStore();
  const base = readLogisticsStore();
  return NextResponse.json({
    ok: true,
    ...adv,
    hubs: base.hubs,
    agentEnrollments: base.agentEnrollments,
    pendingPickups: pendingPickupShipments(),
    pickupRiders: pickupRiders(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body?.action || "").trim();
    const by = String(body?.by || "Logistics Admin");

    if (action === "save-shift-templates") {
      const store = readAdvancedStore();
      if (Array.isArray(body.shiftTemplates)) store.shiftTemplates = body.shiftTemplates;
      writeAdvancedStore(store);
      return NextResponse.json({ ok: true, shiftTemplates: store.shiftTemplates, message: "Shift templates saved." });
    }

    if (action === "save-delivery-slots") {
      const store = readAdvancedStore();
      if (Array.isArray(body.deliverySlots)) store.deliverySlots = body.deliverySlots;
      writeAdvancedStore(store);
      return NextResponse.json({ ok: true, deliverySlots: store.deliverySlots, message: "Customer delivery slots saved." });
    }

    if (action === "save-open-box-settings") {
      const store = readAdvancedStore();
      store.openBoxSettings = { ...store.openBoxSettings, ...(body.openBoxSettings || {}) };
      writeAdvancedStore(store);
      return NextResponse.json({ ok: true, openBoxSettings: store.openBoxSettings, message: "Open-Box & Hyperlocal settings saved." });
    }

    if (action === "set-service-mode") {
      const res = setExecutiveServiceMode(String(body.email || ""), (body.serviceMode || "both") as ServiceModeChoice, by);
      return NextResponse.json({ ok: true, ...res, message: `Updated ${res.email} to ${res.serviceMode}.` });
    }

    if (action === "shift-checkin") {
      const rec = updateExecutiveShiftStatus({
        email: String(body.email || ""),
        name: String(body.name || body.email || ""),
        hubCode: String(body.hubCode || ""),
        serviceMode: body.serviceMode as ServiceModeChoice | undefined,
        shiftId: body.shiftId ? String(body.shiftId) : undefined,
        status: body.status || "checked_in",
      });
      return NextResponse.json({ ok: true, attendance: rec, message: `Shift status: ${rec.status.replace(/_/g, " ")}.` });
    }

    if (action === "assign-pickups") {
      const pm = assignPickups({
        awbs: Array.isArray(body.awbs) ? body.awbs.map(String) : [],
        executiveEmail: String(body.executiveEmail || ""),
        hubCode: body.hubCode ? String(body.hubCode) : undefined,
        by,
      });
      return NextResponse.json({ ok: true, pickupManifest: pm, message: `${pm.expectedAwbs.length} pickup(s) assigned to ${pm.executiveName} on pickup runsheet ${pm.id}. They now show in the rider's Delivery app.` });
    }

    if (action === "auto-allocate-pickup") {
      const pm = autoAllocatePickupManifest({
        hubCode: String(body.hubCode || ""),
        shiftWindow: body.shiftWindow ? String(body.shiftWindow) : undefined,
        executiveEmail: body.executiveEmail ? String(body.executiveEmail) : undefined,
        by,
      });
      return NextResponse.json({ ok: true, pickupManifest: pm, message: `${pm.expectedAwbs.length} pickup(s) assigned to ${pm.executiveName} on pickup runsheet ${pm.id}. They now show in the rider's Delivery app.` });
    }

    if (action === "pickup-manifest-scan") {
      const pm = scanIntoPickupManifest(String(body.manifestId || ""), String(body.awb || ""));
      return NextResponse.json({ ok: true, pickupManifest: pm, message: `Scanned ${body.awb} (${pm.scannedAwbs.length}/${pm.expectedAwbs.length}).` });
    }

    if (action === "pickup-manifest-reconcile") {
      const pm = reconcilePickupManifest(String(body.manifestId || ""), body.missingReasons || {});
      return NextResponse.json({ ok: true, pickupManifest: pm, message: `Manifest ${pm.id} → ${pm.status}.` });
    }

    if (action === "openbox-start") {
      const res = startOpenBoxSession({
        awb: String(body.awb || ""),
        executiveEmail: String(body.executiveEmail || by),
        executiveName: String(body.executiveName || by),
      });
      return NextResponse.json({ ok: true, ...res });
    }

    if (action === "openbox-authorize") {
      const res = authorizeOpenBoxSession({
        sessionId: String(body.sessionId || ""),
        last4Digits: String(body.last4Digits || ""),
        openBoxOtp: String(body.openBoxOtp || ""),
      });
      return NextResponse.json({ ok: true, ...res });
    }

    if (action === "openbox-complete") {
      const res = completeOpenBoxSession({
        sessionId: String(body.sessionId || ""),
        answers: body.answers || {},
        remarks: body.remarks ? String(body.remarks) : "",
        photos: Array.isArray(body.photos) ? body.photos : [],
        decision: body.decision || "accepted",
        finalDeliveryOtp: body.finalDeliveryOtp ? String(body.finalDeliveryOtp) : undefined,
        recipientName: body.recipientName ? String(body.recipientName) : undefined,
        codCollected: Boolean(body.codCollected),
        hubCode: body.hubCode ? String(body.hubCode) : undefined,
      });
      return NextResponse.json({ ok: true, ...res });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Operation failed." }, { status: 400 });
  }
}

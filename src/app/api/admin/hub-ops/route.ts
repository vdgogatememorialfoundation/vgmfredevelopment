import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { deleteDeliveryPartnerAccount } from "@/lib/server/portal-accounts";
import { readLogisticsSettings } from "@/lib/server/vgmf-logistics-settings";
import { buildKycPipelineStages, reviewManualKyc, reinitiateAgentKyc, type AgentKycData } from "@/lib/server/agent-kyc";
import {
  addAwbToBag,
  addCustomHub,
  allotAgentToHub,
  deleteAgentEnrollment,
  addHubExecutive,
  applyDeliveryScanEvent,
  applyReturnEvent,
  assignParcelToAgent,
  buildDeliveryDashboard,
  createBag,
  createHubException,
  createHubTransfer,
  createReturnShipmentRecord,
  createVgmfManifest,
  dispatchBagTransfer,
  generateVgmfAwb,
  getFullHubOperationsData,
  logGateEntry,
  logGateExit,
  lookupInternalTracking,
  receiveBagTransfer,
  receiveHubTransfer,
  removeHubExecutive,
  reviewAgentHubEnrollment,
  reopenBagWithAudit,
  resendDeliveryOrPickupOtp,
  resolveHubException,
  sealBag,
  setParcelRackBin,
  type HubType,
} from "@/lib/server/vgmf-logistics";

export async function GET(req: NextRequest) {
  const hubCode = req.nextUrl.searchParams.get("hubCode") || "";
  const agentEmail = req.nextUrl.searchParams.get("agentEmail") || "";
  const full = getFullHubOperationsData(hubCode, agentEmail);
  const enrichedEnrollments = (full.agentEnrollments || []).map((a) => ({
    ...a,
    kycPipeline: buildKycPipelineStages(a as unknown as { status: "unassigned" | "pending" | "approved" | "rejected"; hubCode?: string; requestedAt?: string; reviewedAt?: string; reviewedBy?: string; kyc?: AgentKycData }),
  }));
  return NextResponse.json({ ok: true, ...full, agentEnrollments: enrichedEnrollments });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body?.action || "").trim();
    const by = String(body?.by || "Hub Manager");
    const hubCode = String(body?.hubCode || "VGMF-PNQ");

    if (action === "geocode-hub") {
      const query = String(body.query || "").trim();
      if (!query) return NextResponse.json({ ok: false, error: "Enter address, city, or pincode to look up." }, { status: 400 });
      const gKey = (readLogisticsSettings().current.hubRules?.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY || "").trim();
      if (gKey) {
        const gRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(gKey)}`);
        const gData = await gRes.json();
        const first = gData?.results?.[0];
        if (!first) return NextResponse.json({ ok: false, error: gData?.error_message || "Location not found on Google Maps." }, { status: 404 });
        const comps = first.address_components || [];
        const pickComp = (t: string) => (comps.find((c: { types?: string[]; long_name?: string }) => (c.types || []).includes(t))?.long_name || "");
        const lat = Number(first.geometry?.location?.lat);
        const lng = Number(first.geometry?.location?.lng);
        const city = pickComp("locality") || pickComp("administrative_area_level_2") || query;
        const state = pickComp("administrative_area_level_1") || "India";
        const pincode = pickComp("postal_code") || "";
        return NextResponse.json({
          ok: true,
          provider: "google_maps",
          formattedAddress: first.formatted_address,
          city: `${city}, ${state}`,
          state,
          pincode,
          lat,
          lng,
          mapsUrl: `https://maps.google.com/?q=${lat},${lng}`,
          message: "Location fetched via Google Maps API.",
        });
      }
      // Fallback to OpenStreetMap Nominatim when Google Maps API key is not set yet
      const nRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`, {
        headers: { "user-agent": "VGMF-Logistics/1.0" },
      });
      const nArr = await nRes.json();
      const first = Array.isArray(nArr) ? nArr[0] : null;
      if (!first) return NextResponse.json({ ok: false, error: "Location not found. Add Google Maps API key in Logistics Settings for full precision." }, { status: 404 });
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      const addr = first.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || query;
      const state = addr.state || "India";
      const pincode = addr.postcode || "";
      return NextResponse.json({
        ok: true,
        provider: "osm_fallback",
        formattedAddress: first.display_name,
        city: `${city}, ${state}`,
        state,
        pincode,
        lat,
        lng,
        mapsUrl: `https://maps.google.com/?q=${lat},${lng}`,
        message: "Location fetched (add Google Maps API key in Logistics Settings → Hub Network Rules for Google Maps Geocoding).",
      });
    }

    if (action === "add-hub") {
      const hub = addCustomHub({
        code: String(body.code || ""),
        name: String(body.name || ""),
        type: (String(body.type || "combined") as HubType),
        city: String(body.city || ""),
        state: String(body.state || "Maharashtra"),
        pincode: String(body.pincode || ""),
        address: String(body.address || ""),
        lat: body.lat !== undefined ? Number(body.lat) : undefined,
        lng: body.lng !== undefined ? Number(body.lng) : undefined,
        mapsUrl: String(body.mapsUrl || ""),
      });
      return NextResponse.json({ ok: true, hub, message: `Hub ${hub.code} saved.` });
    }

    if (action === "add-executive") {
      const hub = addHubExecutive(hubCode, {
        name: String(body.name || ""),
        email: String(body.email || ""),
        phone: String(body.phone || ""),
        role: body.role || "delivery_executive",
        shift: String(body.shift || "Morning (08:00–16:00)"),
        station: String(body.station || "General"),
        passwordHash: body.password ? createHash("sha256").update(`vgmf-hub:${String(body.password).trim()}`).digest("hex") : undefined,
      });
      return NextResponse.json({ ok: true, hub, message: `Executive added to ${hub.code}.` });
    }

    if (action === "allot-agent-hub") {
      const res = allotAgentToHub({
        email: String(body.email || ""),
        hubCode: String(body.targetHubCode || body.hubCode || ""),
        role: body.role || undefined,
        by,
      });
      return NextResponse.json({ ok: true, ...res, message: `Allotted ${res.agent.name} to Hub ${res.hub.code}.` });
    }
    if (action === "kyc-reinitiate") {
      const res = reinitiateAgentKyc({
        email: String(body.email || ""),
        reason: String(body.reason || ""),
        by,
      });
      return NextResponse.json({ ok: true, ...res, message: "KYC reset & re-initiated. Agent can now submit fresh KYC." });
    }
    if (action === "delete-agent-account") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
      deleteAgentEnrollment(email, by);
      const acct = deleteDeliveryPartnerAccount(email);
      return NextResponse.json({
        ok: true,
        deletedPortalAccount: acct.deleted,
        message: `Deleted delivery agent account (${email}).`,
      });
    }
    if (action === "kyc-manual-review") {
      const res = reviewManualKyc({
        email: String(body.email || ""),
        approve: Boolean(body.approve),
        reason: body.reason ? String(body.reason) : undefined,
        by,
      });
      return NextResponse.json({ ok: true, ...res, message: body.approve ? "Manual KYC verified ✓" : "Manual KYC declined." });
    }

    if (action === "approve-agent" || action === "reject-agent") {
      const rec = reviewAgentHubEnrollment({
        email: String(body.email || ""),
        approve: action === "approve-agent",
        role: body.role || "delivery_executive",
        reason: String(body.reason || ""),
        by,
      });
      return NextResponse.json({ ok: true, agent: rec, message: action === "approve-agent" ? `Agent ${rec.name} activated for ${rec.hubCode}!` : `Agent ${rec.name} rejected.` });
    }

    if (action === "remove-executive") {
      const hub = removeHubExecutive(hubCode, String(body.execId || ""));
      return NextResponse.json({ ok: true, hub, message: "Executive removed." });
    }

    if (action === "generate-awb") {
      const res = generateVgmfAwb(String(body.orderId || ""), hubCode, by);
      return NextResponse.json({
        ok: true,
        ...res,
        labelUrl: `/api/admin/vgmf-label?awb=${encodeURIComponent(String(res.shipment.awb || ""))}`,
        message: `12-digit VGMF AWB ${res.shipment.awb} ready.`,
      });
    }

    if (action === "scan-event") {
      const res = applyDeliveryScanEvent({
        code: String(body.code || ""),
        scannedCode: String(body.scannedCode || body.code || ""),
        event: body.event,
        hubCode,
        by,
        agentEmail: body.agentEmail ? String(body.agentEmail) : undefined,
        riderName: body.riderName ? String(body.riderName) : by,
        recipientName: body.recipientName ? String(body.recipientName) : undefined,
        otp: body.otp ? String(body.otp) : undefined,
        codCollected: Boolean(body.codCollected),
        reason: body.reason ? String(body.reason) : undefined,
      });
      return NextResponse.json({ ok: true, ...res, message: res.sellerUpdate?.message || "Scan recorded." });
    }

    if (action === "set-rack-bin") {
      const res = setParcelRackBin(String(body.code || ""), String(body.rackBin || ""), hubCode, by);
      return NextResponse.json({ ok: true, ...res, message: `Assigned ${res.awb} to ${res.rackBin}.` });
    }

    if (action === "assign-runsheet") {
      const res = assignParcelToAgent({
        code: String(body.code || ""),
        agentEmail: String(body.agentEmail || ""),
        agentName: String(body.agentName || by),
        hubCode,
      });
      return NextResponse.json({ ok: true, ...res, message: `Assigned ${res.shipment.awb} to ${body.agentName || body.agentEmail} (${res.runsheetId}).` });
    }

    if (action === "resend-otp") {
      const res = resendDeliveryOrPickupOtp(String(body.code || ""), body.target || "customer_delivery", by);
      return NextResponse.json({ ok: true, ...res });
    }

    if (action === "bag-create") {
      const bag = createBag(hubCode, String(body.destHub || "VGMF-THN"), by, String(body.sealNo || ""));
      return NextResponse.json({ ok: true, bag, message: `Bag ${bag.id} created.` });
    }
    if (action === "bag-add-awb") {
      const res = addAwbToBag(String(body.bagId || ""), String(body.code || ""), by);
      return NextResponse.json({ ok: true, ...res, message: `Added ${res.awb} to ${res.bag.id}.` });
    }
    if (action === "bag-seal") {
      const bag = sealBag(String(body.bagId || ""), String(body.sealNo || ""), by);
      return NextResponse.json({ ok: true, bag, message: `Bag ${bag.id} sealed (${bag.sealNo}).` });
    }
    if (action === "bag-reopen") {
      const bag = reopenBagWithAudit(String(body.bagId || ""), String(body.reason || ""), by);
      return NextResponse.json({ ok: true, bag, message: `Bag ${bag.id} reopened (supervisor audit logged).` });
    }
    if (action === "bag-dispatch") {
      const bag = dispatchBagTransfer(String(body.bagId || ""), String(body.destHub || ""), by, String(body.vehicleNo || ""), String(body.driverName || by));
      return NextResponse.json({ ok: true, bag, message: `Bag ${bag.id} dispatched to ${bag.destHub}.` });
    }
    if (action === "bag-receive") {
      const bag = receiveBagTransfer(String(body.bagId || ""), hubCode, by);
      return NextResponse.json({ ok: true, bag, message: `Bag ${bag.id} received & debagged at ${hubCode}.` });
    }

    if (action === "transfer-create") {
      const trf = createHubTransfer({
        originHub: hubCode,
        destHub: String(body.destHub || ""),
        bagIds: Array.isArray(body.bagIds) ? body.bagIds.map(String) : [],
        vehicleNo: String(body.vehicleNo || ""),
        driverName: String(body.driverName || ""),
        driverPhone: String(body.driverPhone || ""),
        by,
      });
      return NextResponse.json({ ok: true, transfer: trf, message: `Transfer ${trf.id} dispatched (${trf.bagIds.length} bags, ${trf.parcelCount} parcels).` });
    }
    if (action === "transfer-receive") {
      const trf = receiveHubTransfer(String(body.transferId || ""), hubCode, by);
      return NextResponse.json({ ok: true, transfer: trf, message: `Transfer ${trf.id} received & reconciled at ${hubCode}.` });
    }

    if (action === "manifest-create") {
      const manifest = createVgmfManifest({
        type: body.type || "dispatch_manifest",
        hubCode,
        destHubCode: body.destHubCode ? String(body.destHubCode) : undefined,
        riderName: String(body.riderName || by),
        vehicleNo: String(body.vehicleNo || ""),
        awbs: Array.isArray(body.awbs) ? body.awbs.map(String) : [],
        bagIds: Array.isArray(body.bagIds) ? body.bagIds.map(String) : [],
        notes: String(body.notes || ""),
        by,
      });
      return NextResponse.json({
        ok: true,
        manifest,
        manifestUrl: `/api/admin/vgmf-manifest?id=${encodeURIComponent(manifest.id)}`,
        message: `Manifest ${manifest.id} created.`,
      });
    }

    if (action === "gate-entry") {
      const entry = logGateEntry({
        hubCode,
        vehicleNo: String(body.vehicleNo || ""),
        driverName: String(body.driverName || ""),
        driverPhone: String(body.driverPhone || ""),
        purpose: String(body.purpose || "Hub Transfer"),
        transferId: String(body.transferId || ""),
        bagCount: Number(body.bagCount || 0),
        securityBy: by,
      });
      return NextResponse.json({ ok: true, entry, message: `Gate entry logged for ${entry.vehicleNo}.` });
    }
    if (action === "gate-exit") {
      const entry = logGateExit(String(body.entryId || ""), by);
      return NextResponse.json({ ok: true, entry, message: `Gate exit logged for ${entry.vehicleNo}.` });
    }

    if (action === "exception-create") {
      const exc = createHubException({
        hubCode,
        code: String(body.code || ""),
        category: body.category || "missing_shipment",
        notes: String(body.notes || ""),
        cctvRef: String(body.cctvRef || ""),
        by,
      });
      return NextResponse.json({ ok: true, exception: exc, message: `Exception case ${exc.id} opened.` });
    }
    if (action === "exception-resolve") {
      const exc = resolveHubException(String(body.caseId || ""), String(body.resolution || ""), by);
      return NextResponse.json({ ok: true, exception: exc, message: `Exception case ${exc.id} closed.` });
    }

    if (action === "return-create" || action === "create-return") {
      const ret = createReturnShipmentRecord({
        code: String(body.code || ""),
        kind: body.kind || "customer_return",
        reason: String(body.reason || ""),
        hubCode,
        by,
      });
      return NextResponse.json({ ok: true, returnRecord: ret, message: `12-digit Return AWB ${ret.returnAwb} created.` });
    }
    if (action === "return-event") {
      const ret = applyReturnEvent({
        returnAwb: String(body.returnAwb || ""),
        scannedCode: String(body.scannedCode || body.returnAwb || ""),
        event: body.event,
        hubCode,
        otp: body.otp ? String(body.otp) : undefined,
        by,
      });
      return NextResponse.json({ ok: true, returnRecord: ret, message: `Return ${ret.returnAwb} → ${ret.status}.` });
    }

    if (action === "track") {
      const result = lookupInternalTracking(String(body.code || ""));
      if (!result) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}`, snapshot: buildDeliveryDashboard("", hubCode) }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Hub operation failed." }, { status: 400 });
  }
}

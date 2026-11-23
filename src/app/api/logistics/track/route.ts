import { NextRequest, NextResponse } from "next/server";
import { findShopOrder } from "@/lib/server/shop-orders";
import { findShipmentByCode, isVgmfOwnShipment, readLogisticsStore } from "@/lib/server/vgmf-logistics";
import { courierEventTitle, isDeskScan, normalizeDispatchedScanLocations } from "@/lib/order-pipeline";

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("awb") || req.nextUrl.searchParams.get("order") || req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) {
    return NextResponse.json({ ok: false, error: "Enter a 12-digit VGMF AWB or Order ID." }, { status: 400 });
  }

  const store = readLogisticsStore();
  // 1. Check 12-digit Return AWB (89...)
  const ret = store.returns.find(
    (r) => r.returnAwb.toUpperCase() === raw.toUpperCase() || r.id.toUpperCase() === raw.toUpperCase()
  );
  if (ret) {
    const orderRank: Record<string, number> = {
      "Initiated": 0,
      "Out for Return Pickup": 1,
      "Return Picked Up": 2,
      "At Return Hub": 3,
      "In Transit": 3,
      "At Destination Hub": 3,
      "Out for Seller Delivery": 4,
      "Returned to Seller": 5,
    };
    const rank = orderRank[ret.status] ?? 0;
    const stages = [
      { id: "ordered", title: ret.kind === "rto" ? "RTO Shipment Booked" : "Return Shipment Booked", reached: rank >= 0, current: rank === 0, at: ret.createdAt, detail: `Return AWB ${ret.returnAwb} · ${ret.reason}` },
      { id: "out_pickup", title: "Out for Pickup from Customer", reached: rank >= 1, current: rank === 1, at: ret.tracking.find((t) => /out for return/i.test(t.status))?.at || (rank >= 1 ? ret.createdAt : undefined), detail: "Pickup executive assigned" },
      { id: "picked", title: "Picked Up from Customer", reached: rank >= 2, current: rank === 2, at: ret.tracking.find((t) => /picked up/i.test(t.status))?.at, detail: "Shipped via VGMF Express" },
      { id: "shipped", title: "In Transit via VGMF Hubs", reached: rank >= 3, current: rank === 3, at: ret.tracking.find((t) => /facility|inward|transit|hub/i.test(t.status))?.at, detail: ret.hubCode ? `Processed at Hub ${ret.hubCode}` : "Moving through VGMF Hub network" },
      { id: "out", title: "Out for Delivery to Seller", reached: rank >= 4, current: rank === 4, at: ret.tracking.find((t) => /out for delivery to seller|returned to seller|delivered to seller/i.test(t.status))?.at, detail: "Executive en route to Seller / Foundation warehouse" },
      { id: "delivered", title: "Delivered to Seller", reached: rank >= 5, current: rank === 5, at: ret.tracking.find((t) => /returned to seller|delivered to seller/i.test(t.status))?.at, detail: rank >= 5 ? "Received & verified by Seller" : "Awaiting seller delivery" },
    ];
    return NextResponse.json({
      ok: true,
      kind: "return",
      awb: ret.returnAwb,
      orderId: ret.originalOrderId,
      courier: "VGMF Express (Return)",
      status: ret.status,
      destination: [ret.city, ret.pincode].filter(Boolean).join(" "),
      stages,
      scans: [...ret.tracking].reverse().map((t) => ({ at: t.at, title: t.status, location: t.location || "" })),
    });
  }

  // 2. Check forward VGMF Logistics shipment ONLY (reject external couriers & unbooked orders)
  const shipment = findShipmentByCode(raw);
  if (!shipment || !isVgmfOwnShipment(shipment)) {
    return NextResponse.json(
      {
        ok: false,
        error: `"${raw}" is not a VGMF Logistics shipment. Only shipments booked with VGMF Express (12-digit AWB) are tracked here — track external courier orders at /track.`,
      },
      { status: 404 }
    );
  }

  const order = findShopOrder(shipment.orderId);
  const rawScans = normalizeDispatchedScanLocations((shipment.tracking || []).filter((e) => !isDeskScan(e)));
  const cleanScans = rawScans.map((e) => ({
    at: e.at,
    title: courierEventTitle(e.status, e.location, shipment.courier || "VGMF Express"),
    location: e.location || "",
  }));

  const addr = order?.deliveryAddress || shipment.toAddress;
  const publicOrder = {
    id: order?.id || shipment.orderId,
    date: order?.date || shipment.generatedAt,
    status: order?.status || shipment.status || "Shipped",
    paymentStatus: order?.paymentStatus || "Paid",
    total: order?.total || 0,
    items: (order?.items || []).map((it) => ({ ...it, price: 0 })),
    courierName: shipment.courier || "VGMF Express",
    trackingId: shipment.awb,
    eta: shipment.expectedBy || order?.eta || "",
    deliveryAddress: addr ? { city: addr.city || "", state: addr.state || "", pincode: addr.pincode || "" } : undefined,
    pick: order?.pick ? { packedAt: order.pick.packedAt } : undefined,
    courierChoice: { provider: shipment.provider || "vgmf-express", courierName: shipment.courier || "VGMF Express" },
  };
  const isOutForDelivery = shipment.status === "Out for Delivery" || order?.status === "Out for Delivery";
  const publicShipment = {
    ...shipment,
    deliveryOtp: isOutForDelivery ? shipment.deliveryOtp : undefined,
    pickupOtp: undefined,
    tracking: rawScans,
    toAddress: addr ? { name: "", phone: "", line1: "", city: addr.city || "", state: addr.state || "", pincode: addr.pincode || "" } : undefined,
  };

  return NextResponse.json({
    ok: true,
    kind: "forward",
    awb: shipment.awb || "",
    orderId: publicOrder.id,
    courier: shipment.courier || "VGMF Express",
    status: shipment.status || publicOrder.status,
    expectedBy: shipment.expectedBy || order?.eta || "",
    destination: [addr?.city, addr?.state, addr?.pincode].filter(Boolean).join(", "),
    order: publicOrder,
    shipment: publicShipment,
    scans: [...cleanScans].reverse(),
  });
}

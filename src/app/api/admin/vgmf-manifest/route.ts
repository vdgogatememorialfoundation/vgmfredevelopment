import { NextRequest, NextResponse } from "next/server";
import { findShopOrder } from "@/lib/server/shop-orders";
import { code128Svg, findHub, findShipmentByCode, readLogisticsStore } from "@/lib/server/vgmf-logistics";

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TYPE_LABELS: Record<string, string> = {
  first_mile_pickup: "First-Mile Seller Pickup Manifest",
  hub_transfer: "Internal Hub-to-Hub Transfer Manifest",
  last_mile_ofd: "Last-Mile Out-for-Delivery Run Sheet",
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const store = readLogisticsStore();
  const manifest = id
    ? store.manifests.find((m) => m.id.toUpperCase() === id.trim().toUpperCase())
    : store.manifests[0];
  if (!manifest) {
    return NextResponse.json({ ok: false, error: "Manifest not found." }, { status: 404 });
  }
  const originHub = findHub(store, manifest.hubCode);
  const destHub = manifest.destHubCode ? findHub(store, manifest.destHubCode) : null;

  let codTotal = 0;
  let totalPieces = 0;
  const rows = manifest.awbs.map((awb, idx) => {
    const shipment = findShipmentByCode(awb);
    const order = shipment ? findShopOrder(shipment.orderId) : null;
    const addr = order?.deliveryAddress || shipment?.toAddress;
    const isCod = /cod|cash on delivery/i.test(String(order?.paymentMethod || "")) && order?.paymentStatus !== "Paid";
    const codAmt = isCod ? Math.round(Number(order?.total || 0)) : 0;
    codTotal += codAmt;
    const qty = (order?.items || shipment?.items || []).reduce((s, i) => s + Number(i.quantity || 1), 0) || 1;
    totalPieces += qty;
    return {
      idx: idx + 1,
      awb,
      orderId: shipment?.orderId || "—",
      customer: addr?.fullName || "Customer",
      phone: addr?.phone || "—",
      cityPin: `${addr?.city || "—"} ${addr?.pincode || ""}`.trim(),
      items: (order?.items || shipment?.items || []).map((i) => `${i.title} ×${i.quantity}`).join(", ") || "—",
      pay: isCod ? `COD ₹${codAmt}` : "Prepaid",
      status: shipment?.status || "Manifested",
    };
  });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VGMF Manifest · ${esc(manifest.id)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; }
    .page { max-width: 920px; margin: 0 auto; background: #fff; border: 1px solid #d1d5db; padding: 24px; }
    .toolbar { max-width: 920px; margin: 0 auto 12px; display: flex; justify-content: flex-end; }
    .btn { background: #1d4ed8; color: #fff; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 12px; }
    .h1 { font-size: 20px; font-weight: 900; margin: 0; }
    .sub { font-size: 12px; color: #4b5563; margin-top: 4px; }
    .barcode { width: 240px; text-align: center; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; font-size: 12px; }
    .meta-box { border: 1px solid #e5e7eb; padding: 8px 10px; border-radius: 6px; background: #f9fafb; }
    .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; }
    .meta-val { font-weight: 800; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #111827; color: #fff; font-weight: 700; }
    .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 28px; font-size: 12px; }
    .sig-line { border-top: 1px solid #111827; padding-top: 6px; margin-top: 34px; font-weight: 700; }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none; }
      .page { border: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button class="btn" onclick="window.print()">Print Manifest</button></div>
  <div class="page">
    <div class="top">
      <div>
        <h1 class="h1">VGMF EXPRESS — ${esc(TYPE_LABELS[manifest.type] || manifest.type)}</h1>
        <div class="sub">Vaidya Gogate Memorial Foundation · Internal Courier Operations</div>
        <div class="sub">Created: ${esc(new Date(manifest.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))} · By: ${esc(manifest.createdBy)}</div>
      </div>
      <div class="barcode">
        ${code128Svg(manifest.id, 46)}
        <div style="font-family:monospace;font-weight:900;font-size:12px;margin-top:3px;">${esc(manifest.id)}</div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-box"><div class="meta-label">Origin Hub</div><div class="meta-val">${esc(originHub.name)} (${esc(originHub.code)})</div></div>
      <div class="meta-box"><div class="meta-label">Destination Hub</div><div class="meta-val">${destHub ? `${esc(destHub.name)} (${esc(destHub.code)})` : "Last-Mile / Local"}</div></div>
      <div class="meta-box"><div class="meta-label">Delivery Partner / Vehicle</div><div class="meta-val">${esc(manifest.riderName)}${manifest.vehicleNo ? ` · ${esc(manifest.vehicleNo)}` : ""}</div></div>
      <div class="meta-box"><div class="meta-label">Summary</div><div class="meta-val">${rows.length} Shipments · ${totalPieces} Pcs · COD ₹${codTotal}</div></div>
    </div>

    ${manifest.bagIds.length ? `<div style="font-size:12px;margin:8px 0;"><b>Included Bags (${manifest.bagIds.length}):</b> ${manifest.bagIds.map((b) => `<span style="display:inline-block;border:1px solid #1d4ed8;padding:2px 6px;border-radius:4px;margin-right:6px;font-family:monospace;font-weight:700;">${esc(b)}</span>`).join("")}</div>` : ""}

    <table>
      <thead>
        <tr>
          <th style="width:28px;">#</th>
          <th>AWB / Barcode</th>
          <th>Order #</th>
          <th>Consignee &amp; City</th>
          <th>Items</th>
          <th>Payment</th>
          <th>Status / Sign</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${r.idx}</td>
            <td style="font-family:monospace;font-weight:700;">${esc(r.awb)}</td>
            <td style="font-family:monospace;">${esc(r.orderId)}</td>
            <td><b>${esc(r.customer)}</b><br/>${esc(r.cityPin)}<br/>${esc(r.phone)}</td>
            <td>${esc(r.items)}</td>
            <td><b>${esc(r.pay)}</b></td>
            <td>${esc(r.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    ${manifest.notes ? `<p style="font-size:12px;margin-top:12px;"><b>Notes:</b> ${esc(manifest.notes)}</p>` : ""}

    <div class="sigs">
      <div class="sig-line">Seller / Warehouse Handover</div>
      <div class="sig-line">Delivery Partner (${esc(manifest.riderName)})</div>
      <div class="sig-line">Hub Supervisor Verification</div>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

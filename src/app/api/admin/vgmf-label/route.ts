import { NextRequest, NextResponse } from "next/server";
import { findShopOrder } from "@/lib/server/shop-orders";
import { code128Svg, findShipmentByCode, readLogisticsStore } from "@/lib/server/vgmf-logistics";

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  const awbParam = req.nextUrl.searchParams.get("awb") || req.nextUrl.searchParams.get("orderId") || "";
  if (!awbParam.trim()) {
    return NextResponse.json({ ok: false, error: "Provide ?awb= or ?orderId=" }, { status: 400 });
  }
  const cleanCode = awbParam.trim().toUpperCase();
  const store = readLogisticsStore();
  const retRecord = store.returns.find(
    (r) => r.returnAwb.toUpperCase() === cleanCode || r.id.toUpperCase() === cleanCode
  );
  if (retRecord) {
    const order = findShopOrder(retRecord.originalOrderId);
    const awb = retRecord.returnAwb;
    const orderId = retRecord.originalOrderId;
    const addr = order?.deliveryAddress;
    const items = order?.returnRequest?.items?.length ? order.returnRequest.items : (order?.items || []);
    const totalQty = items.reduce((s, i) => s + Number(i.quantity || 1), 0);
    const routingCode = `RET-${String(retRecord.hubCode || "VGMF-PUN").toUpperCase()}`;
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VGMF Return AWB Label · ${esc(awb)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; }
    .toolbar { max-width: 420px; margin: 0 auto 12px; display: flex; gap: 8px; justify-content: flex-end; }
    .btn { border: 1px solid #047857; background: #047857; color: #fff; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
    .label { width: 4in; min-height: 6in; margin: 0 auto; background: #fff; border: 2px solid #111827; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111827; padding-bottom: 6px; }
    .brand { font-size: 15px; font-weight: 900; letter-spacing: 0.4px; }
    .sub { font-size: 10px; color: #4b5563; font-weight: 600; }
    .badge { padding: 4px 8px; font-size: 11px; font-weight: 900; border: 2px solid #111827; background: #fde68a; }
    .route { display: flex; justify-content: space-between; align-items: center; background: #111827; color: #fff; padding: 6px 10px; font-weight: 800; font-size: 12.5px; letter-spacing: 0.5px; }
    .barcode-box { text-align: center; border: 1px solid #d1d5db; padding: 6px 8px; }
    .barcode-text { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; font-weight: 900; letter-spacing: 1.5px; margin-top: 2px; }
    .box { border: 1px solid #111827; padding: 7px 8px; font-size: 11.5px; line-height: 1.35; }
    .box-title { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #4b5563; margin-bottom: 3px; }
    .cust-name { font-size: 13px; font-weight: 800; }
    .items { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    .items th, .items td { border: 1px solid #d1d5db; padding: 3px 5px; text-align: left; }
    .items th { background: #f3f4f6; font-weight: 700; }
    .foot { margin-top: auto; border-top: 1px dashed #6b7280; padding-top: 6px; font-size: 9.5px; color: #374151; display: flex; justify-content: space-between; }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none; }
      .label { border: 2px solid #000; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.print()">Print 4×6 Return AWB Label</button>
  </div>
  <div class="label">
    <div class="head">
      <div>
        <div class="brand">VGMF EXPRESS · RETURN</div>
        <div class="sub">Vaidya Gogate Memorial Foundation · Reverse Pickup</div>
      </div>
      <div class="badge">${esc(retRecord.kind === "rto" ? "RTO RETURN" : "REVERSE PICKUP")}</div>
    </div>

    <div class="route">
      <span>${esc(routingCode)}</span>
      <span>HUB: ${esc(retRecord.hubCode || "VGMF-PUN")}</span>
    </div>

    <div class="barcode-box">
      ${code128Svg(awb, 58)}
      <div class="barcode-text">RETURN AWB: ${esc(awb)}</div>
    </div>

    <div class="box">
      <div class="box-title">Return To (VGMF Return Hub / Warehouse)</div>
      <div class="cust-name">Vaidya Gogate Memorial Foundation</div>
      <div>Return Hub (${esc(retRecord.hubCode || "Main Hub")}) · Sinhagad Road, Pune, Maharashtra 411030</div>
      <div>Reason: <b>${esc(retRecord.reason || "Customer Return / Replacement")}</b></div>
    </div>

    <div class="box">
      <div class="box-title">Pickup From (Customer)</div>
      <div><b>${esc(addr?.fullName || retRecord.customerName || "Customer")}</b></div>
      <div>${esc(addr?.line1 || retRecord.address || "")}${addr?.landmark ? `, ${esc(addr.landmark)}` : ""}</div>
      <div><b>${esc(addr?.city || retRecord.city || "")}, ${esc(addr?.state || "")} — ${esc(addr?.pincode || retRecord.pincode || "")}</b></div>
      <div>Phone: <b>${esc(addr?.phone || retRecord.customerPhone || "—")}</b></div>
    </div>

    <div class="barcode-box">
      ${code128Svg(orderId, 34)}
      <div style="font-size:11px;font-weight:700;margin-top:2px;">ORIGINAL ORDER #${esc(orderId)} · QTY: ${totalQty}</div>
    </div>

    <table class="items">
      <thead><tr><th>Return Item</th><th style="width:36px;">Qty</th></tr></thead>
      <tbody>
        ${items.map((i) => `<tr><td>${esc(i.title)}</td><td>${esc(i.quantity)}</td></tr>`).join("")}
      </tbody>
    </table>

    <div class="foot">
      <span>Generated: ${esc(new Date(retRecord.createdAt || Date.now()).toLocaleDateString("en-IN"))}</span>
      <span>Track: vaidyagogate.org/track-shipment?awb=${esc(awb)}</span>
    </div>
  </div>
</body>
</html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const shipment = findShipmentByCode(awbParam);
  if (!shipment) {
    return NextResponse.json({ ok: false, error: `Shipment not found for ${awbParam}` }, { status: 404 });
  }
  const order = findShopOrder(shipment.orderId);
  const awb = String(shipment.awb || shipment.orderId);
  const orderId = String(shipment.orderId || "");
  const addr = order?.deliveryAddress || shipment.toAddress;
  const isCod = /cod|cash on delivery/i.test(String(order?.paymentMethod || "")) && order?.paymentStatus !== "Paid";
  const payBadge = isCod ? `COD · ₹${Math.round(Number(order?.total || 0))}` : "PREPAID";
  const items = order?.items || shipment.items || [];
  const totalQty = items.reduce((s, i) => s + Number(i.quantity || 1), 0);
  const routingCode = `VGMF-${String(addr?.pincode || "000000").slice(0, 3)}-${String(addr?.city || "HUB").slice(0, 3).toUpperCase()}`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VGMF AWB Label · ${esc(awb)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; }
    .toolbar { max-width: 420px; margin: 0 auto 12px; display: flex; gap: 8px; justify-content: flex-end; }
    .btn { border: 1px solid #1d4ed8; background: #1d4ed8; color: #fff; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
    .label { width: 4in; min-height: 6in; margin: 0 auto; background: #fff; border: 2px solid #111827; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111827; padding-bottom: 6px; }
    .brand { font-size: 15px; font-weight: 900; letter-spacing: 0.4px; }
    .sub { font-size: 10px; color: #4b5563; font-weight: 600; }
    .badge { padding: 4px 8px; font-size: 12px; font-weight: 900; border: 2px solid #111827; background: ${isCod ? "#fef3c7" : "#dbeafe"}; }
    .route { display: flex; justify-content: space-between; align-items: center; background: #111827; color: #fff; padding: 6px 10px; font-weight: 800; font-size: 13px; letter-spacing: 0.5px; }
    .barcode-box { text-align: center; border: 1px solid #d1d5db; padding: 6px 8px; }
    .barcode-text { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; font-weight: 900; letter-spacing: 1.5px; margin-top: 2px; }
    .box { border: 1px solid #111827; padding: 7px 8px; font-size: 11.5px; line-height: 1.35; }
    .box-title { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #4b5563; margin-bottom: 3px; }
    .cust-name { font-size: 13.5px; font-weight: 800; }
    .items { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    .items th, .items td { border: 1px solid #d1d5db; padding: 3px 5px; text-align: left; }
    .items th { background: #f3f4f6; font-weight: 700; }
    .foot { margin-top: auto; border-top: 1px dashed #6b7280; padding-top: 6px; font-size: 9.5px; color: #374151; display: flex; justify-content: space-between; }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none; }
      .label { border: 2px solid #000; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.print()">Print 4×6 AWB Label</button>
  </div>
  <div class="label">
    <div class="head">
      <div>
        <div class="brand">VGMF EXPRESS</div>
        <div class="sub">Vaidya Gogate Memorial Foundation · Own Fleet</div>
      </div>
      <div class="badge">${esc(payBadge)}</div>
    </div>

    <div class="route">
      <span>ROUTE: ${esc(routingCode)}</span>
      <span>PIN: ${esc(addr?.pincode || "—")}</span>
    </div>

    <div class="barcode-box">
      ${code128Svg(awb, 58)}
      <div class="barcode-text">AWB: ${esc(awb)}</div>
    </div>

    <div class="box">
      <div class="box-title">Deliver To (Consignee)</div>
      <div class="cust-name">${esc(addr?.fullName || "Customer")}</div>
      <div>${esc(addr?.line1 || "")}${addr?.landmark ? `, ${esc(addr.landmark)}` : ""}</div>
      <div><b>${esc(addr?.city || "")}, ${esc(addr?.state || "")} — ${esc(addr?.pincode || "")}</b></div>
      <div>Phone: <b>${esc(addr?.phone || "—")}</b></div>
    </div>

    <div class="box">
      <div class="box-title">Ship From (Seller / Return Address)</div>
      <div><b>Vaidya Gogate Memorial Foundation</b></div>
      <div>Pune Main Warehouse · Sinhagad Road, Pune, Maharashtra 411030</div>
      <div>Support: https://vaidyagogate.org</div>
    </div>

    <div class="barcode-box">
      ${code128Svg(orderId, 34)}
      <div style="font-size:11px;font-weight:700;margin-top:2px;">ORDER #${esc(orderId)} · QTY: ${totalQty}</div>
    </div>

    <table class="items">
      <thead><tr><th>Item</th><th style="width:36px;">Qty</th></tr></thead>
      <tbody>
        ${items.map((i) => `<tr><td>${esc(i.title)}</td><td>${esc(i.quantity)}</td></tr>`).join("")}
      </tbody>
    </table>

    <div class="foot">
      <span>Generated: ${esc(new Date(shipment.generatedAt || Date.now()).toLocaleDateString("en-IN"))}</span>
      <span>Track: vaidyagogate.org/track</span>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

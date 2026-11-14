import type { OrderSettings } from "@/lib/integrations";
import { getOrderSettings } from "@/lib/integrations";
import { siteConfig } from "@/lib/constants";
import type { Order } from "@/types";

function rupees(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Opens a printable invoice when the desk has switched invoices on. Tax lines show only when GST is switched on. */
export function printGstInvoice(order: Order, settings: OrderSettings = getOrderSettings()) {
  if (!settings.gst.invoiceEnabled || typeof window === "undefined") return;
  const when = new Date(order.date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const gst = settings.gst.enabled && (order.gst ?? 0) > 0;
  const to = order.deliveryAddress;
  const rows = order.items
    .map(
      (item) =>
        `<tr><td>${esc(item.title)}${item.batchNo ? `<br><small>Batch ${esc(item.batchNo)}</small>` : ""}</td><td>${item.quantity}</td><td>${rupees(item.price)}</td><td>${rupees(item.price * item.quantity)}</td></tr>`
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><title>Invoice ${esc(order.id)}</title>
    <style>
      body { font-family: Georgia, serif; color: #1c1917; margin: 32px; }
      h1 { font-size: 22px; margin: 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      td, th { border-bottom: 1px solid #e7e5e4; text-align: left; padding: 8px 0; font-size: 14px; }
      .right { text-align: right; }
      .muted { color: #57534e; font-size: 13px; }
    </style></head><body>
    <img src="${esc(window.location.origin)}/uploads/site-logo.png" alt="" style="height:56px;width:auto;max-width:160px;object-fit:contain" onerror="this.style.display='none'"/>
    <p class="muted">Invoice</p>
    <h1>${esc(settings.gst.legalName || siteConfig.name)}</h1>
    ${gst && settings.gst.gstin ? `<p class="muted">GSTIN ${esc(settings.gst.gstin)} · ${esc(settings.gst.stateName)}</p>` : ""}
    <p>Invoice ${esc(order.id)}<br>${esc(when)} IST</p>
    <table><tr>
      <td style="vertical-align:top;width:50%"><b>From</b><br>${esc(siteConfig.name)}<br>${esc(siteConfig.address)}<br>Phone ${esc(siteConfig.phone)} · ${esc(siteConfig.email)}</td>
      <td style="vertical-align:top"><b>To</b><br>${esc(to?.fullName || "")}<br>${esc([to?.line1, to?.landmark].filter(Boolean).join(", "))}<br>${esc([to?.city, to?.state, to?.pincode].filter(Boolean).join(", "))}${to?.phone ? `<br>Phone ${esc(to.phone)}` : ""}</td>
    </tr></table>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <table>
      <tr><td>Subtotal</td><td class="right">${rupees(order.subtotal + (order.discount || 0))}</td></tr>
      ${order.discount ? `<tr><td>Discount</td><td class="right">−${rupees(order.discount)}</td></tr>` : ""}
      ${gst ? `<tr><td>GST ${esc(settings.gst.ratePercent)}%</td><td class="right">${rupees(order.gst)}</td></tr>` : ""}
      ${(order.platformFee || 0) > 0 ? `<tr><td>Platform fee</td><td class="right">${rupees(order.platformFee || 0)}</td></tr>` : ""}
      <tr><td>Shipping</td><td class="right">${rupees(order.shipping)}</td></tr>
      <tr><td><b>Total</b></td><td class="right"><b>${rupees(order.total)}</b></td></tr>
    </table>
    </body></html>`;
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

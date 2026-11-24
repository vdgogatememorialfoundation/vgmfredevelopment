import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { findShopOrder, patchShopOrder } from "@/lib/server/shop-orders";
import { razorpayCreds, razorpayLink, razorpayLinkStatus } from "@/lib/server/providers";
import { savedAdminIntegrations } from "@/lib/server/admin-integrations";
import { readLogisticsSettings } from "@/lib/server/vgmf-logistics-settings";
import { sendMobileEmail } from "@/lib/server/mobile-mail";

/** Paytm AES-128-CBC checksum helper (per Paytm Offline QR Business API docs). */
function paytmEncrypt(input: string, key: string) {
  const iv = "@@@@&&&&####$$$$";
  const k = Buffer.from(key.slice(0, 16).padEnd(16, "0"), "utf8");
  const cipher = createCipheriv("aes-128-cbc", k, Buffer.from(iv, "utf8"));
  let encrypted = cipher.update(input, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

function paytmGenerateSignature(bodyStr: string, merchantKey: string) {
  const salt = randomBytes(3).toString("hex").slice(0, 4);
  const hash = createHash("sha256").update(`${bodyStr}|${salt}`).digest("hex") + salt;
  return paytmEncrypt(hash, merchantKey);
}

function paytmConfig() {
  const cfg = readLogisticsSettings().current;
  const f = cfg.finance as unknown as {
    paytmMid?: string;
    paytmMerchantKey?: string;
    paytmPosId?: string;
    paytmUpiId?: string;
    paytmMode?: "production" | "staging";
  };
  return {
    mid: (f.paytmMid || process.env.PAYTM_MID || "").trim(),
    merchantKey: (f.paytmMerchantKey || process.env.PAYTM_MERCHANT_KEY || "").trim(),
    posId: (f.paytmPosId || process.env.PAYTM_POS_ID || "VGMF_DELIVERY_POS").trim(),
    upiId: (f.paytmUpiId || process.env.PAYTM_UPI_ID || "").trim(),
    baseUrl: f.paytmMode === "staging" ? "https://securegw-stage.paytm.in" : "https://securegw.paytm.in",
  };
}

/** Generate a doorstep COD QR via Paytm Offline QR API (with UPI QR fallback) or Razorpay Payment Link / QR. */
export async function createDoorstepCodQr(input: {
  orderId: string;
  provider: "paytm" | "razorpay";
  executiveName: string;
}) {
  const order = findShopOrder(input.orderId);
  if (!order) throw new Error(`Order #${input.orderId} not found.`);
  const amountDue = Math.max(0, Math.round((Number(order.total || 0) - Number(order.amountPaid || 0)) * 100) / 100) || Number(order.total || 0);
  if (amountDue <= 0) throw new Error("No COD balance due on this order.");

  if (input.provider === "paytm") {
    const pt = paytmConfig();
    const ptOrderId = `VGMF-${order.id}-${Date.now().toString().slice(-4)}`;
    if (pt.mid && pt.merchantKey) {
      const bodyObj = {
        mid: pt.mid,
        orderId: ptOrderId,
        amount: amountDue.toFixed(2),
        businessType: "UPI_QR_CODE",
        posId: pt.posId,
      };
      const bodyStr = JSON.stringify(bodyObj);
      const signature = paytmGenerateSignature(bodyStr, pt.merchantKey);
      const res = await fetch(`${pt.baseUrl}/paymentservices/qr/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: bodyObj,
          head: { clientId: "C11", version: "v1", signature },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { body?: { qrData?: string; image?: string; resultInfo?: { resultMsg?: string; resultStatus?: string } } };
      if (data?.body?.qrData) {
        return {
          provider: "paytm" as const,
          referenceId: ptOrderId,
          amount: amountDue,
          qrData: data.body.qrData,
          qrImageBase64: data.body.image || "",
          message: `Paytm Dynamic QR generated for ₹${amountDue}.`,
        };
      }
      throw new Error(data?.body?.resultInfo?.resultMsg || "Paytm Offline QR API did not return QR data.");
    }
    if (!pt.upiId) {
      throw new Error("Configure Paytm MID + Merchant Key (or Paytm Business UPI ID) in Admin → VGMF Logistics → Logistics Settings → COD & Rate Cards.");
    }
    const upiUri = `upi://pay?pa=${encodeURIComponent(pt.upiId)}&pn=${encodeURIComponent("VGMF Logistics")}&am=${amountDue.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`COD Order ${order.id}`)}&tr=${encodeURIComponent(ptOrderId)}`;
    return {
      provider: "paytm" as const,
      referenceId: ptOrderId,
      amount: amountDue,
      qrData: upiUri,
      qrImageBase64: "",
      message: `Paytm Business UPI QR generated for ₹${amountDue}.`,
    };
  }

  // Razorpay Doorstep COD QR / Link
  const creds = razorpayCreds(savedAdminIntegrations().razorpay as Parameters<typeof razorpayCreds>[0]);
  if (!creds) throw new Error("Razorpay is not configured in Admin → Settings → Payments.");
  const linkRes = await razorpayLink(creds, {
    amount: amountDue,
    orderId: `${order.id}-COD-${Date.now().toString(36).slice(-4)}`,
    name: order.deliveryAddress?.fullName || "Customer",
    email: order.deliveryAddress?.email,
    phone: order.deliveryAddress?.phone,
    description: `COD Payment for VGMF Order #${order.id} (Collected by ${input.executiveName})`,
    callbackUrl: `https://vaidyagogate.org/track-shipment?awb=${encodeURIComponent(order.trackingId || order.id)}`,
  });
  if (!linkRes?.url) {
    throw new Error("Could not create Razorpay COD payment QR/link.");
  }
  return {
    provider: "razorpay" as const,
    referenceId: linkRes.id || order.id,
    amount: amountDue,
    qrData: linkRes.url,
    paymentUrl: linkRes.url,
    qrImageBase64: "",
    message: `Razorpay COD QR / Link generated for ₹${amountDue}.`,
  };
}

/** Verify & sync COD payment (Paytm QR status / Razorpay Link status / Cash) directly to Merchant Portal & Customer End! */
export async function confirmAndSyncCodPayment(input: {
  orderId: string;
  method: "cash" | "paytm" | "razorpay";
  referenceId?: string;
  utr?: string;
  executiveName: string;
}) {
  const order = findShopOrder(input.orderId);
  if (!order) throw new Error(`Order #${input.orderId} not found.`);
  const amountDue = Math.max(0, Math.round((Number(order.total || 0) - Number(order.amountPaid || 0)) * 100) / 100) || Number(order.total || 0);
  let verifiedRef = (input.utr || input.referenceId || "").trim();

  if (input.method === "razorpay" && input.referenceId) {
    const creds = razorpayCreds(savedAdminIntegrations().razorpay as Parameters<typeof razorpayCreds>[0]);
    if (!creds) throw new Error("Razorpay is not configured.");
    const status = await razorpayLinkStatus(creds, input.referenceId);
    if (status.status !== "paid") {
      throw new Error(`Razorpay payment not completed yet (status: ${status.status || "created"}). Ask customer to complete UPI/card payment.`);
    }
    verifiedRef = status.paymentId || input.referenceId;
  }

  if (input.method === "paytm" && input.referenceId) {
    const pt = paytmConfig();
    if (pt.mid && pt.merchantKey) {
      const bodyObj = { mid: pt.mid, orderId: input.referenceId };
      const signature = paytmGenerateSignature(JSON.stringify(bodyObj), pt.merchantKey);
      const res = await fetch(`${pt.baseUrl}/v3/order/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: bodyObj, head: { signature } }),
      });
      const data = (await res.json().catch(() => ({}))) as { body?: { resultInfo?: { resultStatus?: string; resultMsg?: string }; txnId?: string; bankTxnId?: string } };
      if (data?.body?.resultInfo?.resultStatus !== "TXN_SUCCESS") {
        throw new Error(`Paytm QR payment not confirmed yet (${data?.body?.resultInfo?.resultMsg || "Pending"}).`);
      }
      verifiedRef = data.body.bankTxnId || data.body.txnId || input.referenceId;
    }
  }

  const now = new Date().toISOString();
  const methodLabel =
    input.method === "paytm" ? "COD · Paytm Offline QR" : input.method === "razorpay" ? "COD · Razorpay QR/UPI" : "COD · Cash";

  const updated = patchShopOrder(order.id, {
    paymentStatus: "Paid",
    paymentMethod: methodLabel,
    paymentRef: verifiedRef || `COD-${Date.now().toString().slice(-6)}`,
    amountPaid: order.total,
    paidAt: now,
    history: [
      ...(order.history ?? []),
      {
        at: now,
        status: order.status,
        by: input.executiveName,
        note: `Doorstep ${methodLabel} ₹${amountDue} collected & synced to Merchant Portal + Customer${verifiedRef ? ` (Ref: ${verifiedRef})` : ""}`,
      },
    ],
  });

  // Notify Customer immediately with payment confirmation receipt
  const custEmail = order.deliveryAddress?.email || order.accountEmail;
  if (custEmail) {
    void sendMobileEmail(
      custEmail,
      `Payment Received · ₹${amountDue} for VGMF Order #${order.id}`,
      `Namaste ${order.deliveryAddress?.fullName || "Customer"},\n\nWe have received your doorstep payment of ₹${amountDue} for VGMF Order #${order.id} via ${methodLabel}${verifiedRef ? ` (Ref: ${verifiedRef})` : ""}.\n\nYour order payment status is now updated to PAID.`
    ).catch(() => undefined);
  }

  return {
    order: updated,
    method: methodLabel,
    amount: amountDue,
    reference: verifiedRef,
    message: `${methodLabel} (₹${amountDue}) confirmed & synced to Merchant Portal and Customer!`,
  };
}

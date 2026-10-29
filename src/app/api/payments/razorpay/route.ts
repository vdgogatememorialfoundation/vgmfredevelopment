import { NextRequest, NextResponse } from "next/server";
import {
  ProviderError,
  razorpayCreds,
  razorpayDeviceActivity,
  razorpayDeviceActivityStatus,
  razorpayLink,
  razorpayLinkStatus,
  razorpayOrder,
  razorpayOrderPayments,
  razorpayRefund,
  razorpayVerify,
} from "@/lib/server/providers";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const creds = razorpayCreds(body);
  if (!creds) {
    return NextResponse.json({ ok: false, configured: false, error: "Razorpay keys are not configured." });
  }
  try {
    switch (body.action) {
      case "order":
        return NextResponse.json({
          ok: true,
          configured: true,
          ...(await razorpayOrder(
            creds,
            Number(body.amount),
            String(body.receipt ?? ""),
            body.deviceMode === "wired" || body.deviceMode === "wireless" ? body.deviceMode : undefined
          )),
        });
      case "verify":
        return NextResponse.json({
          ok: true,
          configured: true,
          verified: razorpayVerify(creds.keySecret, String(body.orderId), String(body.paymentId), String(body.signature)),
        });
      case "link":
        return NextResponse.json({
          ok: true,
          configured: true,
          ...(await razorpayLink(creds, {
            amount: Number(body.amount),
            orderId: String(body.orderId),
            name: String(body.name ?? "Customer"),
            email: body.email ? String(body.email) : undefined,
            phone: body.phone ? String(body.phone) : undefined,
            description: String(body.description ?? `Order ${body.orderId}`),
            callbackUrl: body.callbackUrl ? String(body.callbackUrl) : undefined,
            expiryHours: Number(body.expiryHours ?? 72),
          })),
        });
      case "link-status":
        return NextResponse.json({ ok: true, configured: true, ...(await razorpayLinkStatus(creds, String(body.linkId))) });
      case "refund":
        return NextResponse.json({
          ok: true,
          configured: true,
          ...(await razorpayRefund(creds, String(body.paymentId), body.amount ? Number(body.amount) : undefined)),
        });
      case "edc-start": {
        const deviceMode = body.deviceMode === "wired" ? "wired" : "wireless";
        const order = await razorpayOrder(creds, Number(body.amount), String(body.receipt ?? ""), deviceMode);
        const activity = await razorpayDeviceActivity(creds, {
          action: "initiate_checkout",
          deviceMode,
          deviceId: body.deviceId ? String(body.deviceId) : undefined,
          amountRupees: Number(body.amount),
          orderId: order.orderId,
          name: body.name ? String(body.name) : undefined,
          email: body.email ? String(body.email) : undefined,
          phone: body.phone ? String(body.phone) : undefined,
          method: body.method === "upi" ? "upi" : "card",
          description: String(body.description ?? "POS sale"),
        });
        if (activity.status === "failed") {
          return NextResponse.json({ ok: false, configured: true, error: activity.error ?? "The Razorpay EDC did not accept the payment." });
        }
        return NextResponse.json({ ok: true, configured: true, ...order, ...activity });
      }
      case "edc-status": {
        const deviceMode = body.deviceMode === "wired" ? "wired" : "wireless";
        const activity = body.activityId
          ? await razorpayDeviceActivityStatus(creds, String(body.activityId), deviceMode)
          : { status: "", error: undefined };
        const payments = body.orderId
          ? await razorpayOrderPayments(creds, String(body.orderId), deviceMode)
          : { status: "", paymentId: undefined, method: undefined };
        const paid = payments.status === "paid" || Boolean(payments.paymentId);
        const failed = activity.status === "failed";
        return NextResponse.json({
          ok: true,
          configured: true,
          paid,
          failed,
          pending: !paid && !failed,
          activityStatus: activity.status,
          orderStatus: payments.status,
          paymentId: payments.paymentId,
          method: payments.method,
          error: failed ? activity.error : undefined,
        });
      }
      case "edc-close":
        await razorpayDeviceActivity(creds, {
          action: "close_checkout",
          deviceMode: body.deviceMode === "wired" ? "wired" : "wireless",
          deviceId: body.deviceId ? String(body.deviceId) : undefined,
        });
        return NextResponse.json({ ok: true, configured: true });
      case "test":
        await razorpayOrder(creds, 1, `test-${Date.now()}`);
        return NextResponse.json({ ok: true, configured: true, message: "Razorpay accepted these keys." });
      default:
        return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const status = error instanceof ProviderError ? error.status : 502;
    return NextResponse.json({ ok: false, configured: true, error: (error as Error).message }, { status: status >= 500 ? 502 : 200 });
  }
}

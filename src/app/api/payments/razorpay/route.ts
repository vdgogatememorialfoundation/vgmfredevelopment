import { NextRequest, NextResponse } from "next/server";
import {
  ProviderError,
  razorpayCreds,
  razorpayLink,
  razorpayLinkStatus,
  razorpayOrder,
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
        return NextResponse.json({ ok: true, configured: true, ...(await razorpayOrder(creds, Number(body.amount), String(body.receipt ?? ""))) });
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

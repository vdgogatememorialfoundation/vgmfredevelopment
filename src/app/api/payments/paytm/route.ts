import { NextRequest, NextResponse } from "next/server";
import { paytmCreds, paytmEdcSale, paytmEdcStatus, ProviderError } from "@/lib/server/providers";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const creds = paytmCreds(body);
  if (!creds) {
    return NextResponse.json({ ok: false, configured: false, error: "Paytm EDC MID, TID and merchant key are not configured." });
  }
  try {
    switch (body.action) {
      case "sale":
        return NextResponse.json({
          ok: true,
          configured: true,
          ...(await paytmEdcSale(creds, {
            amountRupees: Number(body.amount),
            merchantTransactionId: String(body.merchantTransactionId ?? ""),
            merchantReferenceNo: body.merchantReferenceNo ? String(body.merchantReferenceNo) : undefined,
          })),
        });
      case "status":
        return NextResponse.json({
          ok: true,
          configured: true,
          ...(await paytmEdcStatus(creds, {
            merchantTransactionId: String(body.merchantTransactionId ?? ""),
            transactionDateTime: String(body.transactionDateTime ?? ""),
          })),
        });
      case "test": {
        const result = await paytmEdcStatus(creds, {
          merchantTransactionId: `TEST${Date.now()}`.slice(0, 32),
          transactionDateTime: new Date().toISOString().slice(0, 19).replace("T", " "),
        });
        if (String(result.message).toLowerCase().includes("checksum")) {
          return NextResponse.json({ ok: false, configured: true, error: result.message });
        }
        return NextResponse.json({
          ok: true,
          configured: true,
          message: "Paytm accepted these EDC credentials (checksum and MID/TID reached Paytm).",
        });
      }
      default:
        return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const status = error instanceof ProviderError ? error.status : 502;
    return NextResponse.json({ ok: false, configured: true, error: (error as Error).message }, { status: status >= 500 ? 502 : 200 });
  }
}

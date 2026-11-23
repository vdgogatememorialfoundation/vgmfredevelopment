import { NextRequest, NextResponse } from "next/server";
import { portalSessionFrom } from "@/lib/server/portal-auth";
import { listPackedUnpaidOrders, sendBalanceDueReminder, type ReminderChannel } from "@/lib/server/balance-reminder";
import { corsHeaders } from "@/lib/server/mobile-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const session = portalSessionFrom(request);
  if (!session) return json({ ok: false, error: "Sign in required." }, 401);
  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    orderIds?: string[];
    allPackedUnpaid?: boolean;
    channels?: ReminderChannel[];
  } | null;
  const channels = Array.isArray(body?.channels) && body.channels.length ? body.channels : (["whatsapp", "email"] as ReminderChannel[]);
  const by = session.name || session.email || "Admin";

  if (body?.allPackedUnpaid || Array.isArray(body?.orderIds)) {
    const ids = body.allPackedUnpaid
      ? listPackedUnpaidOrders().map((o) => o.id)
      : (body.orderIds ?? []).map((id) => String(id).trim()).filter(Boolean);
    if (!ids.length) return json({ ok: true, results: [], sentCount: 0, message: "No packed orders with unpaid balance." });
    const results = [];
    for (const id of ids) {
      results.push(await sendBalanceDueReminder(id, { channels, by }));
    }
    const sentCount = results.filter((r) => r.ok).length;
    return json({ ok: sentCount > 0, results, sentCount, total: ids.length });
  }

  const orderId = String(body?.orderId ?? "").trim();
  if (!orderId) return json({ ok: false, error: "Send an orderId." }, 400);
  const result = await sendBalanceDueReminder(orderId, { channels, by });
  return json(result, result.ok ? 200 : 400);
}

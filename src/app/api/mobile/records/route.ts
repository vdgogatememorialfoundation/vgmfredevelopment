import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { bearerToken, sessionFromToken } from "@/lib/server/mobile-store";
import { findAccount } from "@/lib/server/accounts";
import { liveRecordsForEmail } from "@/lib/server/partner-portals";
import { isTerminalPartnerStatus, pipelineIndexFor, pipelineStepsFor, prettyPartnerStatus, type PartnerStatusCatalog } from "@/lib/application-pipeline";
import type { PartnerTicketSummary } from "@/types";

/** The website's application tracker steps for one registration. */
function pipelineFor(ticket: PartnerTicketSummary, statuses?: Partial<PartnerStatusCatalog>) {
  try {
    const steps = pipelineStepsFor(ticket.portal, statuses, ticket.status).map((step) => step.label);
    const index = pipelineIndexFor(steps.map((label) => ({ key: label, label })), ticket.status);
    const rejected = isTerminalPartnerStatus(ticket.status);
    const live = prettyPartnerStatus(ticket.status) || ticket.status;
    if (rejected) return { steps: [steps[0], steps[index]].filter((step, i, all) => step && all.indexOf(step) === i), current: index > 0 ? 1 : 0, rejected, live };
    return { steps, current: Math.max(0, index), rejected, live };
  } catch {
    return null;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const token = bearerToken(request.headers.get("authorization"));
  const session = sessionFromToken(token ?? "");
  if (!session) return json({ ok: false, error: "Sign in again." }, 401);
  const account = findAccount(session.email);
  const email = (account?.email || session.email).trim().toLowerCase();
  const records = email ? await liveRecordsForEmail(email) : null;
  return json({
    ok: true,
    email,
    tickets: (records?.tickets ?? []).map((ticket) => ({ ...ticket, pipeline: pipelineFor(ticket, records?.statuses) })),
    payments: records?.payments ?? [],
    statuses: records?.statuses ?? {},
    syncedAt: records?.syncedAt ?? new Date().toISOString(),
    source: records?.source ?? "none",
  });
}

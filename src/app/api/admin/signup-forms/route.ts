import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { listSignupForms, renderSignupForms } from "@/lib/server/signup-forms";
import { siteOrigin } from "@/lib/server/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const forms = listSignupForms();
  if (params.get("format") !== "html") {
    return NextResponse.json({ ok: true, forms }, { headers: { "cache-control": "no-store" } });
  }
  const ids = new Set((params.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean));
  const chosen = params.get("all") ? forms : forms.filter((form) => ids.has(form.formId) || ids.has(form.accountId));
  if (!chosen.length) return new NextResponse("No signup forms selected.", { status: 404 });
  return new NextResponse(renderSignupForms(chosen, siteOrigin(request)), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

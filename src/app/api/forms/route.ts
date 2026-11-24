import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { viewerEmail } from "@/lib/server/form-viewer";
import { canAnswer, formsFor, listForms, submitResponse } from "@/lib/server/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { ...corsHeaders, "cache-control": "no-store" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/** Forms the visitor may answer (by audience); `?id=` returns one form if it is open to them. */
export function GET(request: NextRequest) {
  const { email } = viewerEmail(request);
  const formId = request.nextUrl.searchParams.get("id") ?? "";
  if (formId) {
    const form = listForms().find((item) => item.id === formId && item.active);
    if (!form) return NextResponse.json({ ok: false, error: "This form is no longer available." }, { status: 404, headers });
    if (!canAnswer(form, email)) {
      return NextResponse.json({ ok: false, signIn: !email, error: email ? "This form is not open for your account." : "Sign in to answer this form." }, { status: 403, headers });
    }
    return NextResponse.json({ ok: true, form, email }, { headers });
  }
  return NextResponse.json({ ok: true, forms: formsFor(email), email }, { headers });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; email?: string; name?: string; answers?: Record<string, unknown> };
  const viewer = viewerEmail(request);
  try {
    const response = submitResponse(String(body.id ?? ""), { email: viewer.email || String(body.email ?? ""), name: body.name, answers: body.answers ?? {} });
    return NextResponse.json({ ok: true, id: response.id }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400, headers });
  }
}

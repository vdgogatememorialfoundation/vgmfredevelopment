import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { deleteForm, listForms, listOrderFeedback, listResponses, mailForm, productCategories, saveForm, type CustomerForm } from "@/lib/server/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store" };

export function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true, forms: listForms(), responses: listResponses(), feedback: listOrderFeedback(), categories: productCategories() }, { headers });
}

export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { action?: string; form?: Partial<CustomerForm>; id?: string };
  try {
    if (body.action === "save") return NextResponse.json({ ok: true, form: saveForm(body.form ?? {}) }, { headers });
    if (body.action === "delete") {
      deleteForm(String(body.id ?? ""));
      return NextResponse.json({ ok: true }, { headers });
    }
    if (body.action === "mail") return NextResponse.json({ ok: true, ...(await mailForm(String(body.id ?? ""))) }, { headers });
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400, headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400, headers });
  }
}

import { NextResponse } from "next/server";
import { appFlavors, type AppFlavorId } from "@/lib/mobile-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLAVORS = new Set(appFlavors.map((item) => item.id));

export async function GET(request: Request, context: { params: Promise<{ flavor: string }> }) {
  const { flavor: raw } = await context.params;
  const flavor = raw as AppFlavorId;
  if (!FLAVORS.has(flavor)) {
    return NextResponse.json({ ok: false, error: "Unknown app. Use customer, admin, staff or support." }, { status: 404 });
  }

  // Serve from /public/apps via the CDN. Reading the APK inside this route 404s on
  // hosted Node (public files are not in the function filesystem) and can exceed
  // the serverless response size limit.
  return NextResponse.redirect(new URL(`/apps/vgmf-${flavor}.apk`, request.url), 302);
}

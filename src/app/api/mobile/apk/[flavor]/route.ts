import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { appFlavors, type AppFlavorId } from "@/lib/mobile-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLAVORS = new Set(appFlavors.map((item) => item.id));

function pathsFor(flavor: AppFlavorId) {
  const file = `vgmf-${flavor}.apk`;
  return [
    join(process.cwd(), "public", "apps", file),
    join("/opt/cursor/artifacts/apps", file),
    join("/opt/cursor/artifacts", file),
    flavor === "customer" ? join(process.cwd(), "public", "vgmf-foundation.apk") : "",
    flavor === "customer" ? join("/opt/cursor/artifacts", "vgmf-foundation.apk") : "",
  ].filter(Boolean);
}

export async function GET(_request: Request, context: { params: Promise<{ flavor: string }> }) {
  const { flavor: raw } = await context.params;
  const flavor = raw as AppFlavorId;
  if (!FLAVORS.has(flavor)) {
    return NextResponse.json({ ok: false, error: "Unknown app. Use customer, admin, staff or support." }, { status: 404 });
  }

  const path = pathsFor(flavor).find((item) => existsSync(item));
  if (!path) {
    return NextResponse.json(
      {
        ok: false,
        error: `The ${flavor} Android APK is not on this host yet. Build native/android-apps and copy vgmf-${flavor}.apk into public/apps/.`,
      },
      { status: 404 }
    );
  }

  const body = readFileSync(path);
  const filename = `vgmf-${flavor}.apk`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/vnd.android.package-archive",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(statSync(path).size),
      "cache-control": "private, max-age=60",
      "x-vgmf-apk": path,
    },
  });
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { dataFile } from "@/lib/server/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  pdf: "application/pdf",
};

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path ?? [];
  if (!parts.length || parts.some((part) => !part || part.includes("..") || part.includes("/") || part.includes("\\"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const name = parts.join("/");
  const candidates = [dataFile("uploads", name), join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads", name)];
  for (const file of candidates) {
    try {
      const body = readFileSync(/* turbopackIgnore: true */ file);
      const ext = name.split(".").pop()?.toLowerCase() || "";
      return new NextResponse(body, {
        headers: {
          "content-type": TYPES[ext] || "application/octet-stream",
          "cache-control": "public, max-age=86400",
        },
      });
    } catch {
      /* try the next path */
    }
  }
  return new NextResponse("Not found", { status: 404 });
}

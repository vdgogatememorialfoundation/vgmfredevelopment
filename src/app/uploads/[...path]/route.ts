import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { dataFile } from "@/lib/server/paths";
import { getR2Object } from "@/lib/server/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp4: "video/mp4",
};

function typedResponse(name: string, body: Buffer, type?: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const svg = ext === "svg" || (type || "").includes("svg");
  const fileName = (name.split("/").pop() || "file").replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": svg ? "application/octet-stream" : type || TYPES[ext] || "application/octet-stream",
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      ...(svg ? { "content-disposition": `attachment; filename="${fileName}"` } : {}),
    },
  });
}

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
      return typedResponse(name, body);
    } catch {
      /* try the next path */
    }
  }
  const remote = await getR2Object(`uploads/${name}`).catch(() => null);
  if (remote) {
    try {
      const dest = dataFile("uploads", name);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, remote.body);
    } catch {
      /* serve without caching locally */
    }
    return typedResponse(name, remote.body, remote.type);
  }
  return new NextResponse("Not found", { status: 404 });
}

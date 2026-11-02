import { NextRequest, NextResponse } from "next/server";
import { portalSessionFrom } from "@/lib/server/portal-auth";
import { seminarOfficeAdminId, seminarVideoDbConfigured, seminarVideoOrigin } from "@/lib/server/seminar-videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);

async function forward(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (!METHODS.has(request.method)) return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
  const session = portalSessionFrom(request);
  if (!session || session.role === "doctor") return NextResponse.json({ error: "Sign in to the office desk." }, { status: 401 });
  if (!seminarVideoDbConfigured()) return NextResponse.json({ error: "Seminar videos are not connected on this server yet." }, { status: 503 });
  const adminId = await seminarOfficeAdminId();
  if (!adminId) return NextResponse.json({ error: "No seminar office admin is available." }, { status: 503 });

  const { path = [] } = await context.params;
  if (path.some((part) => !part || part === "." || part === ".." || part.includes("\\") || part.includes("/"))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const query = new URLSearchParams(request.nextUrl.searchParams);
  query.delete("actingAdminId");
  query.delete("adminUserId");
  query.set("actingAdminId", String(adminId));
  const target = `${seminarVideoOrigin()}/api/admin/videos${path.length ? `/${path.map((part) => encodeURIComponent(part)).join("/")}` : ""}?${query.toString()}`;

  const headers = new Headers();
  headers.set("accept", request.headers.get("accept") || "application/json");
  headers.set("x-acting-user-id", String(adminId));
  const contentType = request.headers.get("content-type") || "";
  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (contentType.includes("application/json")) {
      const parsed = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const payload = parsed && typeof parsed === "object" ? { ...parsed } : {};
      delete payload.actingAdminId;
      delete payload.adminUserId;
      payload.actingAdminId = adminId;
      headers.set("content-type", "application/json");
      body = JSON.stringify(payload);
    } else {
      if (contentType) headers.set("content-type", contentType);
      body = Buffer.from(await request.arrayBuffer());
    }
  }

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(request.method === "PUT" ? 120_000 : 45_000),
  });
  const bytes = await upstream.arrayBuffer();
  const out = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type");
  if (type) out.set("content-type", type);
  return new NextResponse(bytes, { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;

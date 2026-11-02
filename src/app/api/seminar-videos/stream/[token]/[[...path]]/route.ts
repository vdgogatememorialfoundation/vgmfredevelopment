import { NextRequest, NextResponse } from "next/server";
import { seminarVideoOrigin } from "@/lib/server/seminar-videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_PATH = /^(index\.m3u8|key|seg\/seg_\d{5}\.ts)$/;

function rewriteCookies(upstream: Response, token: string) {
  const listed = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  return listed.map((cookie) => cookie.replaceAll(`/video-stream/${token}`, `/api/seminar-videos/stream/${token}`));
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string; path?: string[] }> }) {
  const { token, path } = await context.params;
  const rest = (path || []).join("/");
  if (!/^[a-f0-9]{48}$/.test(token) || !SAFE_PATH.test(rest)) {
    return new NextResponse(null, { status: 404 });
  }
  const target = `${seminarVideoOrigin()}/video-stream/${token}/${rest}${request.nextUrl.search}`;
  const headers = new Headers();
  const userAgent = request.headers.get("user-agent");
  const device = request.headers.get("x-vgmf-device");
  const range = request.headers.get("range");
  const cookie = request.headers.get("cookie");
  if (userAgent) headers.set("user-agent", userAgent);
  if (device) headers.set("x-vgmf-device", device);
  if (range) headers.set("range", range);
  if (cookie) headers.set("cookie", cookie);
  const upstream = await fetch(target, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (rest === "index.m3u8") {
    const text = await upstream.text();
    const rewritten = text.replaceAll(`/video-stream/${token}/`, `/api/seminar-videos/stream/${token}/`);
    const out = new Headers({ "content-type": "application/vnd.apple.mpegurl", "cache-control": "no-store" });
    for (const cookieValue of rewriteCookies(upstream, token)) out.append("set-cookie", cookieValue);
    return new NextResponse(rewritten, { status: upstream.status, headers: out });
  }
  const out = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  for (const cookieValue of rewriteCookies(upstream, token)) out.append("set-cookie", cookieValue);
  return new NextResponse(upstream.body, { status: upstream.status, headers: out });
}

import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { googleClient, googleRedirectUri, safeNext, siteOrigin } from "@/lib/server/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const { id } = googleClient();
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (!id) return NextResponse.redirect(`${siteOrigin(request)}/login?mode=signin&google_error=unavailable`);
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", googleRedirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const response = NextResponse.redirect(url.toString());
  response.cookies.set("vgmf_google_state", JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return response;
}

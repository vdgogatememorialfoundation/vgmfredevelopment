import { NextRequest, NextResponse } from "next/server";
import { googleClient, googleRedirectUri, issueGoogleTicket, safeNext, siteOrigin } from "@/lib/server/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(request: NextRequest, query: string) {
  const response = NextResponse.redirect(`${siteOrigin(request)}/login?mode=signin&${query}`);
  response.cookies.set("vgmf_google_state", "", { path: "/api/auth/google", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get("vgmf_google_state")?.value || "{}");
  } catch {
    saved = {};
  }
  const next = safeNext(saved.next);
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";
  if (params.get("error")) return back(request, `google_error=cancelled${nextQuery}`);
  const code = params.get("code");
  if (!code || !saved.state || saved.state !== params.get("state")) return back(request, `google_error=expired${nextQuery}`);

  const { id, secret } = googleClient();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: googleRedirectUri(request),
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  const tokens = (await tokenResponse?.json().catch(() => null)) as { id_token?: string } | null;
  if (!tokenResponse?.ok || !tokens?.id_token) return back(request, `google_error=failed${nextQuery}`);

  // The ID token came straight from Google's token endpoint over TLS, so its claims can be read directly.
  let claims: Record<string, unknown> = {};
  try {
    claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1] || "", "base64url").toString("utf8"));
  } catch {
    return back(request, `google_error=failed${nextQuery}`);
  }
  const email = String(claims.email || "").trim().toLowerCase();
  if (claims.aud !== id || !email || claims.email_verified !== true) return back(request, `google_error=unverified${nextQuery}`);
  const fullName = String(claims.name || "").trim();
  const ticket = issueGoogleTicket({
    email,
    firstName: String(claims.given_name || fullName.split(" ")[0] || "").trim(),
    lastName: String(claims.family_name || fullName.split(" ").slice(1).join(" ") || "").trim(),
  });
  return back(request, `google=${ticket}${nextQuery}`);
}

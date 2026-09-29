import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/server/session-token";

const RULES: { prefix: string; login: string; roles: string[] }[] = [
  { prefix: "/admin", login: "/admin/login", roles: ["admin"] },
  { prefix: "/staff", login: "/staff/login", roles: ["staff", "admin"] },
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule || pathname === rule.login) return NextResponse.next();
  const session = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session && rule.roles.includes(session.role)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = rule.login;
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};

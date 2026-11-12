import type { NextRequest } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { bearerToken, sessionFromToken } from "@/lib/server/mobile-store";

/** Signed-in customer email from the site cookie or the app's bearer session. */
export function viewerEmail(request: NextRequest) {
  const session = sessionFromToken(bearerToken(request.headers.get("authorization")));
  if (session?.email) return { email: session.email.toLowerCase(), portal: false };
  const viewer = commerceViewer(request);
  return { email: viewer.email, portal: viewer.portal };
}

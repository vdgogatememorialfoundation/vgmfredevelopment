import { errorResponse, getCurrentAccount } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ account: await getCurrentAccount() });
  } catch (error) {
    return errorResponse(error);
  }
}

import { revalidatePath } from "next/cache";
import { getModule } from "@/lib/cms/modules";
import { audit, canAccessModule, errorResponse, HttpError, requireAccount } from "@/lib/server/auth";
import { cleanData, getSetting, putSetting } from "@/lib/server/cms";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string }> };

async function resolve(ctx: Ctx) {
  const { key } = await ctx.params;
  const mod = getModule(key);
  if (!mod || mod.kind !== "settings") throw new HttpError(404, "Unknown settings page.");
  const account = await requireAccount((a) => canAccessModule(a, key));
  return { mod, account };
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { mod } = await resolve(ctx);
    return Response.json({ value: (await getSetting(mod.store)) ?? {} });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { mod, account } = await resolve(ctx);
    const body = (await request.json()) as { value: Record<string, unknown> };
    const current = (await getSetting(mod.store)) ?? {};
    const value = cleanData(mod, body.value ?? {}, current);
    await putSetting(mod.store, value);
    await audit(account.email, `updated settings`, mod.label);
    revalidatePath("/", "layout");
    return Response.json({ value });
  } catch (error) {
    return errorResponse(error);
  }
}

import { revalidatePath } from "next/cache";
import { getModule } from "@/lib/cms/modules";
import { audit, canAccessModule, errorResponse, HttpError, requireAccount } from "@/lib/server/auth";
import { createItem, listItems } from "@/lib/server/cms";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string }> };

async function resolve(ctx: Ctx) {
  const { key } = await ctx.params;
  const mod = getModule(key);
  if (!mod || mod.kind !== "collection") throw new HttpError(404, "Unknown mod.");
  const account = await requireAccount((a) => canAccessModule(a, key));
  return { mod, account };
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { mod } = await resolve(ctx);
    return Response.json({ items: await listItems(mod) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { mod, account } = await resolve(ctx);
    const body = (await request.json()) as { data: Record<string, unknown>; status?: string; sortOrder?: number };
    const item = await createItem(mod, body, account.id).catch((e: unknown) => {
      throw new HttpError(400, e instanceof Error ? e.message : "Invalid data");
    });
    await audit(account.email, `created ${mod.label}`, String(item.data[mod.titleField ?? "title"] ?? item.id));
    revalidatePath("/", "layout");
    return Response.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

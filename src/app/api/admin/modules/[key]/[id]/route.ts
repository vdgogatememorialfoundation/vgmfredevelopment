import { revalidatePath } from "next/cache";
import { getModule } from "@/lib/cms/modules";
import { audit, canAccessModule, errorResponse, HttpError, requireAccount } from "@/lib/server/auth";
import { deleteItem, updateItem } from "@/lib/server/cms";

type Ctx = { params: Promise<{ key: string; id: string }> };

async function resolve(ctx: Ctx) {
  const { key, id } = await ctx.params;
  const mod = getModule(key);
  if (!mod || mod.kind !== "collection") throw new HttpError(404, "Unknown mod.");
  const account = await requireAccount((a) => canAccessModule(a, key));
  return { mod, account, id };
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { mod, account, id } = await resolve(ctx);
    const body = (await request.json()) as { data?: Record<string, unknown>; status?: string; sortOrder?: number };
    const item = await updateItem(mod, id, body).catch((e: unknown) => {
      throw new HttpError(400, e instanceof Error ? e.message : "Invalid data");
    });
    await audit(account.email, `updated ${mod.label}`, String(item.data[mod.titleField ?? "title"] ?? id));
    revalidatePath("/", "layout");
    return Response.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { mod, account, id } = await resolve(ctx);
    await deleteItem(mod, id);
    await audit(account.email, `deleted ${mod.label}`, id);
    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

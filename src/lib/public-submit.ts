export async function submitPublic(
  kind: string,
  data: Record<string, unknown>
): Promise<{ stored: boolean; reference?: string; error?: string }> {
  try {
    const res = await fetch("/api/public/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, data }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      stored?: boolean;
      reference?: string;
      error?: string;
    };
    if (!res.ok) return { stored: false, error: body.error ?? "Could not submit." };
    return { stored: Boolean(body.stored), reference: body.reference };
  } catch {
    return { stored: false };
  }
}

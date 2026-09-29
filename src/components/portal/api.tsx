export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const escape = (value: unknown) => {
    const text = value === undefined || value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const STATUS_TONES: Record<string, string> = {
  published: "bg-sage-light text-sage",
  draft: "bg-gold-light text-navy",
  valid: "bg-sage-light text-sage",
  revoked: "bg-red-50 text-red-600",
  Success: "bg-sage-light text-sage",
  Pending: "bg-gold-light text-navy",
  Failed: "bg-red-50 text-red-600",
  Refunded: "bg-lotus-light text-lotus",
  Delivered: "bg-sage-light text-sage",
  Cancelled: "bg-red-50 text-red-600",
  Exception: "bg-red-50 text-red-600",
  Active: "bg-sage-light text-sage",
  Suspended: "bg-red-50 text-red-600",
  Open: "bg-gold-light text-navy",
  New: "bg-gold-light text-navy",
  Resolved: "bg-sage-light text-sage",
  Closed: "bg-warm-cream text-text-muted",
  Confirmed: "bg-sage-light text-sage",
  Approved: "bg-sage-light text-sage",
  Rejected: "bg-red-50 text-red-600",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${STATUS_TONES[status] ?? "bg-peacock-light text-peacock"}`}>
      {status}
    </span>
  );
}

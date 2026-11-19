/** Shipday sends orderStatus as an object: { orderState: "ALREADY_DELIVERED" }. */

export function shipdayOrderState(match: Record<string, unknown> | null | undefined): string {
  if (!match) return "";
  const raw = match.orderStatus ?? match.orderStatusAdmin ?? match.dOrderState ?? match.status;
  if (raw && typeof raw === "object") {
    const bag = raw as Record<string, unknown>;
    return String(bag.orderState ?? bag.status ?? bag.state ?? "").trim();
  }
  return String(raw ?? "").trim();
}

export function shipdayOrderRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (record.orderStatus || record.orderNumber || record.orderId || record.id) return record;
  return null;
}

/** Our order number is what GET /orders/{id} accepts. The numeric Shipday id returns an empty list. */
export function shipdayLookupIds(orderNumber: string, providerOrderId = "") {
  return [...new Set([orderNumber, providerOrderId].map((value) => value.trim()).filter(Boolean))];
}

export function shipdayActivity(match: Record<string, unknown>): { at: string; status: string; location: string }[] {
  const raw = match.activityLog ?? match.activityFeed ?? match.orderActivities;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const status = String(row.description ?? row.status ?? row.event ?? row.title ?? "").trim();
      if (!status) return null;
      return {
        at: String(row.time ?? row.createdAt ?? row.timestamp ?? ""),
        status,
        location: String(row.location ?? ""),
      };
    })
    .filter((entry): entry is { at: string; status: string; location: string } => Boolean(entry));
}

const KEY = "vgmf_delivery_check";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type DeliveryCheck = { pincode: string; deliverBy: string; dayLabel?: string; courierName?: string; at: number };

/** The product page's last pincode check, so the cart shows the same courier date. */
export function saveDeliveryCheck(check: Omit<DeliveryCheck, "at">) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify({ ...check, at: Date.now() }));
}

export function readDeliveryCheck(): DeliveryCheck | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "null") as DeliveryCheck | null;
    return parsed?.deliverBy && Date.now() - parsed.at < MAX_AGE_MS ? parsed : null;
  } catch {
    return null;
  }
}

export function deliveryCheckText(check: DeliveryCheck) {
  return `${check.dayLabel ? `${check.dayLabel}, ` : ""}${check.deliverBy}`;
}

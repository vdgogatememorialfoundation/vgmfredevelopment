type PickupLike = { line1?: string; line2?: string; pincode?: string };

/**
 * A pickup line that already holds the full address with its PIN is the address:
 * an older second line (area) and PIN left over in the other fields are dropped.
 */
export function normalizePickup<T extends PickupLike>(pickup: T): T {
  const pin = String(pickup?.line1 ?? "").match(/\b(\d{6})\b/)?.[1];
  if (!pin) return pickup;
  return { ...pickup, line2: "", pincode: pin };
}

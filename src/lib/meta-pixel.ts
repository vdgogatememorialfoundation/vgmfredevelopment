/** Meta Pixel events; content_ids are book ids, the same as retailer ids in the WhatsApp/Meta catalogue. */
type Fbq = (command: "track", event: string, params?: Record<string, unknown>) => void;

export function pixelEvent(event: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase", params: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq("track", event, { content_type: "product", currency: "INR", ...params });
  } catch {
    /* tracking must never break the page */
  }
}

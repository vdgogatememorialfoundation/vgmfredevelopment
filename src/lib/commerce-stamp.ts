export function orderActivityAt(order: { date?: string; history?: { at?: string }[] }) {
  let max = Date.parse(order.date || "") || 0;
  for (const item of order.history ?? []) {
    const at = Date.parse(item.at || "");
    if (at > max) max = at;
  }
  return max;
}

export function shipmentActivityAt(shipment: { generatedAt?: string; tracking?: { at?: string }[] }) {
  let max = Date.parse(shipment.generatedAt || "") || 0;
  let count = 0;
  for (const item of shipment.tracking ?? []) {
    count += 1;
    const at = Date.parse(item.at || "");
    if (at > max) max = at;
  }
  return max * 1000 + count;
}

export function phonesMatch(stored: string | undefined, given: string) {
  const have = (stored ?? "").replace(/\D/g, "");
  const want = given.replace(/\D/g, "");
  if (want.length < 4 || have.length < 4) return false;
  const a = have.slice(-10);
  const b = want.slice(-10);
  return a.endsWith(b) || b.endsWith(a);
}

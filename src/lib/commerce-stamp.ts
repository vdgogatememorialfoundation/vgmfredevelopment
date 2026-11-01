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

export type AccountRef = {
  email?: string;
  phone?: string;
  phones?: string[];
  id?: string;
  ids?: string[];
};

/** Same person on another phone: login email, account id, or the mobile on the order. */
export function orderBelongsTo(
  order: {
    userId?: string;
    createdBy?: string;
    accountEmail?: string;
    deliveryAddress?: { email?: string; phone?: string };
  },
  account: AccountRef
) {
  const email = (account.email ?? "").trim().toLowerCase();
  const ids = [account.id, ...(account.ids ?? [])].map((value) => (value ?? "").trim()).filter(Boolean);
  const phones = [account.phone, ...(account.phones ?? [])].map((value) => value ?? "").filter(Boolean);
  if (!email && ids.length === 0 && phones.length === 0) return false;
  const mail = (value?: string) => (value ?? "").trim().toLowerCase();
  const emails = [order.accountEmail, order.deliveryAddress?.email].map(mail).filter((value) => value.includes("@"));
  if (email && emails.includes(email)) return true;
  const userId = (order.userId ?? "").trim();
  if (userId && (ids.includes(userId) || (email && userId.toLowerCase() === email))) return true;
  return phones.some((phone) => phonesMatch(order.deliveryAddress?.phone, phone));
}

export type PostalPlace = {
  city: string;
  state: string;
  country: string;
  countryCode: string;
  pincode: string;
};

export async function fetchPostalPlace(postal: string, countryCode?: string) {
  const pin = postal.trim();
  if (pin.length < 3) return null;
  const query = new URLSearchParams({ postal: pin });
  if (countryCode) query.set("country", countryCode);
  const response = await fetch(`/api/geo/postal?${query}`, { headers: { accept: "application/json" } });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; place?: PostalPlace | null } | null;
  return data?.place ?? null;
}

export function postalLooksComplete(postal: string, countryCode?: string) {
  const value = postal.trim();
  if ((countryCode || "IN").toUpperCase() === "IN") return /^\d{6}$/.test(value);
  return value.length >= 4;
}

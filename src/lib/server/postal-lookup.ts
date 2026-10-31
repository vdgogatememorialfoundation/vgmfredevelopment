import { countryByCode, countryByName, isValidPostal } from "@/lib/geo";

export type PostalPlace = {
  city: string;
  state: string;
  country: string;
  countryCode: string;
  pincode: string;
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function place(partial: Partial<PostalPlace>, fallbackPin: string): PostalPlace | null {
  const country = countryByCode(partial.countryCode) || countryByName(partial.country);
  const city = clean(partial.city);
  const state = clean(partial.state);
  if (!city && !state) return null;
  return {
    city,
    state,
    country: clean(partial.country) || country.name,
    countryCode: country.code,
    pincode: clean(partial.pincode) || fallbackPin,
  };
}

async function lookupIndia(pin: string): Promise<PostalPlace | null> {
  const response = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const rows = (await response.json().catch(() => null)) as Array<{
    Status?: string;
    PostOffice?: Array<{ Name?: string; District?: string; Block?: string; State?: string; Country?: string; Pincode?: string }>;
  }> | null;
  const office = rows?.[0]?.PostOffice?.[0];
  if (!office) return null;
  return place(
    {
      city: office.District || office.Block || office.Name,
      state: office.State,
      country: office.Country || "India",
      countryCode: "IN",
      pincode: office.Pincode || pin,
    },
    pin
  );
}

async function lookupZippopotam(countryCode: string, postal: string): Promise<PostalPlace | null> {
  const response = await fetch(
    `https://api.zippopotam.us/${encodeURIComponent(countryCode.toLowerCase())}/${encodeURIComponent(postal)}`,
    { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) }
  ).catch(() => null);
  if (!response?.ok) return null;
  const data = (await response.json().catch(() => null)) as {
    country?: string;
    "country abbreviation"?: string;
    places?: Array<{ "place name"?: string; state?: string; "state abbreviation"?: string }>;
  } | null;
  const found = data?.places?.[0];
  if (!found) return null;
  return place(
    {
      city: found["place name"],
      state: found.state || found["state abbreviation"],
      country: data?.country,
      countryCode: data?.["country abbreviation"] || countryCode,
      pincode: postal,
    },
    postal
  );
}

async function lookupNominatim(postal: string, countryCode?: string): Promise<PostalPlace | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("postalcode", postal);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  if (countryCode) url.searchParams.set("countrycodes", countryCode.toLowerCase());
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "VaidyaGogateMemorialFoundation/1.0 (postal lookup)",
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const rows = (await response.json().catch(() => null)) as Array<{
    address?: {
      city?: string;
      town?: string;
      village?: string;
      county?: string;
      state?: string;
      country?: string;
      country_code?: string;
      postcode?: string;
    };
  }> | null;
  const address = rows?.[0]?.address;
  if (!address) return null;
  return place(
    {
      city: address.city || address.town || address.village || address.county,
      state: address.state,
      country: address.country,
      countryCode: address.country_code,
      pincode: address.postcode || postal,
    },
    postal
  );
}

export async function lookupPostal(input: { postal: string; countryCode?: string }): Promise<PostalPlace | null> {
  const postal = clean(input.postal);
  const countryCode = clean(input.countryCode).toUpperCase();
  if (!postal || postal.length < 3) return null;
  if (countryCode && !isValidPostal(countryCode, postal) && countryCode !== "IN") {
    /* still try — some regions accept shorter codes */
  }

  if (/^\d{6}$/.test(postal) && (!countryCode || countryCode === "IN")) {
    const india = await lookupIndia(postal);
    if (india) return india;
  }
  if (countryCode) {
    const zippo = await lookupZippopotam(countryCode, postal);
    if (zippo) return zippo;
    const named = await lookupNominatim(postal, countryCode);
    if (named) return named;
  }
  if (/^\d{6}$/.test(postal)) {
    const india = await lookupIndia(postal);
    if (india) return india;
  }
  return lookupNominatim(postal, countryCode || undefined);
}

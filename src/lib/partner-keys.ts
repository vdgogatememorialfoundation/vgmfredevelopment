export const partnerSites = [
  {
    id: "seminar",
    name: "Seminar site",
    origin: "https://seminar.vaidyagogate.org",
    envKey: "SEMINAR_CERT_API_KEY",
    apiKey: "vgmf_live_seminar_7f3a9c2e",
  },
  {
    id: "autism",
    name: "Autism site",
    origin: "https://autism.vaidyagogate.org",
    envKey: "AUTISM_CERT_API_KEY",
    apiKey: "vgmf_live_autism_4b8d1e6a",
  },
] as const;

export type PartnerSite = (typeof partnerSites)[number];

export function partnerApiKey(site: PartnerSite) {
  const fromEnv = process.env[site.envKey]?.trim();
  return fromEnv || site.apiKey;
}

export function livePartnerSites() {
  return partnerSites.map((site) => ({ ...site, apiKey: partnerApiKey(site) }));
}

export function partnerForKey(apiKey: string) {
  const key = apiKey.trim();
  if (!key) return undefined;
  return livePartnerSites().find((site) => site.apiKey === key);
}

export function partnerForOrigin(origin: string | null) {
  if (!origin) return undefined;
  return livePartnerSites().find((site) => site.origin === origin);
}

export function readApiKey(request: { headers: Headers; nextUrl: URL }) {
  return (
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("key") ??
    ""
  );
}

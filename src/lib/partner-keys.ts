export const partnerSites = [
  {
    id: "seminar",
    name: "Seminar site",
    origin: "https://seminar.vaidyagogate.org",
    apiKey: "vgmf_live_seminar_7f3a9c2e",
  },
  {
    id: "autism",
    name: "Autism site",
    origin: "https://autism.vaidyagogate.org",
    apiKey: "vgmf_live_autism_4b8d1e6a",
  },
] as const;

export function partnerForKey(apiKey: string) {
  return partnerSites.find((site) => site.apiKey === apiKey.trim());
}

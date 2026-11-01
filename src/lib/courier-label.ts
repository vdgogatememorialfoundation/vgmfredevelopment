/** Customer-facing courier names. Tookan and Shipday are the Foundation fleet. */

export const GOGATE_COURIER = "Gogate Products";

const OWN_FLEET = new Set(["tookan", "tookan-parcel", "shipday"]);

const AGGREGATOR_NAMES: Record<string, string> = {
  shiprocket: "Shiprocket",
  nimbuspost: "Nimbuspost",
  ithink: "iThink Logistics",
  shipyaari: "Shipyaari",
};

const AGGREGATOR_ONLY = /^(shiprocket|nimbuspost|ithink logistics|ithink|shipyaari)(\s+(surface|air|express|courier|driver))?$/i;

export function isOwnFleet(provider?: string) {
  return OWN_FLEET.has((provider ?? "").toLowerCase());
}

export function aggregatorName(provider?: string) {
  return AGGREGATOR_NAMES[(provider ?? "").toLowerCase()] ?? "";
}

/** Gogate Products for our fleet. Ekart (or whoever the aggregator assigned) otherwise. */
export function customerCourierLabel(input: { provider?: string; courier?: string }) {
  const provider = (input.provider ?? "").toLowerCase();
  const raw = (input.courier ?? "").trim();
  if (isOwnFleet(provider) || /tookan|shipday/i.test(raw)) return GOGATE_COURIER;
  if (raw && !AGGREGATOR_ONLY.test(raw)) return raw;
  return aggregatorName(provider) || raw || "Courier";
}

export function customerStatusLabel(status: string, provider?: string) {
  const clean = status.trim();
  if (!clean) return "";
  if (!isOwnFleet(provider)) return clean;
  const table: Record<string, string> = {
    unassigned: "Finding a rider",
    assigned: "Rider assigned",
    accepted: "Rider accepted",
    started: "On the way",
    "in progress": "On the way",
    successful: "Delivered",
    declined: "Rider declined",
    cancelled: "Cancelled",
    failed: "Delivery failed",
    "not found": "Waiting for the courier",
  };
  return table[clean.toLowerCase()] ?? clean;
}

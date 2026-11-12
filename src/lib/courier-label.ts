/** Customer-facing courier names. Tookan and Shipday are the Foundation fleet. */

export const GOGATE_COURIER = "Gogate Products";

const OWN_FLEET = new Set(["tookan", "tookan-parcel", "shipday"]);

const AGGREGATOR_NAMES: Record<string, string> = {
  shiprocket: "Shiprocket",
  nimbuspost: "Nimbuspost",
  ithink: "iThink Logistics",
  shipyaari: "Shipyaari",
  goswift: "GoSwift",
};

const AGGREGATOR_ONLY = /^(shiprocket|nimbuspost|ithink logistics|ithink|shipyaari|goswift|swift)(\s+(surface|air|express|courier|driver))?$/i;

export function isOwnFleet(provider?: string) {
  return OWN_FLEET.has((provider ?? "").toLowerCase());
}

export function aggregatorName(provider?: string) {
  return AGGREGATOR_NAMES[(provider ?? "").toLowerCase()] ?? "";
}

/** The in-house name plus the desk that is carrying the order. */
export function fleetCourierLabel(provider?: string) {
  const id = (provider ?? "").toLowerCase();
  if (id === "tookan" || id === "tookan-parcel") return "Gogate Products-Tookan";
  if (id === "shipday") return "Gogate Products-Shipday";
  return "";
}

/** Gogate Products-Tookan or Gogate Products-Shipday for our fleet. Ekart (or whoever the aggregator assigned) otherwise. */
export function customerCourierLabel(input: { provider?: string; courier?: string }) {
  const provider = (input.provider ?? "").toLowerCase();
  const raw = (input.courier ?? "").trim();
  const fleet = fleetCourierLabel(provider);
  if (fleet) return fleet;
  if (/tookan/i.test(raw)) return "Gogate Products-Tookan";
  if (/shipday/i.test(raw)) return "Gogate Products-Shipday";
  if (raw && !AGGREGATOR_ONLY.test(raw)) return raw;
  return aggregatorName(provider) || raw || "Courier";
}

/** A rider is on this order only after they accept. Unassigned stays hidden. */
export function riderAccepted(status: string, agentName?: string) {
  const text = status.trim().toLowerCase();
  if (/unassigned|finding a rider|declined|cancelled|waiting for the courier|not found/.test(text)) return false;
  if (agentName?.trim()) return true;
  return /accept|assigned|started|in progress|picked|out for|on the way|going to/.test(text);
}

export function customerStatusLabel(status: string, provider?: string) {
  const clean = status.trim();
  if (!clean) return "";
  if (!isOwnFleet(provider)) return clean;
  const table: Record<string, string> = {
    unassigned: "",
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

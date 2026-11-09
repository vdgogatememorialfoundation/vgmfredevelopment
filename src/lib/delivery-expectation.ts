const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Courier portals store the promise as an India-time phrase such as "Mon, 2 Nov, 6:02 am". */
export function parseExpected(text: string | undefined, around: number): number | null {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return null;
  const clock = trimmed.match(/(\d{1,2})\s+([A-Za-z]{3,})(?:\s+(\d{4}))?[\s,]+(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (clock) {
    const day = Number(clock[1]);
    const month = MONTHS.findIndex((name) => clock[2].toLowerCase().startsWith(name));
    let year = clock[3] ? Number(clock[3]) : new Date(around).getFullYear();
    let hour = Number(clock[4]);
    const minute = Number(clock[5]);
    const meridiem = (clock[6] || "").toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (month >= 0 && day >= 1 && day <= 31) {
      let ms = Date.UTC(year, month, day, hour, minute) - 5.5 * 60 * 60 * 1000;
      if (!clock[3] && ms < around - 36 * 60 * 60 * 1000) {
        year += 1;
        ms = Date.UTC(year, month, day, hour, minute) - 5.5 * 60 * 60 * 1000;
      }
      if (Number.isFinite(ms)) return ms;
    }
  }
  const dayOnly = trimmed.match(/(\d{1,2})\s+([A-Za-z]{3,})(?:\s+(\d{4}))?/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    const month = MONTHS.findIndex((name) => dayOnly[2].toLowerCase().startsWith(name));
    const year = dayOnly[3] ? Number(dayOnly[3]) : new Date(around).getFullYear();
    if (month >= 0 && day >= 1 && day <= 31) {
      const ms = Date.UTC(year, month, day, 12, 0) - 5.5 * 60 * 60 * 1000;
      if (Number.isFinite(ms)) return ms;
    }
  }
  const direct = Date.parse(trimmed);
  if (Number.isFinite(direct) && direct > around - 36 * 60 * 60 * 1000) return direct;
  return null;
}

/** India uses IST. Any other delivery country uses UTC. */
export function clockZone(country?: string) {
  const value = (country ?? "").trim().toLowerCase();
  if (value && !/^(in|ind|india)$/.test(value)) return "UTC";
  return "Asia/Kolkata";
}

export function zoneSuffix(zone: string) {
  return zone === "UTC" ? "UTC" : "IST";
}

/** Weekday, date and clock in India. */
export function formatIndiaClock(ms: number) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

/**
 * Tookan `job_time_utc` is real UTC.
 * `job_delivery_datetime` is the India wall clock with a misleading Z, so 00:32 must stay 12:32 am, not become 6:02 am.
 */
export function tookanDeliveryInstant(utc?: string, wall?: string): number | null {
  const utcText = utc?.trim() ?? "";
  if (utcText && !utcText.startsWith("0000")) {
    const parsed = Date.parse(utcText);
    if (Number.isFinite(parsed)) return parsed;
  }
  const wallText = wall?.trim() ?? "";
  if (!wallText || wallText.startsWith("0000")) return null;
  const bare = wallText.replace(/\.\d+Z$/i, "").replace(/Z$/i, "").replace("T", " ");
  const clock = bare.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!clock) {
    const parsed = Date.parse(wallText);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return Date.UTC(Number(clock[1]), Number(clock[2]) - 1, Number(clock[3]), Number(clock[4]), Number(clock[5])) - 5.5 * 60 * 60 * 1000;
}

/** Address line that matches the courier task: do not insert the state when the line already contains the pincode. */
export function customerAddressLine(address?: {
  line1?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
}) {
  if (!address) return "";
  const line1 = address.line1?.trim() ?? "";
  const city = address.city?.trim() ?? "";
  const pin = address.pincode?.trim() ?? "";
  const tail = [city, pin].filter(Boolean).join(" ");
  if (line1 && tail && line1.toLowerCase().includes(tail.toLowerCase())) return line1;
  if (line1 && pin && line1.includes(pin)) return `${line1}, ${tail}`;
  return [line1, address.landmark, city, address.state, pin].filter(Boolean).join(", ");
}

/** Weekday, date and time. India addresses use IST. Other countries use UTC. */
export function statusStamp(at?: string, country?: string) {
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const zone = clockZone(country);
  const text = new Intl.DateTimeFormat("en-IN", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return zone === "UTC" ? `${text} UTC` : text;
}

/** Weekday and date only, for delivery steps. Customers see the day, not the clock. */
export function statusDay(at?: string, country?: string) {
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return deliveryDatePhrase(at);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: clockZone(country),
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function istDay(ms: number, zone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${bag.year}-${bag.month}-${bag.day}`;
}

/** Drop the clock from a courier promise. Customers see the date, not 12:32 am. */
export function deliveryDatePhrase(text?: string) {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) && Number.isFinite(Date.parse(trimmed))) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(trimmed));
  }
  return trimmed
    .replace(/,?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?/gi, "")
    .replace(/\s+(?:IST|UTC)\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** My Orders preview: expected date, tomorrow, today, or early. The clock time stays hidden. */
export function deliveryExpectation(status: string, expectedText?: string, now = Date.now(), country?: string) {
  if (status === "Delivered") return "Your order is delivered";
  if (status === "Cancelled") return "This order was cancelled";
  if (status === "Failed") return "Delivery failed";
  const expected = parseExpected(expectedText, now - 36 * 60 * 60 * 1000);
  if (!expected) {
    if (status === "Out for Delivery") return "Out for delivery";
    if (status === "Shipped") return "Your order has been shipped";
    if (status === "Packed" || status === "Ready to Ship") return "Your order is packed";
    return "Your order is placed";
  }
  const zone = clockZone(country);
  const today = istDay(now, zone);
  const due = istDay(expected, zone);
  const tomorrow = istDay(now + 24 * 60 * 60 * 1000, zone);
  if (status === "Out for Delivery" && due > today) return "Arriving early";
  if (due === today) return "Arriving today";
  if (due === tomorrow) return "Arriving tomorrow";
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(expected));
  return `Delivery expected by ${dateLabel}`;
}

/** The courier's own promised date once it has one, otherwise the date promised at checkout. */
export function agreedDelivery(eta: string | undefined, courier: string | undefined, around: number) {
  const promised = eta?.replace(/^(today|tomorrow),\s*/i, "").trim() || "";
  return parseExpected(courier, around) != null ? courier || promised : promised;
}

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

/** Weekday, date and time in India, under each tracking update. */
export function statusStamp(at?: string) {
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function istDay(ms: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${bag.year}-${bag.month}-${bag.day}`;
}

function clockLabel(ms: number) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

/** My Orders preview: expected date, tomorrow, today, or early. */
export function deliveryExpectation(status: string, expectedText?: string, now = Date.now()) {
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
  const today = istDay(now);
  const due = istDay(expected);
  const tomorrow = istDay(now + 24 * 60 * 60 * 1000);
  if (status === "Out for Delivery" && due > today) return "Arriving early";
  const timed = /\d:\d{2}/.test(expectedText ?? "");
  const by = timed ? clockLabel(expected) : "10:00 pm";
  if (due === today) return timed ? `Arriving today by ${by}` : "Arriving today";
  if (due === tomorrow) return `Arriving tomorrow by ${by}`;
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(expected));
  return `Delivery expected by ${dateLabel}`;
}

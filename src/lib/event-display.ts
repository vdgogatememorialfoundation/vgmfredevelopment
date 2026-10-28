import type { Event } from "@/types";
import { formatCurrency, formatDateRange } from "@/lib/utils";

export const TBA = "To be announced";

export function datesTbd(event: Event) {
  return Boolean(event.tbd?.dates) || !event.startDate;
}

export function eventDateText(event: Event) {
  if (datesTbd(event)) return event.startDate ? `${TBA} (tentatively ${formatDateRange(event.startDate, event.endDate || event.startDate)})` : `Dates ${TBA.toLowerCase()}`;
  return formatDateRange(event.startDate, event.endDate || event.startDate);
}

export function eventTimeText(event: Event) {
  if (event.tbd?.time) return `Timings ${TBA.toLowerCase()}`;
  return event.timeText ?? "";
}

export function eventPlaceText(event: Event) {
  if (event.mode === "Online") return "Online";
  const venue = event.tbd?.venue ? `Venue ${TBA.toLowerCase()}` : event.venue;
  const city = event.tbd?.city ? (event.tbd?.venue ? "" : `City ${TBA.toLowerCase()}`) : event.city;
  const parts = [venue, city].filter(Boolean);
  if (!parts.length) return `Venue ${TBA.toLowerCase()}`;
  return parts.join(", ");
}

export function eventFeeText(event: Event) {
  if (event.tbd?.fee) return TBA;
  return event.fee > 0 ? formatCurrency(event.fee, event.currency) : "Free";
}

export function compareEventDates(a: Event, b: Event) {
  const aTbd = datesTbd(a);
  const bTbd = datesTbd(b);
  if (aTbd !== bTbd) return aTbd ? 1 : -1;
  return (a.startDate || "").localeCompare(b.startDate || "");
}

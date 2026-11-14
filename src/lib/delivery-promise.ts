import type { CourierRate } from "@/types";
import { getOrderSettings, isStoreWorkingDay } from "@/lib/integrations";

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;
const istDayIndex = (ms: number) => Math.floor((ms + IST_MS) / DAY_MS);

export function isExpressCourier(rate: CourierRate) {
  return Boolean(rate.lastMile) || rate.etaDays <= 1 || /express|air|instant|same.?day|flash|priority|hyperlocal/i.test(rate.courierName);
}

/**
 * Delivery day from the desk's packing time and dispatch cut-off.
 * Same-pincode orders read Today / Tomorrow; other routes never promise earlier than dispatch + transit.
 */
export function promiseFor(rate: CourierRate, courierAt: number, samePincode: boolean, processingHours: number, cutoff: string, now = Date.now()) {
  const [hour, minute] = cutoff.split(":").map(Number);
  const ready = now + processingHours * 60 * 60 * 1000;
  let dispatchDay = istDayIndex(ready);
  const readyMinutes = Math.floor(((ready + IST_MS) % DAY_MS) / 60000);
  if (readyMinutes > (hour || 0) * 60 + (minute || 0)) dispatchDay += 1;
  // The store does not pack or hand over on its weekly offs and holidays.
  const calendar = getOrderSettings();
  // Couriers do not pick up on Sundays either, so a Sunday hand-over moves to the next working day.
  const sunday = (dayIndex: number) => new Date(dayIndex * DAY_MS).getUTCDay() === 0;
  for (let guard = 0; guard < 60 && (!isStoreWorkingDay(dispatchDay * DAY_MS + 12 * 60 * 60 * 1000 - IST_MS, calendar) || (!rate.lastMile && sunday(dispatchDay))); guard += 1) dispatchDay += 1;
  const transit = samePincode ? (rate.lastMile || rate.etaDays === 0 ? 0 : 1) : Math.max(1, rate.etaDays);
  let day = dispatchDay;
  // Courier transit days are counted on courier working days (no Sunday deliveries); hyperlocal runs every day.
  for (let left = transit; left > 0; ) {
    day += 1;
    if (rate.lastMile || !sunday(day)) left -= 1;
  }
  if (!rate.lastMile) while (sunday(day)) day += 1;
  if (!samePincode && Number.isFinite(courierAt)) day = Math.max(day, istDayIndex(courierAt));
  const today = istDayIndex(now);
  const at = day * DAY_MS + 12 * 60 * 60 * 1000 - IST_MS;
  return {
    deliverBy: new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }),
    dayLabel: day === today ? "Today" : day === today + 1 ? "Tomorrow" : undefined,
  };
}


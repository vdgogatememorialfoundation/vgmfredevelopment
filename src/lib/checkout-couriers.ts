import type { CourierRate } from "@/types";
import type { OrderSettings } from "@/lib/integrations";

type CourierShowSettings = Pick<
  OrderSettings,
  "hideTookanAtCheckout" | "hideShipdayAtCheckout" | "hiddenCouriers" | "courierMarkup"
>;

function hiddenBy(rate: CourierRate, settings: CourierShowSettings) {
  const id = `${rate.provider} ${rate.courierName}`.toLowerCase();
  if (settings.hideTookanAtCheckout && id.includes("tookan")) return true;
  if (settings.hideShipdayAtCheckout && id.includes("shipday")) return true;
  return (settings.hiddenCouriers ?? []).some((name) => {
    const word = name.trim().toLowerCase();
    return word.length > 1 && id.includes(word);
  });
}

/** Rate shown to the customer: the courier's charge plus the admin's buffer, never below the minimum. */
export function displayedCourierRate(rate: number, markup: OrderSettings["courierMarkup"] | undefined) {
  if (!markup) return rate;
  const raised = rate + (rate * Math.max(0, markup.percent || 0)) / 100 + Math.max(0, markup.rupees || 0);
  return Math.ceil(Math.max(raised, Math.max(0, markup.minimum || 0)));
}

function isLocal(rate: CourierRate) {
  return rate.provider === "tookan" || rate.provider === "tookan-parcel" || rate.provider === "shipday" || rate.provider === "local";
}

/** Highest courier charge among the (non-local) rates, so any courier can be booked if the cheaper one doesn't pick up. */
export function highestCourierRate(rates: CourierRate[]) {
  return rates.filter((rate) => !isLocal(rate) && !rate.estimate && rate.rate > 0).reduce((max, rate) => Math.max(max, rate.rate), 0);
}

/** Couriers the site shows customers, with the buffered charge (or the highest charge for every courier when that is switched on). The courier's real charge stays in providerRate. */
export function customerCourierRates(rates: CourierRate[], settings: CourierShowSettings): CourierRate[] {
  const shown = rates
    .filter((rate) => !hiddenBy(rate, settings))
    .map((rate) => {
      const actual = rate.providerRate ?? rate.rate;
      return { ...rate, providerRate: actual, rate: isLocal(rate) ? actual : displayedCourierRate(actual, settings.courierMarkup) };
    });
  if (!settings.courierMarkup?.chargeHighest) return shown;
  const highest = highestCourierRate(shown);
  const cap = settings.courierMarkup?.maxCharge ?? 0;
  const charged = cap > 0 && highest > cap ? cap : highest;
  return charged > 0 ? shown.map((rate) => (isLocal(rate) ? rate : { ...rate, rate: charged })) : shown;
}

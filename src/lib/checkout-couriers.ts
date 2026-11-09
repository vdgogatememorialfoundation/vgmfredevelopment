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

/** Couriers the site shows customers, with the buffered charge. The courier's real charge stays in providerRate. */
export function customerCourierRates(rates: CourierRate[], settings: CourierShowSettings): CourierRate[] {
  return rates
    .filter((rate) => !hiddenBy(rate, settings))
    .map((rate) => {
      const actual = rate.providerRate ?? rate.rate;
      const local = rate.provider === "tookan" || rate.provider === "tookan-parcel" || rate.provider === "shipday" || rate.provider === "local";
      return { ...rate, providerRate: actual, rate: local ? actual : displayedCourierRate(actual, settings.courierMarkup) };
    });
}

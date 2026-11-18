import { savedAdminIntegrations } from "@/lib/server/admin-integrations";
import { NextRequest, NextResponse } from "next/server";
import {
  ekartBook,
  ekartCancel,
  ekartNdr,
  ekartRates,
  ekartTest,
  ekartTrack,
  goswiftBook,
  goswiftCancel,
  goswiftNdr,
  goswiftRates,
  goswiftRegisterWebhook,
  goswiftTest,
  daaklyBook,
  daaklyCancel,
  daaklyLabel,
  daaklyRates,
  daaklyTrack,
  enviaBook,
  enviaCancel,
  enviaRates,
  enviaTrack,
  shadowfaxBook,
  shadowfaxCancel,
  shadowfaxNdr,
  shadowfaxRates,
  shadowfaxReturnPickup,
  shadowfaxTest,
  shadowfaxTrack,
  goswiftTrack,
  ithinkBook,
  ithinkCancel,
  ithinkInvoice,
  ithinkLabel,
  ithinkManifest,
  ithinkRates,
  ithinkTrack,
  ithinkWallet,
  nimbusBook,
  nimbusCancel,
  nimbusLabel,
  nimbusRates,
  nimbusTrack,
  nimbusWallet,
  shipdayBook,
  shipdayCancel,
  shipdayReschedule,
  shipdayTest,
  shipdayTrack,
  shiprocketAddPickup,
  shiprocketBook,
  shiprocketCancel,
  shiprocketInvoice,
  shiprocketLabel,
  shiprocketLabelSheet,
  shiprocketManifest,
  shiprocketPickup,
  shiprocketPickupLocations, ekartAddresses, goswiftAddresses,
  shiprocketRates,
  shiprocketReturn,
  shiprocketTrack,
  shiprocketWallet,
  shipyaariBook,
  shipyaariCancel,
  shipyaariLabel,
  shipyaariRates,
  shipyaariTest,
  shipyaariTrack,
  shipyaariWallet,
  tookanBookMode,
  tookanCancel,
  tookanReschedule,
  tookanTest,
  tookanTrack,
  type RateOut,
} from "@/lib/server/providers";
import { courierWebTrack, type TrackerCreds } from "@/lib/server/courier-web-track";
import { mergeShippingCreds, readShippingCreds } from "@/lib/server/shipping-vault";
import { listWebhooks } from "@/lib/server/webhooks";
import { withScanPlaces } from "@/lib/server/place-lookup";

type Body = Record<string, unknown> & {
  action?: string;
  provider?: string;
  creds?: Record<string, Record<string, unknown>>;
};

const unsupported = (provider: string) =>
  NextResponse.json({
    ok: false,
    configured: false,
    error: `${provider} does not support this action.`,
  });

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const creds = body.creds ?? {};
  if (Object.keys(creds).length) mergeShippingCreds(creds);
  const provider = String(body.provider ?? "");
  const own = creds[provider] ?? creds[provider.replace("-parcel", "")] ?? {};
  // Ekart keys are saved on this host; the desk browser may not hold them.
  const ekartKeys = { ...((readShippingCreds().ekart as Record<string, unknown>) ?? {}), ...Object.fromEntries(Object.entries(creds.ekart ?? {}).filter(([, value]) => value !== "" && value != null)) };

  try {
    switch (body.action) {
      case "rates": {
        const parcel = body.parcel as Parameters<typeof shiprocketRates>[1];
        const saved = savedAdminIntegrations() as { settings?: { shipping?: Record<string, { enabled?: boolean } | undefined> } };
        const switchedOn = (id: string) => saved.settings?.shipping?.[id]?.enabled !== false;
        const wanted = (Array.isArray(body.providers)
          ? (body.providers as string[])
          : ["shiprocket", "nimbuspost", "ithink", "shipyaari", "goswift", "ekart", "shadowfax", "envia", "daakly"]
        ).filter(switchedOn);
        // Customers' browsers never hold courier keys: fall back to the keys the admin saved on this host.
        const stored = readShippingCreds() as typeof creds;
        const keys = (id: keyof typeof creds) => ({ ...(stored[id] ?? {}), ...Object.fromEntries(Object.entries(creds[id] ?? {}).filter(([, value]) => value !== "" && value != null)) });
        const jobs: Promise<{ provider: string; rates: RateOut[] | null; error?: string }>[] = wanted.map(async (id) => {
          try {
            if (id === "shiprocket") return { provider: id, rates: await shiprocketRates(keys("shiprocket"), parcel) };
            if (id === "nimbuspost") return { provider: id, rates: await nimbusRates(keys("nimbuspost"), parcel) };
            if (id === "ithink") return { provider: id, rates: await ithinkRates(keys("ithink"), parcel) };
            if (id === "shipyaari") return { provider: id, rates: await shipyaariRates(keys("shipyaari"), parcel) };
            if (id === "goswift") return { provider: id, rates: await goswiftRates(keys("goswift"), parcel) };
            if (id === "ekart") return { provider: id, rates: await ekartRates(keys("ekart"), parcel) };
            if (id === "shadowfax") return { provider: id, rates: await shadowfaxRates(keys("shadowfax"), parcel) };
            if (id === "envia") return { provider: id, rates: await enviaRates(keys("envia"), parcel) };
            if (id === "daakly") return { provider: id, rates: await daaklyRates(keys("daakly"), parcel) };
            return { provider: id, rates: null };
          } catch (error) {
            return { provider: id, rates: [], error: (error as Error).message };
          }
        });
        const results = await Promise.all(jobs);
        return NextResponse.json({
          ok: true,
          providers: results.map((result) => ({ provider: result.provider, configured: result.rates !== null, error: result.error })),
          rates: results.flatMap((result) => (result.rates ?? []).map((rate) => withWeights(rate, parcel, stored as Record<string, unknown>))).sort((a, b) => a.rate - b.rate),
        });
      }
      case "book": {
        const order = body.order as Parameters<typeof shiprocketBook>[1];
        const booked =
          provider === "shiprocket"
            ? await shiprocketBook(own, order)
            : provider === "nimbuspost"
              ? await nimbusBook(own, order)
              : provider === "ithink"
                ? await ithinkBook(creds.ithink ?? own, order)
                : provider === "tookan"
                  ? await tookanBookMode(creds.tookan ?? own, order, "hyperlocal")
                  : provider === "tookan-parcel"
                    ? await tookanBookMode(creds.tookan ?? own, order, "parcel")
                    : provider === "shipday"
                      ? await shipdayBook(own, order)
                      : provider === "shipyaari"
                        ? await shipyaariBook(creds.shipyaari ?? own, order)
                        : provider === "goswift"
                          ? await goswiftBook(creds.goswift ?? own, order)
                          : provider === "ekart"
                            ? await ekartBook(ekartKeys, order)
                            : provider === "shadowfax"
                              ? await shadowfaxBook(creds.shadowfax ?? own, order)
                              : provider === "envia"
                                ? await enviaBook(creds.envia ?? own, order)
                                : provider === "daakly"
                                  ? await daaklyBook(creds.daakly ?? own, order)
                                  : undefined;
        if (booked === undefined) return unsupported(provider);
        if (booked === null) return NextResponse.json({ ok: false, configured: false, error: `${provider} credentials are not configured.` });
        if (provider === "shiprocket" && booked.providerShipmentId && body.schedulePickup) {
          try {
            Object.assign(booked, await shiprocketPickup(own, booked.providerShipmentId, body.pickupDate ? String(body.pickupDate) : undefined));
          } catch {
            booked.pickupScheduledFor = "";
          }
          try {
            Object.assign(booked, await shiprocketLabel(own, booked.providerShipmentId));
          } catch {
            /* label can be generated later */
          }
          if (booked.providerOrderId) {
            try {
              Object.assign(booked, await shiprocketInvoice(own, booked.providerOrderId));
            } catch {
              /* invoice can be generated later */
            }
          }
        }
        return NextResponse.json({ ok: true, configured: true, ...booked });
      }
      case "return": {
        const order = body.order as Parameters<typeof shiprocketReturn>[1];
        const booked =
          provider === "shiprocket"
            ? await shiprocketReturn(own, order)
            : provider === "ithink"
              ? await ithinkBook(creds.ithink ?? own, { ...order, courierId: order.courierId })
              : undefined;
        if (booked === undefined) return unsupported(provider);
        if (booked === null) return NextResponse.json({ ok: false, configured: false, error: `${provider} credentials are not configured.` });
        return NextResponse.json({ ok: true, configured: true, ...booked });
      }
      case "pickup": {
        if (provider !== "shiprocket") return unsupported(provider);
        const result = await shiprocketPickup(own, String(body.shipmentId), body.pickupDate ? String(body.pickupDate) : undefined);
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shiprocket credentials are not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "label": {
        if (provider === "daakly") {
          const result = await daaklyLabel(creds.daakly ?? own, String(body.providerShipmentId ?? body.awb ?? ""));
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "Daakly API key is not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider === "ithink") {
          const result = await ithinkLabel(creds.ithink ?? own, String(body.awb ?? ""));
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "iThink Logistics credentials are not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider === "nimbuspost") {
          const result = await nimbusLabel(own, String(body.awb ?? ""));
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "Nimbuspost credentials are not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider === "shipyaari") {
          const result = await shipyaariLabel(creds.shipyaari ?? own, String(body.awb ?? ""));
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shipyaari credentials are not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider === "goswift" || provider === "ekart" || provider === "shadowfax") {
          const awb = String(body.awb ?? "");
          return NextResponse.json({ ok: true, configured: true, awb, labelUrl: `/api/shipping/${provider}/label?awb=${encodeURIComponent(awb)}` });
        }
        if (provider !== "shiprocket") return unsupported(provider);
        const result = await shiprocketLabelSheet(own, String(body.shipmentId ?? ""), String(body.awb ?? ""), String(body.providerOrderId ?? ""));
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shiprocket credentials are not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "reschedule": {
        const deliveryAt = String(body.deliveryAt ?? "");
        const result =
          provider === "tookan" || provider === "tookan-parcel"
            ? await tookanReschedule(creds.tookan ?? own, String(body.jobId ?? ""), String(body.extraId ?? ""), deliveryAt)
            : provider === "shipday"
              ? await shipdayReschedule(own, String(body.jobId ?? body.providerOrderId ?? ""), deliveryAt)
              : undefined;
        if (result === undefined) return unsupported(provider);
        if (result === null) return NextResponse.json({ ok: false, configured: false, error: `${provider} credentials are not configured.` });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "track": {
        const awb = String(body.awb ?? body.providerOrderId ?? "");
        if (provider === "courier-site") {
          const site = await courierWebTrack(String(body.courier ?? ""), awb, (creds.tracker ?? {}) as TrackerCreds);
          if (!site) return NextResponse.json({ ok: false, configured: true, error: "The courier has no scans for this tracking id yet." });
          return NextResponse.json({ ok: true, configured: true, ...site });
        }
        const result =
          provider === "shiprocket"
            ? await shiprocketTrack(own, awb)
            : provider === "nimbuspost"
              ? await nimbusTrack(own, awb)
              : provider === "ithink"
                ? await ithinkTrack(creds.ithink ?? own, awb)
                : provider === "tookan" || provider === "tookan-parcel"
                  ? await tookanTrack(creds.tookan ?? own, String(body.providerOrderId || awb), String(body.providerShipmentId || awb))
                  : provider === "shipday"
                    ? await shipdayTrack(own, String(body.orderNumber ?? body.orderId ?? ""), String(body.providerOrderId ?? awb))
                    : provider === "shipyaari"
                      ? await shipyaariTrack(creds.shipyaari ?? own, awb)
                      : provider === "goswift"
                        ? await goswiftTrack(creds.goswift ?? own, awb)
                        : provider === "ekart"
                          ? await ekartTrack(ekartKeys, awb)
                          : provider === "shadowfax"
                            ? await shadowfaxTrack(creds.shadowfax ?? own, awb, body.providerShipmentId === "reverse")
                            : provider === "envia"
                              ? await enviaTrack(creds.envia ?? own, awb)
                              : provider === "daakly"
                                ? await daaklyTrack(creds.daakly ?? own, awb)
                                : undefined;
        if (result === undefined) return unsupported(provider);
        if (result === null) return NextResponse.json({ ok: false, configured: false, error: `${provider} credentials are not configured.` });
        const events = "events" in result && Array.isArray(result.events) ? await withScanPlaces(result.events as { location?: string }[]) : undefined;
        return NextResponse.json({ ok: true, configured: true, ...result, ...(events ? { events } : {}) });
      }
      case "cancel": {
        const result =
          provider === "shiprocket"
            ? await shiprocketCancel(own, String(body.providerOrderId ?? ""))
            : provider === "nimbuspost"
              ? await nimbusCancel(own, String(body.awb ?? ""))
              : provider === "ithink"
                ? await ithinkCancel(creds.ithink ?? own, String(body.awb ?? ""))
                : provider === "tookan" || provider === "tookan-parcel"
                  ? await tookanCancel(creds.tookan ?? own, String(body.providerOrderId ?? body.awb ?? ""), String(body.providerShipmentId ?? body.awb ?? ""))
                  : provider === "shipday"
                    ? await shipdayCancel(own, String(body.providerOrderId ?? body.awb ?? ""))
                    : provider === "shipyaari"
                      ? await shipyaariCancel(creds.shipyaari ?? own, String(body.awb ?? ""))
                      : provider === "goswift"
                        ? await goswiftCancel(creds.goswift ?? own, String(body.awb ?? ""))
                        : provider === "ekart"
                          ? await ekartCancel(ekartKeys, String(body.awb ?? ""))
                          : provider === "shadowfax"
                            ? await shadowfaxCancel(creds.shadowfax ?? own, String(body.awb ?? ""))
                            : provider === "envia"
                              ? await enviaCancel(creds.envia ?? own, String(body.awb ?? ""), String(body.providerOrderId ?? ""))
                              : provider === "daakly"
                                ? await daaklyCancel(creds.daakly ?? own, String(body.providerShipmentId ?? body.awb ?? ""))
                                : undefined;
        if (result === undefined) return unsupported(provider);
        if (result === null) return NextResponse.json({ ok: false, configured: false, error: `${provider} credentials are not configured.` });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "pickup-address": {
        if (provider !== "shiprocket") return unsupported(provider);
        const result = await shiprocketAddPickup(own, body.pickup as Parameters<typeof shiprocketAddPickup>[1]);
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shiprocket credentials are not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "pickup-locations": {
        if (provider !== "shiprocket" && provider !== "ekart" && provider !== "goswift") return unsupported(provider);
        const result = provider === "ekart" ? await ekartAddresses(own) : provider === "goswift" ? await goswiftAddresses(own) : await shiprocketPickupLocations(own);
        if (!result) return NextResponse.json({ ok: false, configured: false, error: `${provider} credentials are not configured.` });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "invoice": {
        if (provider === "ithink") {
          const result = await ithinkInvoice(creds.ithink ?? own, String(body.awb ?? ""));
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "iThink Logistics credentials are not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider !== "shiprocket") return unsupported(provider);
        const result = await shiprocketInvoice(own, String(body.providerOrderId ?? ""));
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shiprocket credentials are not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "manifest": {
        if (provider === "ithink") {
          const result = await ithinkManifest(creds.ithink ?? own, String(body.awb ?? ""));
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "iThink Logistics credentials are not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider !== "shiprocket") return unsupported(provider);
        const result = await shiprocketManifest(own, String(body.shipmentId ?? ""));
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shiprocket credentials are not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "ndr": {
        if (provider !== "goswift" && provider !== "ekart" && provider !== "shadowfax") return unsupported(provider);
        const action = body.ndrAction === "RTO" ? "RTO" : "Re-Attempt";
        if (provider === "shadowfax") {
          const result = await shadowfaxNdr(creds.shadowfax ?? own, String(body.awb ?? ""), action, { phone: body.phone ? String(body.phone) : undefined, address: body.address ? String(body.address) : undefined });
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shadowfax API token is not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        const result = await (provider === "ekart" ? ekartNdr : goswiftNdr)(provider === "ekart" ? ekartKeys : creds.goswift ?? own, String(body.awb ?? ""), action, {
          date: body.date ? String(body.date) : undefined,
          phone: body.phone ? String(body.phone) : undefined,
          address: body.address ? String(body.address) : undefined,
          instructions: body.instructions ? String(body.instructions) : undefined,
        });
        if (!result) return NextResponse.json({ ok: false, configured: false, error: `${provider === "ekart" ? "Ekart" : "GoSwift"} credentials are not configured.` });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "webhook-register": {
        if (provider !== "goswift") return unsupported(provider);
        const url = `${request.nextUrl.origin}/api/shipping/goswift/webhook`;
        const result = await goswiftRegisterWebhook(creds.goswift ?? own, url);
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "GoSwift credentials are not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "return-pickup": {
        if (provider !== "shadowfax") return unsupported(provider);
        const result = await shadowfaxReturnPickup(creds.shadowfax ?? own, body.order as Parameters<typeof shadowfaxReturnPickup>[1]);
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shadowfax API token is not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "webhook-events": {
        return NextResponse.json({ ok: true, events: listWebhooks("shiprocket") });
      }
      case "wallet": {
        const result =
          provider === "shiprocket"
            ? await shiprocketWallet(own)
            : provider === "nimbuspost"
              ? await nimbusWallet(own)
              : provider === "ithink"
                ? await ithinkWallet(creds.ithink ?? own)
                : provider === "shipyaari"
                  ? await shipyaariWallet(creds.shipyaari ?? own)
                  : undefined;
        if (result === undefined) return unsupported(provider);
        if (result === null) return NextResponse.json({ ok: false, configured: false, error: `${provider} credentials are not configured.` });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "test": {
        const parcel = { pickupPincode: "411002", deliveryPincode: "110001", weightKg: 0.5, cod: false, declaredValue: 500, length: 20, breadth: 15, height: 5 };
        if (provider === "tookan" || provider === "tookan-parcel") {
          const result = await tookanTest(creds.tookan ?? own);
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "Tookan API key is not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider === "shipday") {
          const result = await shipdayTest(own);
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shipday API key is not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider === "ekart") {
          const result = await ekartTest(ekartKeys);
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "Ekart client ID, username and password are not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider === "shadowfax") {
          const sfx = await shadowfaxTest(creds.shadowfax ?? own);
          if (!sfx) return NextResponse.json({ ok: false, configured: false, error: "Shadowfax API token is not configured." });
          return NextResponse.json({ ok: true, configured: true, ...sfx });
        }
        if (provider === "goswift") {
          const result = await goswiftTest(creds.goswift ?? own);
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "GoSwift client ID, username and password are not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider === "shipyaari") {
          const result = await shipyaariTest(creds.shipyaari ?? own);
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shipyaari credentials are not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        const rates =
          provider === "shiprocket"
            ? await shiprocketRates(own, parcel)
            : provider === "nimbuspost"
              ? await nimbusRates(own, parcel)
              : provider === "ithink"
                ? await ithinkRates(creds.ithink ?? own, parcel)
                : provider === "envia"
                  ? await enviaRates(creds.envia ?? own, { ...parcel, pickupPincode: "411030" })
                  : provider === "daakly"
                    ? await daaklyRates(creds.daakly ?? own, { ...parcel, pickupPincode: "411030", cod: false })
                    : undefined;
        if (rates === undefined) return unsupported(provider);
        if (rates === null) return NextResponse.json({ ok: false, configured: false, error: `${provider} credentials are not configured.` });
        return NextResponse.json({ ok: true, configured: true, message: `Connected. ${rates.length} couriers priced Pune → Delhi.` });
      }
      default:
        return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ ok: false, configured: true, error: (error as Error).message });
  }
}

/** Divisors the aggregators publish for surface parcels; an admin value saved as volumetricDivisor in that aggregator's keys wins. Used only when the aggregator does not report the billed weight. */
const VOLUMETRIC_DIVISOR: Record<string, number> = { shiprocket: 5000, nimbuspost: 5000, ithink: 5000, shipyaari: 5000, goswift: 5000, ekart: 5000 };

function withWeights(rate: RateOut, parcel: { weightKg: number; length: number; breadth: number; height: number }, stored: Record<string, unknown>) {
  const saved = Number((stored[rate.provider] as Record<string, unknown> | undefined)?.volumetricDivisor);
  const divisor = saved > 0 ? saved : VOLUMETRIC_DIVISOR[rate.provider] ?? 5000;
  const actualKg = Math.round(Number(parcel.weightKg) * 1000) / 1000;
  const volumetricKg = Math.round(((Number(parcel.length) * Number(parcel.breadth) * Number(parcel.height)) / divisor) * 1000) / 1000;
  const expected = Math.max(actualKg, volumetricKg);
  const billed = rate.chargeWeightKg;
  const weightFlag =
    billed && billed > Math.ceil(expected * 2) / 2 + 0.5
      ? `Billed at ${billed} kg, but the packed parcel works out to ${Math.ceil(expected * 2) / 2} kg. Check the weight and size before booking.`
      : undefined;
  return { ...rate, actualKg, volumetricKg, volumetricDivisor: divisor, weightFlag };
}


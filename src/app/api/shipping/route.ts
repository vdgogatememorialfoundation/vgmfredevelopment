import { NextRequest, NextResponse } from "next/server";
import {
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
  nimbusRates,
  nimbusTrack,
  nimbusWallet,
  shipdayBook,
  shipdayCancel,
  shipdayTest,
  shipdayTrack,
  shiprocketAddPickup,
  shiprocketBook,
  shiprocketCancel,
  shiprocketInvoice,
  shiprocketLabel,
  shiprocketManifest,
  shiprocketPickup,
  shiprocketPickupLocations,
  shiprocketRates,
  shiprocketReturn,
  shiprocketTrack,
  shiprocketWallet,
  shipyaariBook,
  shipyaariCancel,
  shipyaariRates,
  shipyaariTest,
  shipyaariTrack,
  shipyaariWallet,
  tookanBookMode,
  tookanCancel,
  tookanTest,
  tookanTrack,
  type RateOut,
} from "@/lib/server/providers";
import { listWebhooks } from "@/lib/server/webhooks";

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
  const provider = String(body.provider ?? "");
  const own = creds[provider] ?? creds[provider.replace("-parcel", "")] ?? {};

  try {
    switch (body.action) {
      case "rates": {
        const parcel = body.parcel as Parameters<typeof shiprocketRates>[1];
        const wanted = Array.isArray(body.providers)
          ? (body.providers as string[])
          : ["shiprocket", "nimbuspost", "ithink", "shipyaari"];
        const jobs: Promise<{ provider: string; rates: RateOut[] | null; error?: string }>[] = wanted.map(async (id) => {
          try {
            if (id === "shiprocket") return { provider: id, rates: await shiprocketRates(creds.shiprocket ?? {}, parcel) };
            if (id === "nimbuspost") return { provider: id, rates: await nimbusRates(creds.nimbuspost ?? {}, parcel) };
            if (id === "ithink") return { provider: id, rates: await ithinkRates(creds.ithink ?? {}, parcel) };
            if (id === "shipyaari") return { provider: id, rates: await shipyaariRates(creds.shipyaari ?? {}, parcel) };
            return { provider: id, rates: null };
          } catch (error) {
            return { provider: id, rates: [], error: (error as Error).message };
          }
        });
        const results = await Promise.all(jobs);
        return NextResponse.json({
          ok: true,
          providers: results.map((result) => ({ provider: result.provider, configured: result.rates !== null, error: result.error })),
          rates: results.flatMap((result) => result.rates ?? []).sort((a, b) => a.rate - b.rate),
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
        if (provider === "ithink") {
          const result = await ithinkLabel(creds.ithink ?? own, String(body.awb ?? ""));
          if (!result) return NextResponse.json({ ok: false, configured: false, error: "iThink Logistics credentials are not configured." });
          return NextResponse.json({ ok: true, configured: true, ...result });
        }
        if (provider !== "shiprocket") return unsupported(provider);
        const result = await shiprocketLabel(own, String(body.shipmentId));
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shiprocket credentials are not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "track": {
        const awb = String(body.awb ?? body.providerOrderId ?? "");
        const result =
          provider === "shiprocket"
            ? await shiprocketTrack(own, awb)
            : provider === "nimbuspost"
              ? await nimbusTrack(own, awb)
              : provider === "ithink"
                ? await ithinkTrack(creds.ithink ?? own, awb)
                : provider === "tookan" || provider === "tookan-parcel"
                  ? await tookanTrack(creds.tookan ?? own, String(body.providerOrderId ?? awb))
                  : provider === "shipday"
                    ? await shipdayTrack(own, String(body.providerOrderId ?? awb))
                    : provider === "shipyaari"
                      ? await shipyaariTrack(creds.shipyaari ?? own, awb)
                      : undefined;
        if (result === undefined) return unsupported(provider);
        if (result === null) return NextResponse.json({ ok: false, configured: false, error: `${provider} credentials are not configured.` });
        return NextResponse.json({ ok: true, configured: true, ...result });
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
                  ? await tookanCancel(creds.tookan ?? own, String(body.providerOrderId ?? body.awb ?? ""))
                  : provider === "shipday"
                    ? await shipdayCancel(own, String(body.providerOrderId ?? body.awb ?? ""))
                    : provider === "shipyaari"
                      ? await shipyaariCancel(creds.shipyaari ?? own, String(body.awb ?? ""))
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
        if (provider !== "shiprocket") return unsupported(provider);
        const result = await shiprocketPickupLocations(own);
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shiprocket credentials are not configured." });
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
        const parcel = { pickupPincode: "411005", deliveryPincode: "110001", weightKg: 0.5, cod: false, declaredValue: 500, length: 20, breadth: 15, height: 5 };
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

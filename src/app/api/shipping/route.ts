import { NextRequest, NextResponse } from "next/server";
import {
  nimbusBook,
  nimbusCancel,
  nimbusRates,
  nimbusTrack,
  shipdayBook,
  shiprocketAddPickup,
  shiprocketBook,
  shiprocketCancel,
  shiprocketLabel,
  shiprocketPickup,
  shiprocketRates,
  shiprocketTrack,
  tookanBook,
  type RateOut,
} from "@/lib/server/providers";

type Body = Record<string, unknown> & {
  action?: string;
  provider?: string;
  creds?: Record<string, Record<string, unknown>>;
};

const unsupported = (provider: string) =>
  NextResponse.json({
    ok: false,
    configured: false,
    error:
      provider === "shipyaari"
        ? "Shipyaari credentials are saved, but Shipyaari shares its API only with account holders. Estimates are used until their endpoint details are added."
        : `${provider} does not support this action.`,
  });

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const creds = body.creds ?? {};
  const provider = String(body.provider ?? "");
  const own = creds[provider] ?? {};

  try {
    switch (body.action) {
      case "rates": {
        const parcel = body.parcel as Parameters<typeof shiprocketRates>[1];
        const wanted = Array.isArray(body.providers) ? (body.providers as string[]) : ["shiprocket", "nimbuspost"];
        const jobs: Promise<{ provider: string; rates: RateOut[] | null; error?: string }>[] = wanted.map(async (id) => {
          try {
            if (id === "shiprocket") return { provider: id, rates: await shiprocketRates(creds.shiprocket ?? {}, parcel) };
            if (id === "nimbuspost") return { provider: id, rates: await nimbusRates(creds.nimbuspost ?? {}, parcel) };
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
              : provider === "tookan"
                ? await tookanBook(own, order)
                : provider === "shipday"
                  ? await shipdayBook(own, order)
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
        }
        return NextResponse.json({ ok: true, configured: true, ...booked });
      }
      case "pickup": {
        if (provider !== "shiprocket") return unsupported(provider);
        const result = await shiprocketPickup(own, String(body.shipmentId), body.pickupDate ? String(body.pickupDate) : undefined);
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shiprocket credentials are not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "label": {
        if (provider !== "shiprocket") return unsupported(provider);
        const result = await shiprocketLabel(own, String(body.shipmentId));
        if (!result) return NextResponse.json({ ok: false, configured: false, error: "Shiprocket credentials are not configured." });
        return NextResponse.json({ ok: true, configured: true, ...result });
      }
      case "track": {
        const awb = String(body.awb ?? "");
        const result =
          provider === "shiprocket" ? await shiprocketTrack(own, awb) : provider === "nimbuspost" ? await nimbusTrack(own, awb) : undefined;
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
      case "test": {
        const parcel = { pickupPincode: "411005", deliveryPincode: "110001", weightKg: 0.5, cod: false, declaredValue: 500, length: 20, breadth: 15, height: 5 };
        const rates =
          provider === "shiprocket" ? await shiprocketRates(own, parcel) : provider === "nimbuspost" ? await nimbusRates(own, parcel) : undefined;
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

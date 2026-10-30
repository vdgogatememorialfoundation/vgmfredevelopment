"use client";

import { useEffect, useRef, useState } from "react";
import { getSettings, getShipments } from "@/lib/admin-store";
import { getIntegrations } from "@/lib/integrations";
import { pingLiveAgent } from "@/lib/shipping-client";
import { isHyperlocalProvider } from "@/lib/order-pipeline";
import { loadGooglePlaces, type GoogleMapsWindow } from "@/lib/maps-place";
import type { Order } from "@/types";

const DEFAULT_SCOOTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#0B1F3A"/><path fill="#B8953A" d="M18 40a6 6 0 1 0 12 0 6 6 0 0 0-12 0zm20 0a6 6 0 1 0 12 0 6 6 0 0 0-12 0z"/><path fill="#F7F3EA" d="M22 28h10l4-8h8l-3 8h5v4H24z"/><path fill="#8F2D2D" d="M36 20h8l2 4h-8z"/></svg>`
  );

type Ping = {
  status: string;
  lat?: number;
  lng?: number;
  trackingUrl?: string;
  events: { at: string; status: string; location?: string }[];
};

export default function LiveTracking({ order, embedded = false }: { order: Order; embedded?: boolean }) {
  const shipment = getShipments().find((item) => item.orderId === order.id && item.note !== "Cancelled");
  const [ping, setPing] = useState<Ping | null>(null);
  const [problem, setProblem] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<{ setPosition: (pos: { lat: number; lng: number }) => void } | null>(null);
  const settings = typeof window === "undefined" ? null : getIntegrations();
  const mapsKey = typeof window === "undefined" ? "" : getSettings().apiKeys.googleMaps;
  const scooter = settings?.shipping.scooterImage || DEFAULT_SCOOTER;
  const provider = shipment?.provider ?? order.courierChoice?.provider;
  const hyperlocal = isHyperlocalProvider(provider);

  useEffect(() => {
    if (!hyperlocal || !shipment || order.status === "Cancelled" || order.status === "Delivered" || order.status === "Failed") {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const result = await pingLiveAgent(shipment.id);
        if (cancelled) return;
        setPing(result);
        setProblem("");
      } catch (error) {
        if (!cancelled) setProblem(error instanceof Error ? error.message : "Could not refresh tracking.");
      }
    };
    run();
    const ms = Math.max(8, settings?.shipping.hyperlocalPingSeconds ?? 20) * 1000;
    const timer = window.setInterval(run, ms);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [shipment?.id, order.status, hyperlocal]);

  useEffect(() => {
    if (!hyperlocal || !mapsKey || !ping?.lat || !ping?.lng || !mapRef.current) return;
    const googleWin = window as GoogleMapsWindow & {
      google?: {
        maps?: {
          Map: new (el: HTMLElement, opts: object) => { setCenter: (pos: { lat: number; lng: number }) => void };
          Marker: new (opts: object) => { setPosition: (pos: { lat: number; lng: number }) => void };
          Size: new (w: number, h: number) => unknown;
        };
      };
    };
    loadGooglePlaces(mapsKey)
      .then(() => {
        const maps = googleWin.google?.maps;
        if (!maps || !mapRef.current || ping.lat == null || ping.lng == null) return;
        const position = { lat: ping.lat, lng: ping.lng };
        if (!markerRef.current) {
          const map = new maps.Map(mapRef.current, {
            center: position,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
          });
          markerRef.current = new maps.Marker({
            map,
            position,
            icon: { url: scooter, scaledSize: new maps.Size(48, 48) },
            title: "Delivery agent",
          });
        } else {
          markerRef.current.setPosition(position);
        }
      })
      .catch(() => setProblem("Google Maps could not load. Check the Maps API key in Settings."));
  }, [hyperlocal, mapsKey, ping?.lat, ping?.lng, scooter]);

  if (order.deliveryMode !== "delivery") return null;
  if (!hyperlocal) return null;
  if (!shipment && !order.trackingId) return null;

  const mapBox = mapsKey ? (
    <div ref={mapRef} className={embedded ? "h-full min-h-[280px] w-full" : "h-72 w-full bg-warm-cream"} />
  ) : ping?.lat && ping?.lng ? (
    <iframe
      title="Delivery map"
      className={embedded ? "h-full min-h-[280px] w-full border-0" : "h-72 w-full border-0"}
      src={`https://www.google.com/maps?q=${ping.lat},${ping.lng}&z=15&output=embed`}
    />
  ) : (
    <p className="p-4 text-sm text-text-muted">
      Waiting for the delivery agent location. Add a Google Maps key in Settings for the live map.
    </p>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-[280px] flex-col">
        <div className="bg-white px-3 py-2">
          <p className="vgmf-hl-live">
            {provider === "tookan" ? "Tookan" : "Shipday"}
            {ping?.status ? ` · ${ping.status}` : " · Live partner location"}
          </p>
        </div>
        <div className="min-h-0 flex-1">{mapBox}</div>
        {problem ? <p className="px-3 py-2 text-xs text-red-600">{problem}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold text-text-primary">Live hyperlocal map</p>
            <p className="text-xs text-text-muted">
              {provider === "tookan" ? "Tookan" : "Shipday"} agent location, refreshed from courier GPS.
              {ping?.status ? ` Status: ${ping.status}.` : ""}
            </p>
          </div>
        </div>
        {mapBox}
      </div>
      {problem ? <p className="text-xs text-red-600">{problem}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { loadGooglePlaces } from "@/lib/maps-place";

type LatLng = { lat: number; lng: number };
type Point = { lat?: number; lng?: number; label: string; address?: string };

const STORE = "#8F2D2D";
const DROP = "#0F7A4A";

const MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#f3efe6" }] },
  { featureType: "water", stylers: [{ color: "#d5e6ea" }] },
  { featureType: "landscape", stylers: [{ color: "#f7f4ee" }] },
];

function pin(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="58" viewBox="0 0 46 58"><path fill="${color}" d="M23 2a18 18 0 0 0-18 18c0 13 18 36 18 36s18-23 18-36A18 18 0 0 0 23 2z"/><circle cx="23" cy="20" r="7" fill="#fff"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function hasCoords(point?: Point | null): point is Point & LatLng {
  return Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function curved(a: LatLng, b: LatLng, steps = 48): LatLng[] {
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const len = Math.hypot(dx, dy) || 1;
  const offset = len * 0.22;
  const ctrl = { lat: mid.lat - (dx / len) * offset, lng: mid.lng + (dy / len) * offset };
  const pts: LatLng[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      lat: u * u * a.lat + 2 * u * t * ctrl.lat + t * t * b.lat,
      lng: u * u * a.lng + 2 * u * t * ctrl.lng + t * t * b.lng,
    });
  }
  return pts;
}

function AgentCard({
  partner,
  status,
  hyperlocal,
  agentName,
  agentPhone,
}: {
  partner: string;
  status: string;
  hyperlocal: boolean;
  agentName?: string;
  agentPhone?: string;
}) {
  const phone = agentPhone?.replace(/\s/g, "") ?? "";
  return (
    <div className="vgmf-map-agent">
      <div className="min-w-0">
        <b>{partner}</b>
        <span>
          {hyperlocal
            ? agentName || agentPhone
              ? [agentName, agentPhone].filter(Boolean).join(" · ")
              : status || "Waiting for a rider"
            : status || "Parcel is with the courier"}
        </span>
      </div>
      {hyperlocal && phone ? (
        <a href={`tel:${phone}`}>Call</a>
      ) : null}
    </div>
  );
}

function Schematic({
  partner,
  status,
  hyperlocal,
  agentName,
  agentPhone,
  storeLabel,
  dropLabel,
  hasRider,
}: {
  partner: string;
  status: string;
  hyperlocal: boolean;
  agentName?: string;
  agentPhone?: string;
  storeLabel: string;
  dropLabel: string;
  hasRider: boolean;
}) {
  const lower = status.toLowerCase();
  const t = hasRider
    ? 0.58
    : /deliver/.test(lower) && !/out|finding/.test(lower)
      ? 0.92
      : /way|started|progress|out/.test(lower)
        ? 0.66
        : /assign|accept|rider/.test(lower)
          ? 0.32
          : 0.14;
  const x = 54 + (286 - 54) * t;
  const y = 150 - Math.sin(Math.PI * t) * 70;
  return (
    <div className="vgmf-map-card">
      <svg viewBox="0 0 360 220" className="h-full min-h-[280px] w-full" role="img" aria-label="Path from the store to the customer">
        <rect width="360" height="220" fill="#f4f0e8" />
        <path d="M54 158 C 140 40, 220 40, 300 92" fill="none" stroke={STORE} strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
        <circle cx="54" cy="158" r="16" fill="#fff" stroke={STORE} strokeWidth="3" />
        <circle cx="54" cy="158" r="6" fill={STORE} />
        <circle cx="300" cy="92" r="16" fill="#fff" stroke={DROP} strokeWidth="3" />
        <circle cx="300" cy="92" r="6" fill={DROP} />
        {hyperlocal ? <circle cx={x} cy={y} r="8" fill="#0B1F3A" stroke="#fff" strokeWidth="2" /> : null}
        <text x="54" y="188" textAnchor="middle" fontSize="11" fontWeight="700" fill={STORE}>
          Store
        </text>
        <text x="300" y="122" textAnchor="middle" fontSize="11" fontWeight="700" fill={DROP}>
          You
        </text>
      </svg>
      <p className="px-3 pb-14 text-xs text-text-muted">
        {storeLabel} → {dropLabel}
      </p>
      <AgentCard partner={partner} status={status} hyperlocal={hyperlocal} agentName={agentName} agentPhone={agentPhone} />
    </div>
  );
}

export default function DeliveryMap({
  mapsKey,
  partner,
  status,
  hyperlocal,
  scooter,
  store,
  drop,
  agent,
  agentName,
  agentPhone,
}: {
  mapsKey: string;
  partner: string;
  status: string;
  hyperlocal: boolean;
  scooter: string;
  store: Point;
  drop: Point;
  agent?: LatLng;
  agentName?: string;
  agentPhone?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [resolved, setResolved] = useState<{ store?: LatLng; drop?: LatLng }>({});

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next: { store?: LatLng; drop?: LatLng } = {};
      if (hasCoords(store)) next.store = { lat: store.lat, lng: store.lng };
      if (hasCoords(drop)) next.drop = { lat: drop.lat, lng: drop.lng };
      if (mapsKey && (!next.store || !next.drop)) {
        try {
          await loadGooglePlaces(mapsKey);
          const geocoder = new (window as unknown as { google: { maps: { Geocoder: new () => { geocode: (req: { address: string }, cb: (results: { geometry?: { location?: { lat: () => number; lng: () => number } } }[] | null, status: string) => void) => void } } } }).google.maps.Geocoder();
          const lookup = (address?: string) =>
            new Promise<LatLng | undefined>((resolve) => {
              if (!address) return resolve(undefined);
              geocoder.geocode({ address }, (results, code) => {
                const loc = code === "OK" ? results?.[0]?.geometry?.location : undefined;
                resolve(loc ? { lat: loc.lat(), lng: loc.lng() } : undefined);
              });
            });
          if (!next.store) next.store = await lookup(store.address);
          if (!next.drop) next.drop = await lookup(drop.address);
        } catch {
          /* schematic stays available */
        }
      }
      if (!cancelled) setResolved(next);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [mapsKey, store.lat, store.lng, store.address, drop.lat, drop.lng, drop.address]);

  useEffect(() => {
    if (!mapsKey || !mapRef.current || (!resolved.store && !resolved.drop && !agent)) return;
    let cancelled = false;
    const googleWin = window as unknown as {
      google?: {
        maps?: {
          Map: new (el: HTMLElement, opts: object) => { fitBounds: (b: object, pad?: number) => void; setCenter: (p: LatLng) => void; setZoom: (z: number) => void };
          Marker: new (opts: object) => { setMap: (map: object | null) => void };
          Polyline: new (opts: object) => { setMap: (map: object | null) => void };
          LatLngBounds: new () => { extend: (p: LatLng) => void };
          Size: new (w: number, h: number) => unknown;
          Point: new (x: number, y: number) => unknown;
          SymbolPath: { CIRCLE: number };
          DirectionsService?: new () => { route: (req: object, cb: (result: { routes?: { overview_path?: unknown }[] } | null, status: string) => void) => void };
        };
      };
    };
    loadGooglePlaces(mapsKey)
      .then(() => {
        const maps = googleWin.google?.maps;
        if (cancelled || !maps || !mapRef.current) return;
        mapRef.current.innerHTML = "";
        const center = agent ?? resolved.store ?? resolved.drop ?? { lat: 18.52, lng: 73.86 };
        const map = new maps.Map(mapRef.current, {
          center,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          styles: MAP_STYLE,
        });
        const bounds = new maps.LatLngBounds();
        const markers: { setMap: (map: object | null) => void }[] = [];
        const place = (point: LatLng | undefined, title: string, color: string) => {
          if (!point) return;
          bounds.extend(point);
          markers.push(
            new maps.Marker({
              map,
              position: point,
              title,
              icon: { url: pin(color), scaledSize: new maps.Size(36, 46), anchor: new maps.Point(18, 44) },
              zIndex: 3,
            })
          );
          markers.push(
            new maps.Marker({
              map,
              position: point,
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: 18,
                fillColor: color,
                fillOpacity: 0.18,
                strokeColor: color,
                strokeWeight: 2,
              },
              zIndex: 1,
              clickable: false,
            })
          );
        };
        place(resolved.store, store.label || "Store", STORE);
        place(resolved.drop, drop.label || "Customer", DROP);
        if (agent) {
          bounds.extend(agent);
          markers.push(
            new maps.Marker({
              map,
              position: agent,
              title: agentName || "Delivery partner",
              icon: { url: scooter, scaledSize: new maps.Size(48, 48), anchor: new maps.Point(24, 24) },
              zIndex: 4,
            })
          );
        }
        if (resolved.store && resolved.drop) {
          new maps.Polyline({
            map,
            path: curved(resolved.store, resolved.drop),
            strokeOpacity: 0,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: STORE, scale: 3 },
                offset: "0",
                repeat: "14px",
              },
            ],
          });
          if (maps.DirectionsService) {
            new maps.DirectionsService().route(
              { origin: resolved.store, destination: resolved.drop, travelMode: "DRIVING" },
              (result, code) => {
                const path = code === "OK" ? result?.routes?.[0]?.overview_path : undefined;
                if (!path) return;
                new maps.Polyline({ map, path, strokeColor: DROP, strokeOpacity: 0.85, strokeWeight: 4, zIndex: 1 });
              }
            );
          }
        }
        const only = [resolved.store, resolved.drop, agent].filter(Boolean);
        if (only.length > 1) map.fitBounds(bounds, 72);
        else map.setZoom(15);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mapsKey, resolved.store, resolved.drop, agent?.lat, agent?.lng, scooter, store.label, drop.label, agentName]);

  if (!mapsKey || (!resolved.store && !resolved.drop && !agent)) {
    return (
      <Schematic
        partner={partner}
        status={status}
        hyperlocal={hyperlocal}
        agentName={agentName}
        agentPhone={agentPhone}
        storeLabel={store.label || "Store"}
        dropLabel={drop.label || "Customer"}
        hasRider={Boolean(agent)}
      />
    );
  }

  return (
    <div className="vgmf-map-card">
      <div ref={mapRef} className="h-full min-h-[320px] w-full" />
      <div className="vgmf-map-legend">
        <span><i style={{ background: STORE }} /> Store</span>
        <span><i style={{ background: DROP }} /> You</span>
      </div>
      <AgentCard partner={partner} status={status} hyperlocal={hyperlocal} agentName={agentName} agentPhone={agentPhone} />
    </div>
  );
}

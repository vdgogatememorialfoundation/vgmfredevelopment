"use client";

import { useEffect, useRef, useState } from "react";
import { loadTrackingMaps } from "@/lib/maps-place";

type LatLng = { lat: number; lng: number };
type LiveMap = {
  fitBounds: (bounds: object, pad?: number) => void;
  setTilt: (tilt: number) => void;
  setHeading: (heading: number) => void;
  panTo: (point: LatLng) => void;
};
type Bike = { position?: LatLng; map?: object | null; setPosition?: (point: LatLng) => void };
type Point = { lat?: number; lng?: number; label: string; address?: string };
type Leg = "pickup" | "delivery";

const STORE = "#8F2D2D";
const DROP = "#0F7A4A";
const ROAD = "#8F2D2D";

function pin(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="58" viewBox="0 0 46 58"><path fill="${color}" d="M23 2a18 18 0 0 0-18 18c0 13 18 36 18 36s18-23 18-36A18 18 0 0 0 23 2z"/><circle cx="23" cy="20" r="7" fill="#fff"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function hasCoords(point?: Point | null): point is Point & LatLng {
  return Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function mins(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function clock(seconds: number) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(
    new Date(Date.now() + seconds * 1000)
  );
}

function arrivalText(leg: Leg, legs: { duration?: { value?: number } }[]) {
  const times = legs.map((item) => item.duration?.value ?? 0).filter((value) => value > 0);
  if (!times.length) return "";
  if (leg === "delivery" || times.length === 1) {
    return `Arrives in ${mins(times[0])} · by ${clock(times[0])}`;
  }
  const total = times.reduce((sum, value) => sum + value, 0);
  return `At the store in ${mins(times[0])} · at your address by ${clock(total)}`;
}

function project(point: LatLng, path: LatLng[]) {
  let best = Number.POSITIVE_INFINITY;
  let at = path[0] ?? point;
  let index = 0;
  let heading = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const len2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / len2));
    const lat = a.lat + dy * t;
    const lng = a.lng + dx * t;
    const score = (lat - point.lat) ** 2 + (lng - point.lng) ** 2;
    if (score < best) {
      best = score;
      at = { lat, lng };
      index = i + t;
      heading = (Math.atan2(dx, dy) * 180) / Math.PI;
    }
  }
  return { at, index, heading };
}

function along(path: LatLng[], index: number) {
  if (!path.length) return { lat: 0, lng: 0 };
  const i = Math.max(0, Math.min(path.length - 1, Math.floor(index)));
  const next = Math.min(path.length - 1, i + 1);
  const t = index - i;
  return {
    lat: path[i].lat + (path[next].lat - path[i].lat) * t,
    lng: path[i].lng + (path[next].lng - path[i].lng) * t,
  };
}

function AgentCard({
  partner,
  status,
  accepted,
  leg,
  agentName,
  agentPhone,
  arrival,
}: {
  partner: string;
  status: string;
  accepted: boolean;
  leg: Leg;
  agentName?: string;
  agentPhone?: string;
  arrival: string;
}) {
  const phone = agentPhone?.replace(/\s/g, "") ?? "";
  const where = leg === "pickup" ? "Heading to the store, then to you" : "Heading to your address";
  return (
    <div className="vgmf-map-agent">
      <div className="min-w-0">
        <b>{partner}</b>
        <span>
          {accepted
            ? [agentName, agentPhone, where, arrival].filter(Boolean).join(" · ")
            : status || "Finding a rider"}
        </span>
      </div>
      {accepted && phone ? <a href={`tel:${phone}`}>Call</a> : null}
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function Schematic({
  partner,
  status,
  accepted,
  leg,
  agentName,
  agentPhone,
  storeLabel,
  dropLabel,
}: {
  partner: string;
  status: string;
  accepted: boolean;
  leg: Leg;
  agentName?: string;
  agentPhone?: string;
  storeLabel: string;
  dropLabel: string;
}) {
  const [openPin, setOpenPin] = useState<"store" | "drop" | null>(null);
  return (
    <div className="vgmf-map-card">
      <svg viewBox="0 0 360 220" className="h-full min-h-[280px] w-full" role="img" aria-label="Path from the store to the customer">
        <rect width="360" height="220" fill="#f4f0e8" />
        <path d="M54 158 C 140 40, 220 40, 300 92" fill="none" stroke={ROAD} strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
        <g role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => setOpenPin("store")}>
          <circle cx="54" cy="158" r="16" fill="#fff" stroke={STORE} strokeWidth="3" />
          <circle cx="54" cy="158" r="6" fill={STORE} />
          <text x="54" y="188" textAnchor="middle" fontSize="11" fontWeight="700" fill={STORE}>
            {storeLabel.length > 18 ? `${storeLabel.slice(0, 16)}…` : storeLabel}
          </text>
        </g>
        <g role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => setOpenPin("drop")}>
          <circle cx="300" cy="92" r="16" fill="#fff" stroke={DROP} strokeWidth="3" />
          <circle cx="300" cy="92" r="6" fill={DROP} />
          <text x="300" y="122" textAnchor="middle" fontSize="11" fontWeight="700" fill={DROP}>
            {dropLabel}
          </text>
        </g>
        {accepted ? <circle cx={leg === "delivery" ? 230 : 130} cy={leg === "delivery" ? 70 : 90} r="8" fill="#0B1F3A" stroke="#fff" strokeWidth="2" /> : null}
      </svg>
      <p className="px-3 pb-14 text-xs text-text-muted">
        {openPin === "store" ? storeLabel : openPin === "drop" ? dropLabel : `${storeLabel} · ${dropLabel}`}
      </p>
      <AgentCard partner={partner} status={status} accepted={accepted} leg={leg} agentName={agentName} agentPhone={agentPhone} arrival="" />
    </div>
  );
}

export default function DeliveryMap({
  mapsKey,
  partner,
  status,
  accepted,
  leg,
  scooter,
  store,
  drop,
  agent,
  agentName,
  agentPhone,
  onArrival,
}: {
  mapsKey: string;
  partner: string;
  status: string;
  accepted: boolean;
  leg: Leg;
  scooter: string;
  store: Point;
  drop: Point;
  agent?: LatLng;
  agentName?: string;
  agentPhone?: string;
  onArrival?: (text: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<{
    map: LiveMap;
    line?: { setMap: (map: object | null) => void };
    bike?: Bike;
    img?: HTMLImageElement;
    path: LatLng[];
    progress: number;
  } | null>(null);
  const [resolved, setResolved] = useState<{ store?: LatLng; drop?: LatLng }>({});
  const [mapReady, setMapReady] = useState(false);
  const [arrival, setArrival] = useState("");
  const pinsRef = useRef({ store, drop });
  pinsRef.current = { store, drop };

  useEffect(() => {
    onArrival?.(arrival);
  }, [arrival, onArrival]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next: { store?: LatLng; drop?: LatLng } = {};
      if (hasCoords(store)) next.store = { lat: store.lat, lng: store.lng };
      if (hasCoords(drop)) next.drop = { lat: drop.lat, lng: drop.lng };
      if (mapsKey && (!next.store || !next.drop)) {
        try {
          await loadTrackingMaps(mapsKey);
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
    if (!mapsKey || !hostRef.current || (!resolved.store && !resolved.drop)) return;
    let cancelled = false;
    const googleWin = window as unknown as {
      google?: {
        maps?: {
          Map: new (el: HTMLElement, opts: object) => LiveMap;
          Marker: new (opts: object) => { setMap: (map: object | null) => void; addListener: (name: string, fn: () => void) => void };
          InfoWindow: new () => { setContent: (html: string) => void; open: (map: object, marker?: object) => void };
          marker?: { AdvancedMarkerElement: new (opts: object) => { addListener: (name: string, fn: () => void) => void } };
          LatLngBounds: new () => { extend: (point: LatLng) => void };
          Size: new (w: number, h: number) => unknown;
          Point: new (x: number, y: number) => unknown;
          event?: { addListenerOnce: (target: object, name: string, fn: () => void) => void };
        };
      };
    };
    loadTrackingMaps(mapsKey)
      .then(() => {
        const maps = googleWin.google?.maps;
        if (cancelled || !maps || !hostRef.current || sessionRef.current) return;
        hostRef.current.innerHTML = "";
        const center = resolved.store ?? resolved.drop ?? { lat: 18.5196, lng: 73.8553 };
        const options = {
          center,
          zoom: 17,
          tilt: 67.5,
          heading: 24,
          mapId: "DEMO_MAP_ID",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        };
        let map: LiveMap;
        try {
          map = new maps.Map(hostRef.current, options);
        } catch {
          map = new maps.Map(hostRef.current, { ...options, mapId: undefined });
        }
        const info = new maps.InfoWindow();
        const bounds = new maps.LatLngBounds();
        const place = (point: LatLng | undefined, kind: "store" | "drop", color: string) => {
          if (!point) return;
          bounds.extend(point);
          const pinPoint = kind === "store" ? pinsRef.current.store : pinsRef.current.drop;
          const label = pinPoint.label || (kind === "store" ? "Store" : "Home");
          const content = document.createElement("button");
          content.type = "button";
          content.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2px;background:transparent;border:0;padding:0;cursor:pointer";
          const img = document.createElement("img");
          img.src = pin(color);
          img.alt = label;
          img.width = 36;
          img.height = 46;
          const name = document.createElement("span");
          name.textContent = label;
          name.style.cssText = "max-width:148px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#fff;color:#1c1917;border-radius:999px;padding:3px 8px;font:700 11px/1.3 sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.18)";
          content.append(img, name);
          const openInfo = () => {
            const current = kind === "store" ? pinsRef.current.store : pinsRef.current.drop;
            const title = escapeHtml(current.label || label);
            const address = current.address ? `<div style="margin-top:4px">${escapeHtml(current.address)}</div>` : "";
            info.setContent(`<div style="font-family:sans-serif;max-width:220px;color:#1c1917"><b>${title}</b>${address}</div>`);
            info.open(map);
          };
          content.addEventListener("click", openInfo);
          const Advanced = maps.marker?.AdvancedMarkerElement;
          if (Advanced) {
            try {
              new Advanced({ map, position: point, content, zIndex: 4, title: label });
              return;
            } catch {
              /* classic pin below */
            }
          }
          new maps.Marker({
            map,
            position: point,
            title: label,
            icon: { url: pin(color), scaledSize: new maps.Size(36, 46), anchor: new maps.Point(18, 44) },
            zIndex: 4,
          }).addListener("click", openInfo);
        };
        place(resolved.store, "store", STORE);
        place(resolved.drop, "drop", DROP);
        if (resolved.store && resolved.drop) map.fitBounds(bounds, 80);
        sessionRef.current = { map, path: [], progress: 0 };
        maps.event?.addListenerOnce(map, "idle", () => {
          map.setTilt(67.5);
          map.setHeading(24);
        });
        if (!cancelled) setMapReady(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mapsKey, resolved.store, resolved.drop, store.label, drop.label]);

  useEffect(() => {
    const view = sessionRef.current;
    const googleWin = window as unknown as {
      google?: {
        maps?: {
          Polyline: new (opts: object) => { setMap: (map: object | null) => void };
          Marker: new (opts: object) => { setMap: (map: object | null) => void; setPosition: (point: LatLng) => void };
          LatLngBounds: new () => { extend: (point: LatLng) => void };
          Size: new (w: number, h: number) => unknown;
          Point: new (x: number, y: number) => unknown;
          DirectionsService?: new () => {
            route: (
              req: object,
              cb: (result: { routes?: { overview_path?: { lat: () => number; lng: () => number }[]; legs?: { duration?: { value?: number } }[] }[] } | null, code: string) => void
            ) => void;
          };
          geometry?: { spherical?: { computeHeading: (a: LatLng, b: LatLng) => number } };
          marker?: { AdvancedMarkerElement: new (opts: object) => { position?: LatLng; map?: object | null } };
        };
      };
    };
    const maps = googleWin.google?.maps;
    if (!mapReady || !view || !maps) return;
    const live = view;
    let stopped = false;
    const origin = accepted && agent ? agent : resolved.store;
    const destination = resolved.drop;
    if (!origin || !destination) return;
    const waypoints =
      accepted && agent && leg === "pickup" && resolved.store
        ? [{ location: resolved.store, stopover: true }]
        : [];
    let frame = 0;
    const draw = (path: LatLng[], text: string) => {
      live.line?.setMap(null);
      live.line = new maps.Polyline({
        map: live.map,
        path,
        strokeOpacity: 0,
        zIndex: 2,
        icons: [
          {
            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: ROAD, scale: 3 },
            offset: "0",
            repeat: "12px",
          },
        ],
      });
      live.path = path;
      setArrival(text);
      const bounds = new maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      if (agent) bounds.extend(agent);
      live.map.fitBounds(bounds, 64);
      window.setTimeout(() => {
        live.map.setTilt(67.5);
        live.map.setHeading(24);
      }, 400);
    };
    const service = maps.DirectionsService ? new maps.DirectionsService() : null;
    if (!service) return;
    service.route(
      { origin, destination, waypoints, travelMode: "DRIVING" },
      (result, code) => {
        if (stopped) return;
        const route = code === "OK" ? result?.routes?.[0] : undefined;
        const path = route?.overview_path?.map((point) => ({ lat: point.lat(), lng: point.lng() }));
        if (!path?.length) return;
        draw(path, accepted ? arrivalText(leg, route?.legs ?? []) : "");
        if (!accepted || !agent) {
          live.bike && (live.bike.map = null);
          return;
        }
        moveBike(path);
      }
    );

    function moveBike(path: LatLng[]) {
      if (!agent) return;
      const snapped = project(agent, path);
      const headingOf = (from: LatLng, to: LatLng) =>
        maps?.geometry?.spherical?.computeHeading(from, to) ?? (Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180) / Math.PI;
      const nextHeading = headingOf(snapped.at, along(path, snapped.index + 0.4));
      if (!live.img) {
        const img = document.createElement("img");
        img.src = scooter;
        img.alt = agentName || "Rider";
        img.width = 48;
        img.height = 48;
        img.style.width = "48px";
        img.style.height = "48px";
        img.style.transformOrigin = "center";
        live.img = img;
        const Advanced = maps?.marker?.AdvancedMarkerElement;
        if (Advanced) {
          live.bike = new Advanced({ map: live.map, position: snapped.at, content: img, zIndex: 5 });
        } else if (maps) {
          live.bike = new maps.Marker({
            map: live.map,
            position: snapped.at,
            title: agentName || "Rider",
            icon: { url: scooter, scaledSize: new maps.Size(48, 48), anchor: new maps.Point(24, 24) },
            zIndex: 5,
          });
        }
      }
      const from = live.progress;
      const to = snapped.index;
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / 1400);
        const index = from + (to - from) * t;
        const point = along(path, index);
        const heading = headingOf(point, along(path, index + 0.35));
        if (live.img) live.img.style.transform = `rotate(${heading}deg)`;
        if (live.bike?.setPosition) live.bike.setPosition(point);
        else if (live.bike) live.bike.position = point;
        live.progress = index;
        if (t < 1) frame = window.requestAnimationFrame(step);
      };
      frame = window.requestAnimationFrame(step);
    }

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
    };
  }, [mapReady, resolved.store, resolved.drop, agent?.lat, agent?.lng, accepted, leg, scooter, agentName]);

  if (!mapsKey || (!resolved.store && !resolved.drop && !mapReady)) {
    return (
      <Schematic
        partner={partner}
        status={status}
        accepted={accepted}
        leg={leg}
        agentName={agentName}
        agentPhone={agentPhone}
        storeLabel={store.label || "Store"}
        dropLabel={drop.label || "You"}
      />
    );
  }

  return (
    <div className="vgmf-map-card">
      <div ref={hostRef} className="h-full min-h-[380px] w-full" />
      <div className="vgmf-map-legend">
        <span><i style={{ background: STORE }} /> {store.label || "Store"}</span>
        <span><i style={{ background: DROP }} /> {drop.label || "Home"}</span>
        {accepted ? <span><i style={{ background: "#0B1F3A" }} /> Rider</span> : null}
      </div>
      <AgentCard
        partner={partner}
        status={status}
        accepted={accepted}
        leg={leg}
        agentName={agentName}
        agentPhone={agentPhone}
        arrival={arrival}
      />
    </div>
  );
}

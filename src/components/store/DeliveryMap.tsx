"use client";

import { useEffect, useRef, useState } from "react";
import { flyingRoute } from "@/lib/flight-arc";
import { loadTrackingMaps } from "@/lib/maps-place";

type LatLng = { lat: number; lng: number };
type LiveMap = {
  fitBounds: (bounds: object, pad?: number | { top: number; right: number; bottom: number; left: number }) => void;
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
/** Ramprasad Chambers, New Nana Peth. Used when the courier does not send a pickup coordinate. */
const CLINIC_PIN: LatLng = { lat: 18.514204, lng: 73.869083 };

function sameSpot(a?: { lat?: number; lng?: number } | null, b?: { lat?: number; lng?: number } | null) {
  if (!hasCoords(a) || !hasCoords(b)) return false;
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng < 0.00000025;
}

function pin(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="58" viewBox="0 0 46 58"><path fill="${color}" d="M23 2a18 18 0 0 0-18 18c0 13 18 36 18 36s18-23 18-36A18 18 0 0 0 23 2z"/><circle cx="23" cy="20" r="7" fill="#fff"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function hasCoords(point?: { lat?: number; lng?: number } | null): point is LatLng {
  return Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat!) > 0.01 && Math.abs(point.lng!) > 0.01);
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
            : status}
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
  showCourier,
}: {
  partner: string;
  status: string;
  accepted: boolean;
  leg: Leg;
  agentName?: string;
  agentPhone?: string;
  storeLabel: string;
  dropLabel: string;
  showCourier: boolean;
}) {
  const [openPin, setOpenPin] = useState<"store" | "drop" | null>(null);
  const storeName = storeLabel.length > 18 ? `${storeLabel.slice(0, 16)}…` : storeLabel;
  return (
    <div className="vgmf-map-card">
      <div className="vgmf-map-stage">
        <svg viewBox="0 0 360 220" role="img" aria-label="Path from the store to the customer">
          <rect width="360" height="220" fill="#f4f0e8" />
          <path d="M72 106.3 Q 177 36 282 94.3" fill="none" stroke={ROAD} strokeWidth="4" strokeLinecap="round" />
          <g role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => setOpenPin("store")}>
            <image href={pin(STORE)} x="52" y="58" width="40" height="50" />
            <text x="72" y="132" textAnchor="middle" fontSize="11" fontWeight="700" fill={STORE}>
              {storeName}
            </text>
          </g>
          <g role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => setOpenPin("drop")}>
            <image href={pin(DROP)} x="262" y="46" width="40" height="50" />
            <text x="282" y="112" textAnchor="middle" fontSize="11" fontWeight="700" fill={DROP}>
              {dropLabel}
            </text>
          </g>
          {accepted ? <circle cx={leg === "delivery" ? 220 : 150} cy={leg === "delivery" ? 62 : 70} r="8" fill="#0B1F3A" stroke="#fff" strokeWidth="2" /> : null}
        </svg>
      </div>
      {openPin ? (
        <p className="px-3 text-xs text-text-muted">{openPin === "store" ? storeLabel : dropLabel}</p>
      ) : null}
      {showCourier ? (
        <AgentCard partner={partner} status={status} accepted={accepted} leg={leg} agentName={agentName} agentPhone={agentPhone} arrival="" />
      ) : null}
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
  showCourier = false,
  promised = "",
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
  /** Courier name stays hidden until the parcel has been picked up. */
  showCourier?: boolean;
  /** Delivery date and time returned by the courier portal. */
  promised?: string;
  onArrival?: (text: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<{
    map: LiveMap;
    line?: { setMap: (map: object | null) => void; setPath?: (path: LatLng[]) => void };
    bike?: Bike;
    img?: HTMLImageElement;
    path: LatLng[];
    progress: number;
  } | null>(null);
  const [resolved, setResolved] = useState<{ store?: LatLng; drop?: LatLng }>({});
  const [mapReady, setMapReady] = useState(false);
  const pinsRef = useRef({ store, drop });
  pinsRef.current = { store, drop };

  useEffect(() => {
    onArrival?.(promised);
  }, [promised, onArrival]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next: { store?: LatLng; drop?: LatLng } = {};
      if (hasCoords(drop)) next.drop = { lat: drop.lat, lng: drop.lng };
      if (hasCoords(store) && !sameSpot(store, next.drop)) next.store = { lat: store.lat, lng: store.lng };
      if (mapsKey && (!next.store || !next.drop)) {
        try {
          await loadTrackingMaps(mapsKey);
          const geocoder = new (window as unknown as { google: { maps: { Geocoder: new () => { geocode: (req: { address: string }, cb: (results: { geometry?: { location?: { lat: () => number; lng: () => number } } }[] | null, status: string) => void) => void } } } }).google.maps.Geocoder();
          const lookup = (address?: string) =>
            new Promise<LatLng | undefined>((resolve) => {
              if (!address) return resolve(undefined);
              geocoder.geocode({ address: `${address}, India` }, (results, code) => {
                const loc = code === "OK" ? results?.[0]?.geometry?.location : undefined;
                resolve(loc ? { lat: loc.lat(), lng: loc.lng() } : undefined);
              });
            });
          if (!next.store) next.store = await lookup(store.address);
          if (!next.drop) next.drop = await lookup(drop.address);
        } catch {
          /* the clinic pin below still marks the store */
        }
      }
      if (!next.store || sameSpot(next.store, next.drop)) next.store = CLINIC_PIN;
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
          CollisionBehavior?: { REQUIRED?: unknown };
          marker?: {
            AdvancedMarkerElement: new (opts: object) => { addListener: (name: string, fn: () => void) => void };
            PinElement?: new (opts: { background?: string; borderColor?: string; glyphColor?: string; scale?: number }) => { element: HTMLElement };
          };
          LatLngBounds: new () => { extend: (point: LatLng) => void };
          Size: new (w: number, h: number) => unknown;
          Point: new (x: number, y: number) => unknown;
          Polyline: new (opts: object) => { setMap: (map: object | null) => void; setPath?: (path: LatLng[]) => void };
          event?: { addListenerOnce: (target: object, name: string, fn: () => void) => void };
        };
      };
    };
    loadTrackingMaps(mapsKey)
      .then(() => {
        const maps = googleWin.google?.maps;
        if (cancelled || !maps || !hostRef.current) return;
        if (sessionRef.current) {
          if (resolved.store && resolved.drop) {
            const path = flyingRoute([resolved.store, resolved.drop]);
            sessionRef.current.path = path;
            if (sessionRef.current.line?.setPath) sessionRef.current.line.setPath(path);
            else {
              sessionRef.current.line = new maps.Polyline({
                map: sessionRef.current.map,
                path,
                strokeColor: ROAD,
                strokeOpacity: 1,
                strokeWeight: 4,
                geodesic: false,
                zIndex: 8,
              });
            }
            const nextBounds = new maps.LatLngBounds();
            path.forEach((point) => nextBounds.extend(point));
            sessionRef.current.map.fitBounds(nextBounds, { top: 96, right: 72, bottom: 72, left: 72 });
            sessionRef.current.map.setTilt(0);
            sessionRef.current.map.setHeading(0);
          }
          return;
        }
        hostRef.current.innerHTML = "";
        const center = resolved.store ?? resolved.drop ?? { lat: 18.5196, lng: 73.8553 };
        const options = {
          center,
          zoom: 13,
          tilt: 0,
          heading: 0,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        };
        const map = new maps.Map(hostRef.current, options);
        const info = new maps.InfoWindow();
        const bounds = new maps.LatLngBounds();
        const place = (point: LatLng | undefined, kind: "store" | "drop", color: string) => {
          if (!point) return;
          bounds.extend(point);
          const pinPoint = kind === "store" ? pinsRef.current.store : pinsRef.current.drop;
          const label = pinPoint.label || (kind === "store" ? "Store" : "Home");
          const openInfo = () => {
            const current = kind === "store" ? pinsRef.current.store : pinsRef.current.drop;
            const title = escapeHtml(current.label || label);
            const address = current.address ? `<div style="margin-top:4px">${escapeHtml(current.address)}</div>` : "";
            info.setContent(`<div style="font-family:sans-serif;max-width:220px;color:#1c1917"><b>${title}</b>${address}</div>`);
            info.open(map);
          };
          new maps.Marker({
            map,
            position: point,
            title: label,
            icon: { url: pin(color), scaledSize: new maps.Size(36, 46), anchor: new maps.Point(18, 46) },
            zIndex: kind === "store" ? 6 : 5,
          }).addListener("click", openInfo);
        };
        place(resolved.store, "store", STORE);
        place(resolved.drop, "drop", DROP);
        const session: {
          map: LiveMap;
          path: LatLng[];
          progress: number;
          line?: { setMap: (map: object | null) => void; setPath?: (path: LatLng[]) => void };
        } = { map, path: [], progress: 0 };
        if (resolved.store && resolved.drop) {
          const path = flyingRoute([resolved.store, resolved.drop]);
          session.path = path;
          session.line = new maps.Polyline({
            map,
            path,
            strokeColor: ROAD,
            strokeOpacity: 1,
            strokeWeight: 4,
            geodesic: false,
            zIndex: 8,
          });
          path.forEach((point) => bounds.extend(point));
          map.fitBounds(bounds, { top: 96, right: 72, bottom: 72, left: 72 });
          map.setTilt(0);
          map.setHeading(0);
        }
        sessionRef.current = session;
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
          Polyline: new (opts: object) => { setMap: (map: object | null) => void; setPath?: (path: LatLng[]) => void };
          Marker: new (opts: object) => { setMap: (map: object | null) => void; setPosition: (point: LatLng) => void };
          LatLngBounds: new () => { extend: (point: LatLng) => void };
          Size: new (w: number, h: number) => unknown;
          Point: new (x: number, y: number) => unknown;
          geometry?: {
            spherical?: {
              computeHeading: (a: LatLng, b: LatLng) => number;
              computeDistanceBetween: (a: LatLng, b: LatLng) => number;
              computeOffset: (from: LatLng, distance: number, heading: number) => { lat: () => number; lng: () => number };
            };
          };
          marker?: { AdvancedMarkerElement: new (opts: object) => { position?: LatLng; map?: object | null } };
        };
      };
    };
    const maps = googleWin.google?.maps;
    if (!mapReady || !view || !maps || !resolved.drop) return;
    const live = view;
    const stops: LatLng[] = [];
    if (resolved.store) stops.push(resolved.store);
    stops.push(resolved.drop);
    if (stops.length < 2) return;
    const path = flyingRoute(stops);
    let frame = 0;
    if (live.line?.setPath) live.line.setPath(path);
    else {
      live.line?.setMap(null);
      live.line = new maps.Polyline({
        map: live.map,
        path,
        strokeColor: ROAD,
        strokeOpacity: 1,
        strokeWeight: 4,
        geodesic: false,
        zIndex: 8,
      });
    }
    live.path = path;
    const bounds = new maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    const pad = { top: 96, right: 72, bottom: 72, left: 72 };
    live.map.fitBounds(bounds, pad);
    live.map.setTilt(0);
    live.map.setHeading(0);
    if (!accepted || !agent) {
      if (live.bike) live.bike.map = null;
    } else {
      moveBike(path);
    }

    function moveBike(path: LatLng[]) {
      if (!agent) return;
      const snapped = project(agent, path);
      const headingOf = (from: LatLng, to: LatLng) =>
        maps?.geometry?.spherical?.computeHeading(from, to) ?? (Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180) / Math.PI;
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
        showCourier={showCourier}
      />
    );
  }

  return (
    <div className="vgmf-map-card">
      <div className="vgmf-map-stage">
        <div ref={hostRef} className="vgmf-map-canvas" />
        <div className="vgmf-map-legend">
          <span><i style={{ background: STORE }} /> {store.label || "Store"}</span>
          <span><i style={{ background: DROP }} /> {drop.label || "Home"}</span>
          {accepted ? <span><i style={{ background: "#0B1F3A" }} /> Rider</span> : null}
        </div>
      </div>
      {showCourier ? (
        <AgentCard
          partner={partner}
          status={status}
          accepted={accepted}
          leg={leg}
          agentName={agentName}
          agentPhone={agentPhone}
          arrival={promised}
        />
      ) : null}
    </div>
  );
}

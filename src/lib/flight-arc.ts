export type FlightPoint = { lat: number; lng: number };

/** Quadratic flight from the store pin to the delivery pin. Endpoints are those two coordinates. */
export function flyingArc(from: FlightPoint, to: FlightPoint) {
  const steps = 56;
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const len = Math.hypot(dLat, dLng) || 0.0001;
  const bow = len * 0.42;
  const ctrl = {
    lat: (from.lat + to.lat) / 2 + (-dLng / len) * bow,
    lng: (from.lng + to.lng) / 2 + (dLat / len) * bow,
  };
  const path: FlightPoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    path.push({
      lat: u * u * from.lat + 2 * u * t * ctrl.lat + t * t * to.lat,
      lng: u * u * from.lng + 2 * u * t * ctrl.lng + t * t * to.lng,
    });
  }
  path[0] = from;
  path[path.length - 1] = to;
  return path;
}

/** Path plus a margin so the peak of the arc stays inside the map. */
export function framePoints(path: FlightPoint[]) {
  if (!path.length) return path;
  const lats = path.map((point) => point.lat);
  const lngs = path.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 0.45, 0.004);
  const lngPad = Math.max((maxLng - minLng) * 0.45, 0.004);
  return [
    ...path,
    { lat: minLat - latPad, lng: minLng - lngPad },
    { lat: maxLat + latPad, lng: maxLng + lngPad },
  ];
}

export function flyingRoute(points: FlightPoint[]) {
  const path: FlightPoint[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = flyingArc(points[i], points[i + 1]);
    if (i > 0) segment.shift();
    path.push(...segment);
  }
  return path;
}

export type PlaceSelection = {
  venue: string;
  city: string;
  mapsUrl: string;
  placeId?: string;
  lat?: number;
  lng?: number;
};

export function parseMapsUrl(url: string): Partial<PlaceSelection> {
  const value = url.trim();
  if (!value) return {};
  const at = value.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const q = value.match(/[?&]q=([^&]+)/i);
  const placeName = value.match(/\/place\/([^/]+)/);
  const placeId = value.match(/place_id[=:]([^&/]+)/i)?.[1];
  const lat = at ? Number(at[1]) : undefined;
  const lng = at ? Number(at[2]) : undefined;
  const query = q ? decodeURIComponent(q[1].replace(/\+/g, " ")) : placeName ? decodeURIComponent(placeName[1].replace(/\+/g, " ")) : "";
  const city = query.split(",").slice(-2, -1)[0]?.trim() ?? "";
  return {
    mapsUrl: value,
    venue: query || undefined,
    city: city || undefined,
    placeId,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
  };
}

export function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapsEmbedUrl(place: Partial<Pick<PlaceSelection, "mapsUrl" | "lat" | "lng" | "venue" | "city">>) {
  if (place.lat && place.lng) return `https://www.google.com/maps?q=${place.lat},${place.lng}&z=16&output=embed`;
  const link = place.mapsUrl?.trim() ?? "";
  if (link.includes("/maps/embed") || link.includes("output=embed")) return link;
  const query = [place.venue, place.city].filter(Boolean).join(", ");
  if (query) return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  if (link) return `https://www.google.com/maps?q=${encodeURIComponent(link)}&output=embed`;
  return "";
}

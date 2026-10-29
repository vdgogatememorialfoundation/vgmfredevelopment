"use client";

import { useEffect, useRef, useState } from "react";
import { getSettings } from "@/lib/admin-store";
import { loadGooglePlaces, mapsEmbedUrl, parseMapsUrl, type GoogleMapsWindow } from "@/lib/maps-place";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export function ClinicLocationField({
  address,
  city,
  mapLink,
  placeId,
  lat,
  lng,
  onChange,
}: {
  address: string;
  city: string;
  mapLink?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  onChange: (patch: { address?: string; city?: string; mapLink?: string; placeId?: string; coordinates?: { lat: number; lng: number } }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(address || mapLink || "");
  const [message, setMessage] = useState("");
  const mapsKey = typeof window === "undefined" ? "" : getSettings().apiKeys.googleMaps;
  const embed = mapsEmbedUrl({ mapsUrl: mapLink, lat, lng, venue: address, city });

  useEffect(() => {
    if (!mapsKey || !inputRef.current) return;
    let cancelled = false;
    loadGooglePlaces(mapsKey)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const google = (window as GoogleMapsWindow).google;
        if (!google?.maps?.places) return;
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["name", "formatted_address", "geometry", "place_id", "url"],
        });
        autocomplete.addListener("place_changed", () => {
          const next = autocomplete.getPlace();
          const nextLat = next.geometry?.location?.lat();
          const nextLng = next.geometry?.location?.lng();
          const formatted = next.formatted_address || next.name || "";
          const cityGuess = formatted.split(",").slice(-3, -2)[0]?.trim() || city;
          onChange({
            address: formatted,
            city: cityGuess,
            mapLink: next.url || mapLink,
            placeId: next.place_id,
            coordinates: nextLat && nextLng ? { lat: nextLat, lng: nextLng } : undefined,
          });
          setQuery(formatted);
        });
      })
      .catch(() => setMessage("Could not load Google Maps. Paste a Maps link instead."));
    return () => {
      cancelled = true;
    };
  }, [mapsKey]);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        className={field}
        placeholder={mapsKey ? "Search a place with Google Maps" : "Address"}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange({ address: event.target.value });
        }}
      />
      <input className={field} placeholder="City" value={city} onChange={(event) => onChange({ city: event.target.value })} />
      <input
        className={field}
        placeholder="Google Maps link (optional)"
        value={mapLink ?? ""}
        onChange={(event) => {
          const parsed = parseMapsUrl(event.target.value);
          onChange({
            mapLink: event.target.value,
            placeId: parsed.placeId,
            coordinates: parsed.lat && parsed.lng ? { lat: parsed.lat, lng: parsed.lng } : undefined,
          });
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <input className={field} placeholder="Latitude" value={lat ?? ""} onChange={(event) => onChange({ coordinates: { lat: Number(event.target.value), lng: lng ?? 0 } })} />
        <input className={field} placeholder="Longitude" value={lng ?? ""} onChange={(event) => onChange({ coordinates: { lat: lat ?? 0, lng: Number(event.target.value) } })} />
      </div>
      {message && <p className="text-xs text-amber-800">{message}</p>}
      <p className="text-xs text-slate-500">
        {mapsKey
          ? "The Google Maps key from General settings powers place search. You can also paste a Maps URL."
          : "Add a Google Maps JavaScript API key under Settings → General to search places. A Maps link still works without it."}
      </p>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {embed ? (
          <iframe title="Map preview" src={embed} className="h-64 w-full" loading="lazy" />
        ) : (
          <p className="p-6 text-sm text-slate-500">Add an address or Maps link to preview the map.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { getSettings } from "@/lib/admin-store";
import { mapsEmbedUrl, mapsSearchUrl, parseMapsUrl, type PlaceSelection } from "@/lib/maps-place";

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          options?: { fields?: string[]; types?: string[] }
        ) => {
          addListener: (event: string, handler: () => void) => void;
          getPlace: () => {
            name?: string;
            formatted_address?: string;
            place_id?: string;
            url?: string;
            geometry?: { location?: { lat: () => number; lng: () => number } };
          };
        };
      };
    };
  };
};

function loadPlaces(key: string) {
  const win = window as GoogleMapsWindow;
  if (win.google?.maps?.places) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-vgmf-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.async = true;
    script.dataset.vgmfMaps = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });
}

export function EventLocationField({
  tbd,
  venue,
  city,
  mapsUrl,
  placeId,
  lat,
  lng,
  onTbd,
  onChange,
}: {
  tbd: boolean;
  venue?: string;
  city?: string;
  mapsUrl?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  onTbd: (value: boolean) => void;
  onChange: (place: PlaceSelection) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(venue || mapsUrl || "");
  const [message, setMessage] = useState("");
  const mapsKey = typeof window === "undefined" ? "" : getSettings().apiKeys.googleMaps;
  const place: PlaceSelection = { venue: venue ?? "", city: city ?? "", mapsUrl: mapsUrl ?? "", placeId, lat, lng };
  const embed = !tbd ? mapsEmbedUrl(place) : "";

  useEffect(() => {
    if (tbd || !mapsKey || !inputRef.current) return;
    let cancelled = false;
    loadPlaces(mapsKey)
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
          const address = next.formatted_address ?? next.name ?? "";
          const cityName = address.split(",").slice(-3, -2)[0]?.trim() ?? "";
          onChange({
            venue: next.name || address,
            city: cityName,
            mapsUrl: next.url || (nextLat && nextLng ? `https://www.google.com/maps?q=${nextLat},${nextLng}` : mapsSearchUrl(address)),
            placeId: next.place_id,
            lat: nextLat,
            lng: nextLng,
          });
          setQuery(next.name || address);
          setMessage("");
        });
      })
      .catch(() => setMessage("Google Maps could not load. Paste a Maps URL or type the address."));
    return () => {
      cancelled = true;
    };
  }, [mapsKey, tbd]);

  const applyQuery = () => {
    const value = query.trim();
    if (!value) return;
    if (/google\.[^/]+\/maps/i.test(value) || value.includes("maps.app.goo.gl") || value.includes("goo.gl/maps")) {
      const parsed = parseMapsUrl(value);
      onChange({
        venue: parsed.venue || venue || value,
        city: parsed.city || city || "",
        mapsUrl: parsed.mapsUrl || value,
        placeId: parsed.placeId,
        lat: parsed.lat,
        lng: parsed.lng,
      });
      setMessage("Location saved from the Google Maps link.");
      return;
    }
    onChange({
      venue: value,
      city: city || "",
      mapsUrl: mapsSearchUrl(value),
    });
    setMessage("Location saved. Add a Google Maps API key in Settings to search places as you type.");
  };

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Location</p>
        <label className="flex items-center gap-2 text-sm text-amber-900">
          <input type="checkbox" checked={tbd} onChange={(event) => onTbd(event.target.checked)} />
          Location TBD
        </label>
      </div>
      {tbd ? (
        <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The site will show the venue as “To be announced”. You can add a Google Maps location later.
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder={mapsKey ? "Search Google Maps for a venue" : "Venue name, address, or paste a Google Maps link"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={applyQuery}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyQuery();
              }
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Venue name"
              value={venue ?? ""}
              onChange={(event) => onChange({ ...place, venue: event.target.value })}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="City"
              value={city ?? ""}
              onChange={(event) => onChange({ ...place, city: event.target.value })}
            />
          </div>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Google Maps URL (optional)"
            value={mapsUrl ?? ""}
            onChange={(event) => onChange({ ...place, ...parseMapsUrl(event.target.value), mapsUrl: event.target.value })}
          />
          {embed && (
            <iframe
              title="Event location"
              src={embed}
              className="h-56 w-full rounded-xl border border-slate-200"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
          {message && <p className="text-xs text-slate-500">{message}</p>}
        </>
      )}
    </div>
  );
}

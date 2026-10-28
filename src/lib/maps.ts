import type { Clinic } from "@/types";

export function clinicMapEmbed(clinic: Pick<Clinic, "mapLink" | "coordinates" | "address" | "name" | "city">) {
  const link = clinic.mapLink?.trim() ?? "";
  const iframeSrc = link.match(/src="([^"]+)"/)?.[1];
  if (iframeSrc) return iframeSrc;
  if (link.includes("/maps/embed") || link.includes("output=embed")) return link;
  const { lat, lng } = clinic.coordinates ?? { lat: 0, lng: 0 };
  if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  const query = [clinic.name, clinic.address, clinic.city].filter(Boolean).join(", ");
  if (!clinic.address?.trim()) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function clinicDirectionsUrl(clinic: Pick<Clinic, "mapLink" | "coordinates" | "address" | "name" | "city">) {
  const link = clinic.mapLink?.trim() ?? "";
  if (link && !link.includes("<iframe") && !link.includes("/maps/embed")) return link;
  const { lat, lng } = clinic.coordinates ?? { lat: 0, lng: 0 };
  const destination = lat && lng ? `${lat},${lng}` : [clinic.name, clinic.address, clinic.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

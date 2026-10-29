import type { Metadata } from "next";
import { GalleryView } from "@/components/gallery/GalleryView";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photographs from the Vaidya Gogate Memorial Foundation, seminars, clinics and community programmes.",
};

export default function GalleryPage() {
  return <GalleryView />;
}

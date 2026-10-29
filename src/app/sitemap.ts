import type { MetadataRoute } from "next";
import { publicSitemapPaths, siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return publicSitemapPaths.map((path, index) => ({
    url: `${siteUrl}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : index < 8 ? 0.8 : 0.5,
  }));
}

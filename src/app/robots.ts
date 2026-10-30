import type { MetadataRoute } from "next";
import { platformEnv, publicSiteUrl } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const env = platformEnv();
  const host = publicSiteUrl();
  if (env === "demo" || env === "staging") {
    return {
      rules: { userAgent: "*", disallow: "/" },
      host,
    };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/staff", "/doctor", "/account", "/checkout", "/cart", "/api/"],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
    host,
  };
}

import type { NextConfig } from "next";

const onVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Standalone output is for the Mumbai VPS. Skip it if a leftover Vercel Git hook still runs.
  ...(!onVercel ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["pg"],
  outputFileTracingExcludes: {
    "/*": ["./mobile/**/*", "./native/**/*", "./admin-backups/**/*", "./deploy/**/*"],
  },
  async redirects() {
    return [
      { source: "/vgmf-foundation.apk", destination: "/apps/vgmf-customer.apk", permanent: false },
      { source: "/api/mobile/apk", destination: "/apps/vgmf-customer.apk", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
      {
        source: "/apps/:file*.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: "attachment" },
          { key: "Cache-Control", value: "public, max-age=120" },
        ],
      },
    ];
  },
};

export default nextConfig;

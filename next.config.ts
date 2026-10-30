import type { NextConfig } from "next";

const onVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Standalone output is for the Mumbai VPS. Skip it if a leftover Vercel Git hook still runs.
  ...(!onVercel ? { output: "standalone" as const } : {}),
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

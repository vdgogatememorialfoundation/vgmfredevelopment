import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/vgmf-foundation.apk", destination: "/api/mobile/apk/customer", permanent: false },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

import { staticSecurityHeaders } from "./lib/security/browser-policy";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  onDemandEntries: {
    maxInactiveAge: 10 * 60 * 1000,
    pagesBufferLength: 8,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...staticSecurityHeaders],
      },
    ];
  },
};

export default nextConfig;

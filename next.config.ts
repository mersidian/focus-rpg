import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions carry the whole game loop; keep payloads small.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;

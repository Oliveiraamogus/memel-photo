import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Derivatives are generated once at ingest and served straight from Garage,
  // so running the Next image optimizer on top of them would only burn CPU.
  images: { unoptimized: true },
  serverExternalPackages: ["pg", "pg-boss", "sharp"],
  async redirects() {
    return [{ source: "/albums", destination: "/", permanent: true }];
  },
};

export default nextConfig;

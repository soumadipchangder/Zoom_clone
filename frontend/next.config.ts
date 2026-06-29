import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: bundles only what's needed to run, no full node_modules copy
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

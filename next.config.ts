import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
};

export default nextConfig;

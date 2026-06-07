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
async headers() {
  return [
    {
      source: "/sw.js",
      headers: [
        {
          key: "Service-Worker-Allowed",
          value: "/",
        },
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    },
  ];
},
};

export default nextConfig;

import type { NextConfig } from "next";
import { MAX_MEDIA_FILE_BYTES } from "./src/lib/media/asset-utils";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB breaks PDF/video uploads via server actions (Library, AI Studio).
      bodySizeLimit: MAX_MEDIA_FILE_BYTES,
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
};

export default nextConfig;

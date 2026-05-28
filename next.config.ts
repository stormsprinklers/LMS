import type { NextConfig } from "next";
import { MAX_MEDIA_FILE_BYTES } from "./src/lib/media/asset-utils";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB breaks PDF/video uploads via server actions (Library, AI Studio).
      bodySizeLimit: MAX_MEDIA_FILE_BYTES,
    },
  },
};

export default nextConfig;

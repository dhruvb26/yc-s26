import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure ffmpeg-static binary is included in serverless function bundle
  outputFileTracingIncludes: {
    "/api/*": ["./node_modules/ffmpeg-static/**/*"],
    // Also include for server actions
    "/app/*": ["./node_modules/ffmpeg-static/**/*"],
  },
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;

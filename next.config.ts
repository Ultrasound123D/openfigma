import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // PHASE 5 cleanup: build now enforces TypeScript strictness (tsc --noEmit
  // passes with zero errors — verified per RULES-10 before removing the flag).
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the home directory above this project holds an unrelated package-lock.json
  turbopack: { root: __dirname },
  // dev server is opened by IP from other machines; without this /_next dev resources are blocked
  allowedDevOrigins: ["103.171.96.225"],
  // the public domain reaches the app through a proxy that forwards host as localhost:3001,
  // which Next otherwise rejects as a cross-origin Server Action
  experimental: { serverActions: { allowedOrigins: ["production.vamadairy.in", "localhost:3001"] } },
};

export default nextConfig;

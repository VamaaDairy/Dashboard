import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the home directory above this project holds an unrelated package-lock.json
  turbopack: { root: __dirname },
  // dev server is opened by IP from other machines; without this /_next dev resources are blocked
  allowedDevOrigins: ["103.171.96.225"],
};

export default nextConfig;

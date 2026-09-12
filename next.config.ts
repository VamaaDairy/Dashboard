import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the home directory above this project holds an unrelated package-lock.json
  turbopack: { root: __dirname },
};

export default nextConfig;

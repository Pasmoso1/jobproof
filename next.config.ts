import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  /**
   * Allow the dev server to be opened from this machine’s LAN IP (phone / other devices).
   * Next.js only enforces this in development — production builds ignore it.
   */
  allowedDevOrigins: ["http://192.168.2.34:3000"],
};

export default nextConfig;

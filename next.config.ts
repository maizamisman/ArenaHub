import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages read live data from SQLite on every request, so the app renders
  // dynamically instead of using Cache Components.
  cacheComponents: false,
  // Phones on the same Wi-Fi open the dev server by LAN address.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // The Admin's logo upload (up to 2 MB) goes through a server action.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;

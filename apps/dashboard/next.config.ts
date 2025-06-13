import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL("https://openstatus.dev/**")],
  },
};

export default nextConfig;

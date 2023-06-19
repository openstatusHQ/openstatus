import "./src/env.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["ui"],
  experimental: {
    serverActions: true,
  },
};

export default nextConfig;

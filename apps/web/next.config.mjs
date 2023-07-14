import "./src/env.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["ui", "@openstatus/api"],
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;

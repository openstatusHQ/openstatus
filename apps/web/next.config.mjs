import { withContentlayer } from "next-contentlayer";

import "./src/env.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["ui", "@openstatus/api"],
  experimental: {
    serverActions: true,
  },
};

export default withContentlayer(nextConfig);

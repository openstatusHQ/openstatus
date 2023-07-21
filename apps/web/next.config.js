const { withContentlayer } = require("next-contentlayer");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["ui", "@openstatus/api"],
  experimental: {
    serverActions: true,
  },
};

module.exports = withContentlayer(nextConfig);

const { withSentryConfig } = require("@sentry/nextjs");

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://openstatus.dev/**"),
      new URL("https://**.public.blob.vercel-storage.com/**"),
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source:
            "/:path((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
          has: [
            {
              type: "host",
              value:
                process.env.NODE_ENV === "production"
                  ? "(?<subdomain>[^.]+).stpg.dev"
                  : "(?<subdomain>[^.]+).localhost",
            },
          ],
          missing: [
            // Skip this rewrite when the request came via proxy from web app
            {
              type: "header",
              key: "x-proxy",
              value: "1",
            },
            {
              type: "host",
              value:
                process.env.NODE_ENV === "production"
                  ? "www.stpg.dev"
                  : "localhost",
            },
          ],
          destination: "/:subdomain/:path*",
        },
      ],
    };
  },
};

module.exports = withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,

    org: "openstatus",
    project: "openstatus",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: false,

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  },
);

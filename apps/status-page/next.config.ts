import { withSentryConfig } from "@sentry/nextjs";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.SELF_HOST === "true" && { output: "standalone" }),
  experimental: {
    authInterrupts: true,
  },
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

// For detailed options, refer to the official documentation:
// - Webpack plugin options: https://github.com/getsentry/sentry-webpack-plugin#options
// - Next.js Sentry setup guide: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
const sentryConfig = {
  // Prevent log output unless running in a CI environment (helps reduce noise in logs)
  silent: !process.env.CI,
  org: "openstatus",
  project: "openstatus",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a larger set of source maps for improved stack trace accuracy (increases build time)
  widenClientFileUpload: true,

  // If set to true, transpiles Sentry SDK to be compatible with IE11 (increases bundle size)
  transpileClientSDK: false,

  // Tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
};

export default withSentryConfig(nextConfig, sentryConfig);

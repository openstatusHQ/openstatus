import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// ICON_SET=nucleo swaps the icon set at resolution time (see packages/icons)
const useNucleoIcons = process.env.ICON_SET === "nucleo";

const nextConfig: NextConfig = {
  output: process.env.SELF_HOST === "true" ? "standalone" : undefined,
  experimental: {
    // barrel-optimize only when unaliased — the rewrite would bypass the nucleo alias
    optimizePackageImports: useNucleoIcons ? [] : ["@openstatus/icons"],
  },
  turbopack: useNucleoIcons
    ? { resolveAlias: { "@openstatus/icons": "@openstatus/icons/nucleo" } }
    : undefined,
  webpack: (config) => {
    if (useNucleoIcons) {
      config.resolve.alias["@openstatus/icons$"] = "@openstatus/icons/nucleo";
    }
    return config;
  },
  images: {
    remotePatterns: [
      new URL("https://openstatus.dev/**"),
      new URL("https://**.public.blob.vercel-storage.com/**"),
      new URL("https://www.openstatus.dev/**"),
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // moved under /settings — keep old links working
  async redirects() {
    return [
      {
        source: "/private-locations",
        destination: "/settings/private-locations",
        permanent: false,
      },
      {
        source: "/audit-logs",
        destination: "/settings/audit-logs",
        permanent: false,
      },
    ];
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
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
};

export default withSentryConfig(nextConfig, sentryConfig);

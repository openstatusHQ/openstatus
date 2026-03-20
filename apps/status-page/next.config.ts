import { defaultLocale, locales } from "@/i18n/config";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  experimental: {
    srcPath: "./src",
    extract: {
      sourceLocale: defaultLocale,
    },
    messages: {
      path: "./messages",
      format: "json",
      locales,
    },
  },
});

const nextConfig: NextConfig = {
  output: process.env.SELF_HOST === "true" ? "standalone" : undefined,
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

export default withSentryConfig(withNextIntl(nextConfig), sentryConfig);
